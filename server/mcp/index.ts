import express from 'express';
import cors from 'cors';
import type { RunAgentInput } from '@ag-ui/core';

import { config } from './config';
import { runAgent } from './ollama-agent';
import { handleMcpRequest } from './mcp-server';
import { getMcpClient } from './mcp-client';

/** Match an Origin against patterns that may contain a trailing `*` wildcard. */
function originAllowed(origin: string): boolean {
  return config.corsOrigins.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) return origin.startsWith(pattern.slice(0, -1));
    return origin === pattern;
  });
}

function buildApp() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow non-browser callers (no Origin) and matching origins.
        if (!origin || originAllowed(origin)) return callback(null, true);
        return callback(null, false);
      },
    })
  );
  app.use(express.json({ limit: '4mb' }));

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      model: config.ollamaModel,
      ollamaHost: config.ollamaHost,
    });
  });

  // ag-ui agent endpoint: streams ag-ui events (SSE) for one run.
  app.post('/agent', (req, res) => {
    runAgent(req.body as RunAgentInput, res);
  });

  // MCP Streamable HTTP endpoint (stateless). Tools are also reachable here by
  // any standard MCP client.
  app.post('/mcp', (req, res) => {
    handleMcpRequest(req, res, req.body).catch((err) => {
      console.error('[mcp] request error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'mcp_error' });
    });
  });
  // GET/DELETE are part of the Streamable HTTP spec; in stateless mode there is
  // no session to resume, so respond 405 per the SDK convention.
  app.get('/mcp', (_req, res) =>
    res.status(405).json({ error: 'method_not_allowed' })
  );
  app.delete('/mcp', (_req, res) =>
    res.status(405).json({ error: 'method_not_allowed' })
  );

  return app;
}

/**
 * Service object compatible with the existing boot sequence in src/index.js.
 * Initializing it starts the MCP/ag-ui HTTP server and warms the in-process
 * MCP client so tools are ready before the first chat request.
 */
const mcpService = {
  init: async () => {
    const app = buildApp();
    await new Promise<void>((resolve) => {
      app.listen(config.port, () => {
        console.log(
          `[MCP] ag-ui + MCP server listening on http://localhost:${config.port}`
        );
        console.log(
          `[MCP] agent endpoint: POST /agent  |  mcp endpoint: POST /mcp`
        );
        resolve();
      });
    });

    // Warm the MCP client (connects in-process server) and verify Ollama model.
    try {
      const client = await getMcpClient();
      const { tools } = await client.listTools();
      console.log(
        `[MCP] ${tools.length} tools registered: ${tools
          .map((t) => t.name)
          .join(', ')}`
      );
      console.log(
        `[MCP] using Ollama model "${config.ollamaModel}" at ${config.ollamaHost}`
      );
    } catch (err) {
      console.warn('[MCP] tool warmup failed (continuing):', err);
    }
  },
};

export default mcpService;

// Allow running this module directly: `tsx mcp/index.ts` or `node -r sucrase/register mcp/index.ts`.
if (require.main === module) {
  mcpService.init().catch((err) => {
    console.error('[MCP] failed to start:', err);
    process.exit(1);
  });
}
