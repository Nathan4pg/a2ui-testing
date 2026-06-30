import { create } from 'zustand';
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

/**
 * Lifecycle phases of an agent run:
 *  - idle:      nothing in flight
 *  - thinking:  run started, model is deciding (no text/tool yet)
 *  - tool:      a tool is being called
 *  - streaming: assistant text is arriving
 *  - error:     the run failed
 */
export type Phase = 'idle' | 'thinking' | 'tool' | 'streaming' | 'error';

interface ChatState {
  items: ChatItem[];
  datasets: Datasets;
  phase: Phase;
  activeTool: string | null;
  error: string | null;

  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// The ag-ui agent and abort flag are intentionally kept outside reactive state.
let agentInstance: HttpAgent | null = null;
let userAborted = false;

function getAgent(): HttpAgent {
  if (!agentInstance) {
    agentInstance = new HttpAgent({ url: agentUrl() });
  }
  return agentInstance;
}

export const useChatStore = create<ChatState>((set, get) => ({
  items: [],
  datasets: {},
  phase: 'idle',
  activeTool: null,
  error: null,

  send: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { phase } = get();
    if (phase === 'thinking' || phase === 'tool' || phase === 'streaming') {
      return;
    }

    const agent = getAgent();
    userAborted = false;

    const userId = uid();
    set((s) => ({
      error: null,
      phase: 'thinking',
      activeTool: null,
      items: [
        ...s.items,
        { kind: 'message', id: userId, role: 'user', content: trimmed },
      ],
    }));
    agent.addMessage({ id: userId, role: 'user', content: trimmed } as any);

    const appendAssistant = (messageId: string, delta: string) => {
      set((s) => {
        const idx = s.items.findIndex(
          (it) => it.kind === 'message' && it.id === messageId
        );
        if (idx === -1) {
          return {
            items: [
              ...s.items,
              {
                kind: 'message',
                id: messageId,
                role: 'assistant',
                content: delta,
              } as MessageItem,
            ],
          };
        }
        const items = [...s.items];
        const msg = items[idx] as MessageItem;
        items[idx] = { ...msg, content: msg.content + delta };
        return { items };
      });
    };

    try {
      await agent.runAgent(
        {},
        {
          onToolCallStartEvent: ({ event }: any) => {
            set({ phase: 'tool', activeTool: event.toolCallName ?? null });
          },
          onToolCallResultEvent: () => {
            // Back to "thinking" until the next tool or the final text.
            set((s) =>
              s.phase === 'streaming'
                ? { activeTool: null }
                : { phase: 'thinking', activeTool: null }
            );
          },
          onCustomEvent: ({ event }: any) => {
            if (event.name === 'tool_result') {
              const v = event.value || {};
              const kind: RenderKind | undefined = v.render;
              if (kind) {
                set((s) => ({
                  datasets: {
                    ...s.datasets,
                    [kind]: { tool: v.tool, summary: v.summary, data: v.data },
                  },
                  items: [
                    ...s.items,
                    {
                      kind: 'artifact',
                      id: uid(),
                      tool: v.tool,
                      render: kind,
                      summary: v.summary,
                      data: v.data,
                    } as ArtifactItem,
                  ],
                }));
              }
            }
            // The server also streams an `a2ui` surface for the same result; we
            // don't render it — the native chart/table above is the single
            // representation. (a2ui still lives on the server.)
          },
          onTextMessageStartEvent: ({ event }: any) => {
            set({ phase: 'streaming', activeTool: null });
            appendAssistant(event.messageId, '');
          },
          onTextMessageContentEvent: ({ event }: any) => {
            appendAssistant(event.messageId, event.delta ?? '');
          },
          onRunFinishedEvent: () => {
            set({ phase: 'idle', activeTool: null });
          },
          onRunErrorEvent: ({ event }: any) => {
            set({
              phase: 'error',
              activeTool: null,
              error: event?.message || 'The agent run failed.',
            });
          },
        }
      );
      // Normal completion (runAgent resolved without a RUN_FINISHED is rare).
      if (get().phase !== 'error') set({ phase: 'idle', activeTool: null });
    } catch (err: any) {
      if (userAborted || err?.name === 'AbortError') {
        set({ phase: 'idle', activeTool: null });
        return;
      }
      set({
        phase: 'error',
        activeTool: null,
        error: err?.message
          ? `Could not reach the agent server. Is it running on ${agentUrl()}? (${err.message})`
          : 'Could not reach the agent server.',
      });
    }
  },

  stop: () => {
    userAborted = true;
    try {
      agentInstance?.abortRun();
    } catch {
      /* noop */
    }
    set({ phase: 'idle', activeTool: null });
  },

  reset: () => {
    if (agentInstance) {
      userAborted = true;
      try {
        agentInstance.abortRun();
      } catch {
        /* noop */
      }
      (agentInstance as any).setMessages?.([]);
    }
    set({ items: [], datasets: {}, phase: 'idle', activeTool: null, error: null });
  },
}));
