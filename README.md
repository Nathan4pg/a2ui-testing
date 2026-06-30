# Agent Side Panel

A Chrome **side panel** extension with a ChatGPT-style agent chat and a live
analytics dashboard, backed by a local **Ollama** model exposed through an
**MCP** server that streams **ag-ui** events.

```
┌─────────────────────────┐         ag-ui events (SSE)        ┌──────────────────────────┐
│  client/ (Chrome ext)   │  ── POST /agent ───────────────▶ │  server/ (Express + MCP)  │
│  • React 19 + shadcn/ui │  ◀── TEXT_MESSAGE / TOOL_CALL ── │  • MCP server (tools)     │
│  • side panel home page │       / CUSTOM(a2ui) events       │  • ag-ui encoder          │
│  • @ag-ui/client        │                                   │  • Ollama (qwen3.5-8k)    │
└─────────────────────────┘                                   └──────────────────────────┘
```

- **`client/`** — Manifest V3 extension (webpack), React 19 + TypeScript 6,
  Tailwind + the full shadcn/ui component set, charts (pie/line/bar via
  recharts) and a `@tanstack/react-table` data table. The home page lives in the
  side panel and has a **Chat** tab and a **Dashboard** tab.
- **`server/`** — Express app whose `mcp/` folder hosts an MCP server (official
  TypeScript SDK), an ag-ui event stream, and an Ollama-backed agent. Tool calls
  the model makes are routed **through MCP**; results stream back as ag-ui
  events (and validated **a2ui** v0.9 surfaces).

---

## Prerequisites

- **Node.js 20+** (developed on Node 23).
- **Google Chrome** (or any Chromium browser with side panel support).
- **[Ollama](https://ollama.com)** running locally with the required model:

  ```bash
  ollama pull qwen3.5-8k:latest
  ollama run qwen3.5-8k:latest      # or just: ollama serve
  ```

  Override the model/host with the `OLLAMA_MODEL` / `OLLAMA_HOST` env vars.

---

## 1. Start the server (MCP + ag-ui + Ollama)

```bash
cd server
npm install
cp .env.example .env        # optional — sensible defaults are built in
npm run dev                 # full boot (MCP + Express; DB/AWS are optional)
# or, MCP/agent only:
npm run mcp
```

The MCP / ag-ui server listens on **http://localhost:4111**:

| Endpoint        | Purpose                                                    |
| --------------- | ---------------------------------------------------------- |
| `POST /agent`   | ag-ui event stream (SSE) — the chat endpoint               |
| `POST /mcp`     | MCP Streamable HTTP — tools reachable by any MCP client    |
| `GET  /health`  | Status + active model                                      |

Quick check:

```bash
curl http://localhost:4111/health
# {"ok":true,"model":"qwen3.5-8k:latest","ollamaHost":"http://127.0.0.1:11434"}
```

> The MCP layer starts first and is required; the database/AWS services are
> optional — if they aren't configured the server logs a warning and keeps
> running, so you can use the agent without a database.

### Server environment variables

| Variable            | Default                     | Description                       |
| ------------------- | --------------------------- | --------------------------------- |
| `MCP_PORT`          | `4111`                      | MCP / ag-ui HTTP port             |
| `OLLAMA_HOST`       | `http://127.0.0.1:11434`    | Ollama runtime URL                |
| `OLLAMA_MODEL`      | `qwen3.5-8k:latest`         | Model used by the agent           |
| `MCP_MAX_ROUNDTRIPS`| `4`                         | Max agent ⇄ tool round trips      |
| `MCP_CORS_ORIGINS`  | `chrome-extension://*,http://localhost:*,http://127.0.0.1:*` | Allowed origins |

---

## 2. Build & load the extension

```bash
cd client
npm install
npm run build               # outputs to client/build/
```

Then load it into Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select **`client/build`**.
4. Click the extension's toolbar icon to open the **side panel**.

For iterative development with hot reload:

```bash
cd client
npm start                   # webpack dev server; reload the unpacked extension as files change
```

---

## Using it

- Open the side panel and ask the agent things like:
  - _"Show me the traffic breakdown by channel"_ → pie chart
  - _"How is revenue trending?"_ → line chart
  - _"Compare sales by region"_ → bar chart
  - _"List the most recent orders"_ → data table
- The model calls MCP tools to fetch data; the **Dashboard** tab updates live
  from the tool results, and the **Chat** tab streams the model's narration plus
  server-rendered a2ui cards.

The dashboard ships with seed data, so it's populated before you send the first
message.

---

## Tech notes

- **Pinned versions (do not change):** `@a2ui/react@0.9.1`,
  `@ag-ui/core@0.0.53`, `@ag-ui/client@0.0.53`, `@ag-ui/encoder@0.0.53`,
  `@ag-ui/proto@0.0.53`.
- The server runs via `node -r sucrase/register` (TypeScript without a separate
  build step); `npm run mcp` uses `tsx`.
- The client renders a2ui surfaces with a small built-in interpreter rather than
  bundling `@a2ui/react` (its source uses import attributes webpack can't parse);
  a2ui itself lives on the server.

---

## Project layout

```
client/
  src/
    components/ui/         # full shadcn/ui component set
    components/charts/     # pie / line / bar chart wrappers (recharts)
    components/data-table/ # generic @tanstack/react-table data table
    components/a2ui-surface.tsx
    hooks/use-agent-chat.ts
    pages/SidePanel/       # Home (Chat + Dashboard), entry, html
    manifest.json
server/
  mcp/
    index.ts        # Express app: /agent, /mcp, /health
    mcp-server.ts   # MCP server + tool registration
    mcp-client.ts   # in-process MCP client + Ollama tool conversion
    ollama-agent.ts # Ollama-driven ag-ui event stream
    tools.ts        # tool catalog (source of truth)
    a2ui.ts         # a2ui v0.9 surface builder + validation
    config.ts
  src/index.js      # boot sequence (MCP required; DB/AWS optional)
```
