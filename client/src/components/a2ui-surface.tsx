import * as React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/**
 * A small, dependency-free renderer for the a2ui v0.9 surfaces emitted by the
 * server (the `a2ui` custom event). The server builds surfaces with the
 * `basicCatalog` primitives (Card, Column, Row, Text, Divider); we interpret
 * that subset here.
 *
 * We deliberately do NOT bundle `@a2ui/react` on the client: its source ships
 * untranspiled and uses `import ... with { type: 'json' }` import attributes,
 * which this webpack toolchain can't parse. a2ui lives on the server (where it
 * generates and validates these surfaces); the client just renders them.
 */

interface SurfaceComponent {
  component: string;
  id?: string;
  child?: string;
  children?: string[];
  text?: unknown;
  [key: string]: unknown;
}

interface A2uiMessage {
  version: string;
  createSurface?: { surfaceId: string; catalogId: string };
  updateComponents?: { surfaceId: string; components: SurfaceComponent[] };
}

/** a2ui DynamicString -> string. We only emit literal strings server-side. */
function resolveText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'path' in (value as any)) {
    return String((value as any).path);
  }
  return value == null ? '' : String(value);
}

class SurfaceErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[a2ui] failed to render surface:', error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children as any;
  }
}

function RenderNode({
  id,
  byId,
  depth,
}: {
  id: string;
  byId: Map<string, SurfaceComponent>;
  depth: number;
}) {
  if (depth > 24) return null;
  const node = byId.get(id);
  if (!node) return null;

  const renderChild = (childId: string) => (
    <RenderNode key={childId} id={childId} byId={byId} depth={depth + 1} />
  );

  switch (node.component) {
    case 'Card':
      return (
        <Card>
          <CardContent className="p-3 text-sm">
            {node.child ? renderChild(node.child) : null}
          </CardContent>
        </Card>
      );
    case 'Column':
      return (
        <div
          className={cn(
            'flex flex-col gap-1',
            node.align === 'center' && 'items-center',
            node.align === 'end' && 'items-end'
          )}
        >
          {(node.children ?? []).map(renderChild)}
        </div>
      );
    case 'Row':
      return (
        <div className="flex flex-row flex-wrap gap-2">
          {(node.children ?? []).map(renderChild)}
        </div>
      );
    case 'Divider':
      return <Separator className="my-1" />;
    case 'Text':
      return (
        <span
          className={cn(
            id === 'title' && 'font-medium',
            id.startsWith('hl-') && 'text-xs text-muted-foreground'
          )}
        >
          {resolveText(node.text)}
        </span>
      );
    default:
      // Unknown component: best-effort render of its children.
      if (node.children) {
        return <div className="space-y-1">{node.children.map(renderChild)}</div>;
      }
      return node.child ? renderChild(node.child) : null;
  }
}

function SurfaceRenderer({ messages }: { messages: A2uiMessage[] }) {
  const components = React.useMemo(() => {
    const byId = new Map<string, SurfaceComponent>();
    for (const msg of messages) {
      for (const c of msg.updateComponents?.components ?? []) {
        if (c.id) byId.set(c.id, c);
      }
    }
    return byId;
  }, [messages]);

  if (!components.has('root')) return null;
  return <RenderNode id="root" byId={components} depth={0} />;
}

export function A2uiSurfaceView({ messages }: { messages: any[] }) {
  return (
    <SurfaceErrorBoundary>
      <SurfaceRenderer messages={messages as A2uiMessage[]} />
    </SurfaceErrorBoundary>
  );
}
