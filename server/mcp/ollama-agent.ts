import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { Ollama } from 'ollama';
import { EventEncoder } from '@ag-ui/encoder';
import { EventType } from '@ag-ui/core';
import type { BaseEvent, RunAgentInput, Message } from '@ag-ui/core';

import { config } from './config';
import { listOllamaTools, callMcpTool } from './mcp-client';
import { buildToolResultSurface } from './a2ui';
import { toolByName } from './tools';

const ollama = new Ollama({ host: config.ollamaHost });

const SYSTEM_PROMPT = `You are the assistant inside a Chrome side-panel analytics app.
You have tools that return live dashboard data (KPIs, revenue time series, sales by region,
traffic by channel, recent orders).

IMPORTANT: The chart or table only appears in the UI when you CALL the matching tool on THIS
turn — the client renders it from the tool's result. So whenever the user asks to see, show,
render, plot, or chart anything, or asks about metrics, trends, breakdowns, comparisons, or
records, you MUST call the appropriate tool, even if similar data already appeared earlier in
the conversation. Never answer such a request from memory without calling the tool.

After the tool returns, briefly narrate the insight in plain language. Do NOT dump raw JSON or
restate every data point — the UI already shows the chart/table.`;

/** Map ag-ui messages to Ollama chat messages. */
function toOllamaMessages(messages: Message[] = []) {
  const mapped = messages
    .filter((m) => m.role !== 'tool' || (m as any).content)
    .map((m: any) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: typeof m.content === 'string' ? m.content : '',
          tool_name: m.name,
        };
      }
      const content =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
          ? m.content
              .map((p: any) => (typeof p === 'string' ? p : p.text ?? ''))
              .join('')
          : '';
      return { role: m.role, content };
    });
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...mapped];
}

/**
 * Run one agent turn: drive the local Ollama model, route any tool calls through
 * MCP, and stream the whole thing back to the client as ag-ui events over SSE.
 */
export async function runAgent(input: RunAgentInput, res: Response): Promise<void> {
  const encoder = new EventEncoder();
  const threadId = input.threadId || randomUUID();
  const runId = input.runId || randomUUID();

  res.setHeader('Content-Type', encoder.getContentType());
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: BaseEvent) => res.write(encoder.encode(event));

  let aborted = false;
  res.on('close', () => {
    aborted = true;
  });

  try {
    send({ type: EventType.RUN_STARTED, threadId, runId } as BaseEvent);

    const messages = toOllamaMessages(input.messages);
    const tools = await listOllamaTools();

    for (let round = 0; round < config.maxToolRoundtrips; round++) {
      if (aborted) break;

      const stream = await ollama.chat({
        model: config.ollamaModel,
        messages,
        tools,
        stream: true,
      });

      let textMessageId: string | null = null;
      let assistantText = '';
      const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

      for await (const part of stream) {
        if (aborted) break;
        const delta = part.message?.content ?? '';
        if (delta) {
          if (!textMessageId) {
            textMessageId = randomUUID();
            send({
              type: EventType.TEXT_MESSAGE_START,
              messageId: textMessageId,
              role: 'assistant',
            } as BaseEvent);
          }
          assistantText += delta;
          send({
            type: EventType.TEXT_MESSAGE_CONTENT,
            messageId: textMessageId,
            delta,
          } as BaseEvent);
        }
        for (const tc of part.message?.tool_calls ?? []) {
          toolCalls.push({
            name: tc.function.name,
            args: (tc.function.arguments as Record<string, unknown>) ?? {},
          });
        }
      }

      if (textMessageId) {
        send({
          type: EventType.TEXT_MESSAGE_END,
          messageId: textMessageId,
        } as BaseEvent);
      }

      // No tools requested -> this was the final answer.
      if (toolCalls.length === 0) break;

      // Record the assistant's tool-call turn for the next round's context.
      messages.push({
        role: 'assistant',
        content: assistantText,
        tool_calls: toolCalls.map((t) => ({
          function: { name: t.name, arguments: t.args },
        })),
      } as any);

      for (const call of toolCalls) {
        if (aborted) break;
        const toolCallId = randomUUID();
        send({
          type: EventType.TOOL_CALL_START,
          toolCallId,
          toolCallName: call.name,
          parentMessageId: textMessageId ?? undefined,
        } as BaseEvent);
        send({
          type: EventType.TOOL_CALL_ARGS,
          toolCallId,
          delta: JSON.stringify(call.args ?? {}),
        } as BaseEvent);
        send({ type: EventType.TOOL_CALL_END, toolCallId } as BaseEvent);

        let result: Awaited<ReturnType<typeof callMcpTool>>;
        let toolErrored = false;
        try {
          result = await callMcpTool(call.name, call.args ?? {});
        } catch (toolErr: any) {
          // Don't abort the run — surface the error to the model so it can
          // correct its arguments and retry on the next round.
          toolErrored = true;
          const message = toolErr?.message
            ? String(toolErr.message)
            : 'tool call failed';
          result = {
            summary: `Tool "${call.name}" failed: ${message}. Adjust the arguments and try again.`,
            data: null,
          };
          console.warn(`[agent] tool "${call.name}" error:`, message);
        }
        const resultMessageId = randomUUID();

        send({
          type: EventType.TOOL_CALL_RESULT,
          messageId: resultMessageId,
          toolCallId,
          content: result.summary,
          role: 'tool',
        } as BaseEvent);

        if (!toolErrored) {
          // Structured payload for native chart/table rendering.
          send({
            type: EventType.CUSTOM,
            name: 'tool_result',
            value: {
              tool: call.name,
              render: result.render ?? null,
              summary: result.summary,
              data: result.data,
            },
          } as BaseEvent);

          // a2ui surface for declarative server-driven UI.
          const def = toolByName(call.name);
          const surface = buildToolResultSurface(
            `surface-${toolCallId}`,
            def?.label ?? def?.description ?? call.name,
            result
          );
          if (surface) {
            send({
              type: EventType.CUSTOM,
              name: 'a2ui',
              value: { messages: surface },
            } as BaseEvent);
          }
        }

        // Feed the tool output back to the model.
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            summary: result.summary,
            data: result.data,
          }),
          tool_name: call.name,
        } as any);
      }
    }

    send({ type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent);
  } catch (err: any) {
    console.error('[agent] run error:', err);
    if (!aborted) {
      send({
        type: EventType.RUN_ERROR,
        message: err?.message ? String(err.message) : 'Agent run failed',
      } as BaseEvent);
    }
  } finally {
    res.end();
  }
}
