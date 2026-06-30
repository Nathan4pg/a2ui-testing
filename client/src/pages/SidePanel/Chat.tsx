import * as React from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { A2uiSurfaceView } from '@/components/a2ui-surface';
import { ChatArtifact } from '@/components/chat-artifact';
import type { ChatItem, MessageItem } from '@/hooks/use-agent-chat';

const SUGGESTIONS = [
  'Show me the traffic breakdown by channel',
  'Give me a line chart of revenue for the past 12 months',
  'Compare sales by region',
  'List the most recent orders',
];

interface ChatProps {
  items: ChatItem[];
  activeTool: string | null;
  status: 'idle' | 'running' | 'error';
  error: string | null;
  onSend: (text: string) => void;
}

function MessageBubble({ message }: { message: MessageItem }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-2', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {message.content || (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> thinking…
          </span>
        )}
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: ChatItem }) {
  if (item.kind === 'message') return <MessageBubble message={item} />;
  if (item.kind === 'artifact')
    return (
      <div className="pl-9">
        <ChatArtifact artifact={item} />
      </div>
    );
  // a2ui
  return (
    <div className="space-y-1 pl-9">
      <p className="text-xs font-medium text-muted-foreground">
        Server-rendered (a2ui)
      </p>
      <A2uiSurfaceView messages={item.messages} />
    </div>
  );
}

export function Chat({ items, activeTool, status, error, onSend }: ChatProps) {
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [items, activeTool]);

  const submit = () => {
    if (!input.trim() || status === 'running') return;
    onSend(input);
    setInput('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const empty = items.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-3">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">Ask the analytics agent</p>
              <p className="text-sm text-muted-foreground">
                Powered by a local Ollama model over MCP.
              </p>
            </div>
            <div className="grid w-full gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          items.map((it) => <TimelineItem key={it.id} item={it} />)
        )}

        {activeTool ? (
          <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Calling tool <code className="font-mono">{activeTool}</code>…
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Agent error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="border-t bg-background p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message the agent…"
            rows={1}
            className="max-h-32 min-h-[2.5rem] resize-none"
          />
          <Button
            size="icon"
            onClick={submit}
            disabled={!input.trim() || status === 'running'}
            aria-label="Send"
          >
            {status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
