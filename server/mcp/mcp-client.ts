import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createMcpServer } from './mcp-server';
import type { ToolResult } from './tools';

/**
 * A process-local MCP client wired to an in-process MCP server over an
 * in-memory transport. The agent talks to its tools *through MCP* rather than
 * calling handlers directly, so the same code path a remote MCP client would
 * use is exercised on every turn.
 */
let clientPromise: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const server = createMcpServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: 'agent-side-panel-host', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

export function getMcpClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connect().catch((err) => {
      clientPromise = null; // allow retry on next call
      throw err;
    });
  }
  return clientPromise;
}

/** Ollama's tool schema shape. */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** List MCP tools and convert them to Ollama tool definitions. */
export async function listOllamaTools(): Promise<OllamaTool[]> {
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: (t.inputSchema as Record<string, unknown>) ?? {
        type: 'object',
        properties: {},
      },
    },
  }));
}

/** Call an MCP tool by name and parse its JSON ToolResult payload. */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const client = await getMcpClient();
  const res: any = await client.callTool({ name, arguments: args });
  const text = res?.content?.[0]?.text ?? '{}';
  try {
    return JSON.parse(text) as ToolResult;
  } catch {
    return { summary: String(text), data: null };
  }
}
