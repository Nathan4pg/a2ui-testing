import * as React from 'react';
import { HttpAgent } from '@ag-ui/client';

import { agentUrl } from '@/lib/config';

export type RenderKind = 'kpi' | 'line' | 'bar' | 'pie' | 'table';

export interface MessageItem {
  kind: 'message';
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface ArtifactItem {
  kind: 'artifact';
  id: string;
  tool: string;
  render: RenderKind;
  summary: string;
  data: unknown;
}

export type ChatItem = MessageItem | ArtifactItem;

export interface Dataset {
  tool: string;
  summary: string;
  data: unknown;
}

export type Datasets = Partial<Record<RenderKind, Dataset>>;

type Status = 'idle' | 'running' | 'error';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useAgentChat(baseUrl?: string) {
  const [items, setItems] = React.useState<ChatItem[]>([]);
  const [datasets, setDatasets] = React.useState<Datasets>({});
  const [activeTool, setActiveTool] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const agentRef = React.useRef<HttpAgent | null>(null);
  if (!agentRef.current) {
    agentRef.current = new HttpAgent({ url: agentUrl(baseUrl) });
  }

  const upsertAssistant = React.useCallback(
    (messageId: string, append: string) => {
      setItems((prev) => {
        const idx = prev.findIndex(
          (it) => it.kind === 'message' && it.id === messageId
        );
        if (idx === -1) {
          return [
            ...prev,
            { kind: 'message', id: messageId, role: 'assistant', content: append },
          ];
        }
        const next = [...prev];
        const msg = next[idx] as MessageItem;
        next[idx] = { ...msg, content: msg.content + append };
        return next;
      });
    },
    []
  );

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'running') return;
      const agent = agentRef.current!;

      setError(null);
      setStatus('running');

      const userId = uid();
      setItems((prev) => [
        ...prev,
        { kind: 'message', id: userId, role: 'user', content: trimmed },
      ]);
      agent.addMessage({ id: userId, role: 'user', content: trimmed } as any);

      try {
        await agent.runAgent(
          {},
          {
            onTextMessageStartEvent: ({ event }: any) => {
              upsertAssistant(event.messageId, '');
            },
            onTextMessageContentEvent: ({ event }: any) => {
              upsertAssistant(event.messageId, event.delta ?? '');
            },
            onToolCallStartEvent: ({ event }: any) => {
              setActiveTool(event.toolCallName ?? null);
            },
            onToolCallResultEvent: () => {
              setActiveTool(null);
            },
            onCustomEvent: ({ event }: any) => {
              if (event.name === 'tool_result') {
                const v = event.value || {};
                const kind: RenderKind | undefined = v.render;
                if (kind) {
                  // Update the Dashboard tab...
                  setDatasets((prev) => ({
                    ...prev,
                    [kind]: { tool: v.tool, summary: v.summary, data: v.data },
                  }));
                  // ...and render the visualization inline in the chat.
                  setItems((prev) => [
                    ...prev,
                    {
                      kind: 'artifact',
                      id: uid(),
                      tool: v.tool,
                      render: kind,
                      summary: v.summary,
                      data: v.data,
                    },
                  ]);
                }
              }
              // Note: the server also streams an `a2ui` custom event with a
              // server-rendered surface for the same result. We intentionally
              // don't render it here — the native chart/table above is the
              // single representation, so showing the a2ui card too would
              // duplicate it. (a2ui still lives on the server.)
            },
            onRunFinishedEvent: () => {
              setActiveTool(null);
              setStatus('idle');
            },
            onRunErrorEvent: ({ event }: any) => {
              setActiveTool(null);
              setStatus('error');
              setError(event?.message || 'The agent run failed.');
            },
          }
        );
      } catch (err: any) {
        setActiveTool(null);
        setStatus('error');
        setError(
          err?.message
            ? `Could not reach the agent server. Is it running on ${agentUrl(
                baseUrl
              )}? (${err.message})`
            : 'Could not reach the agent server.'
        );
      }
    },
    [status, upsertAssistant, baseUrl]
  );

  const reset = React.useCallback(() => {
    setItems([]);
    setError(null);
    setStatus('idle');
    const agent = agentRef.current;
    if (agent) (agent as any).setMessages?.([]);
  }, []);

  return { items, datasets, activeTool, status, error, sendMessage, reset };
}
