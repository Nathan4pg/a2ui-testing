import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Send, Sparkles, Square, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ChatArtifact } from '@/components/chat-artifact';
import { useChatStore, type ChatItem, type MessageItem } from '@/store/chat-store';

const SUGGESTIONS = [
  'Show me the traffic breakdown by channel',
  'Give me a line chart of revenue for the past 12 months',
  'Compare sales by region',
  'List the most recent orders',
];

const ENTER = { opacity: 1, y: 0 };
const FROM_BELOW = { opacity: 0, y: 10 };
const EXIT_UP = { opacity: 0, y: -10 };
const SPRING = { type: 'spring' as const, stiffness: 500, damping: 38, mass: 0.8 };

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
        {message.content}
      </div>
    </div>
  );
}

/** Animated three-dot indicator. */
function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.18,
          }}
        />
      ))}
    </span>
  );
}

/** The ephemeral "thinking" bubble shown before the assistant's text arrives. */
function ThinkingBubble({ label }: { label: string }) {
  return (
    <motion.div
      layout
      initial={FROM_BELOW}
      animate={ENTER}
      exit={EXIT_UP}
      transition={SPRING}
      className="flex gap-2"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        <ThinkingDots />
        <span>{label}</span>
      </div>
    </motion.div>
  );
}

function TimelineItem({ item }: { item: ChatItem }) {
  return (
    <motion.div
      layout
      initial={FROM_BELOW}
      animate={ENTER}
      transition={SPRING}
    >
      {item.kind === 'message' ? (
        <MessageBubble message={item} />
      ) : (
        <div className="pl-9">
          <ChatArtifact artifact={item} />
        </div>
      )}
    </motion.div>
  );
}

export function Chat() {
  const items = useChatStore((s) => s.items);
  const phase = useChatStore((s) => s.phase);
  const activeTool = useChatStore((s) => s.activeTool);
  const error = useChatStore((s) => s.error);
  const send = useChatStore((s) => s.send);
  const stop = useChatStore((s) => s.stop);

  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const isActive =
    phase === 'thinking' || phase === 'tool' || phase === 'streaming';
  const showThinking = phase === 'thinking' || phase === 'tool';
  const thinkingLabel =
    phase === 'tool' && activeTool ? `Calling ${activeTool}…` : 'Thinking…';

  // Keep pinned to the bottom while the user is already near the bottom, so the
  // panel follows new content without yanking them if they've scrolled up.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [items, phase]);

  const submit = () => {
    if (!input.trim() || isActive) return;
    send(input);
    setInput('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const empty = items.length === 0 && !isActive;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
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
                  onClick={() => send(s)}
                  className="rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((it) => (
              <TimelineItem key={it.id} item={it} />
            ))}

            <AnimatePresence mode="popLayout">
              {showThinking ? (
                <ThinkingBubble key="thinking" label={thinkingLabel} />
              ) : null}
            </AnimatePresence>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Agent error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}
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
          {isActive ? (
            <Button
              size="icon"
              variant="secondary"
              onClick={stop}
              aria-label="Stop"
              title="Stop generating"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={submit}
              disabled={!input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {isActive
            ? 'Generating… press stop to interrupt'
            : 'Enter to send · Shift+Enter for a new line'}
        </p>
      </div>
    </div>
  );
}
