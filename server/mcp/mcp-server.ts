import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'http';

import { tools } from './tools';

/**
 * Build a fresh MCP server with the full tool catalog registered.
 * Tools return their result as a single JSON text block so any MCP client
 * (including our own in-process agent) gets a stable, parseable shape.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agent-side-panel-mcp',
    version: '1.0.0',
  });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputShape,
      },
      async (args: unknown) => {
        const result = await tool.handler(args ?? {});
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        };
      }
    );
  }

  return server;
}

/**
 * Handle a Streamable HTTP MCP request in stateless mode: a brand-new server
 * and transport are created per request and disposed when the response closes.
 * This keeps the MCP endpoint simple and horizontally scalable.
 */
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  parsedBody: unknown
): Promise<void> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req as any, res as any, parsedBody);
}
