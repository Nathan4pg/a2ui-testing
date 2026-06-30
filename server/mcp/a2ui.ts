import { A2uiMessageListSchema } from '@a2ui/web_core/v0_9';

import type { ToolResult } from './tools';

/**
 * Server-side a2ui (Agent-to-Agent UI) surface generation.
 *
 * For every tool result we build a small, declarative a2ui v0.9 surface
 * (Card > Column > Text...) describing the result. The surface is validated
 * against the official a2ui schema before being streamed to the client, where
 * `@a2ui/react`'s `A2uiSurface` renders it with the `basicCatalog`.
 *
 * The `catalogId` MUST match the id of the catalog registered on the client
 * (`basicCatalog.id`).
 */
export const A2UI_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/basic_catalog.json';

// Loosely typed here; validated at runtime by A2uiMessageListSchema.
type A2uiMessage = Record<string, any>;

interface SurfaceComponent {
  component: string;
  id?: string;
  [key: string]: unknown;
}

/** Turn a tool result into a short list of "label: value" highlight strings. */
function highlightsFor(result: ToolResult): string[] {
  const { data } = result;
  if (Array.isArray(data)) {
    return data
      .slice(0, 5)
      .map((row) => {
        if (row && typeof row === 'object') {
          const entries = Object.entries(row as Record<string, unknown>);
          return entries.map(([k, v]) => `${k}: ${v}`).join('  ·  ');
        }
        return String(row);
      });
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v}`);
  }
  return [];
}

/**
 * Build (and validate) the a2ui messages that render a tool result as a card.
 * Returns null if the surface fails schema validation (so the caller can fall
 * back to native rendering instead of emitting an invalid surface).
 */
export function buildToolResultSurface(
  surfaceId: string,
  title: string,
  result: ToolResult
): A2uiMessage[] | null {
  const highlights = highlightsFor(result);

  const textComponents: SurfaceComponent[] = [];
  const childIds: string[] = [];

  // Title + summary.
  textComponents.push({ component: 'Text', id: 'title', text: title });
  childIds.push('title');
  textComponents.push({
    component: 'Text',
    id: 'summary',
    text: result.summary,
  });
  childIds.push('summary');

  // Highlight rows.
  highlights.forEach((line, i) => {
    const id = `hl-${i}`;
    textComponents.push({ component: 'Text', id, text: line });
    childIds.push(id);
  });

  const messages: A2uiMessage[] = [
    {
      version: 'v0.9',
      createSurface: { surfaceId, catalogId: A2UI_CATALOG_ID },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [
          { component: 'Card', id: 'root', child: 'col' },
          { component: 'Column', id: 'col', children: childIds, align: 'start' },
          ...textComponents,
        ],
      },
    },
  ];

  const parsed = A2uiMessageListSchema.safeParse(messages);
  if (!parsed.success) {
    console.warn('[a2ui] surface failed validation:', parsed.error.issues?.[0]);
    return null;
  }
  return messages;
}
