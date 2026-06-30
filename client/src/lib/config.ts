/**
 * Where the local ag-ui / MCP server lives. The server defaults to port 4111
 * (see server/mcp/config.ts). Override by setting `agentBaseUrl` in
 * chrome.storage.local if you run it elsewhere.
 */
export const DEFAULT_AGENT_BASE_URL = 'http://localhost:4111';

export function agentUrl(base: string = DEFAULT_AGENT_BASE_URL): string {
  return `${base.replace(/\/$/, '')}/agent`;
}
