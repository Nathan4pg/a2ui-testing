/**
 * Central configuration for the MCP + ag-ui + Ollama layer.
 * Everything is overridable through environment variables so the server can be
 * pointed at a different Ollama host/model without code changes.
 */
export const config = {
  /** Port the MCP / ag-ui HTTP server listens on (decoupled from the DB server). */
  port: Number(process.env.MCP_PORT || 4111),

  /** Local Ollama runtime. Matches `ollama run qwen3.5-8k:latest`. */
  ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen3.5-8k:latest',

  /** Max agent <-> tool round trips before we force a final answer. */
  maxToolRoundtrips: Number(process.env.MCP_MAX_ROUNDTRIPS || 4),

  /** Origins allowed to call the agent endpoint (the extension + local dev). */
  corsOrigins: (
    process.env.MCP_CORS_ORIGINS ||
    'chrome-extension://*,http://localhost:*,http://127.0.0.1:*'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export type AppConfig = typeof config;
