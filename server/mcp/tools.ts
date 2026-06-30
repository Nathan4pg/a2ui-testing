import { z } from 'zod';

/**
 * The agent's tool catalog. This is the single source of truth that is:
 *   1. registered on the MCP server (so any MCP client can call them), and
 *   2. converted to Ollama tool schemas (so the local model can call them), and
 *   3. used to drive the dashboard charts/table on the client.
 *
 * The data here is deterministic mock data — this is a boilerplate, so there is
 * no real warehouse behind it. Swap the handlers for real queries as needed.
 */

export interface ToolDefinition {
  name: string;
  /** Short, user-facing title (used as the a2ui card heading). */
  label: string;
  description: string;
  /** Zod raw shape passed straight to MCP's registerTool inputSchema. */
  inputShape: Record<string, z.ZodTypeAny>;
  handler: (args: any) => Promise<ToolResult> | ToolResult;
}

export interface ToolResult {
  /** Human-readable summary the model can narrate. */
  summary: string;
  /** Structured payload used to render charts/tables and a2ui surfaces. */
  data: unknown;
  /** Which visualization the client should prefer for this payload. */
  render?: 'kpi' | 'line' | 'bar' | 'pie' | 'table';
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const tools: ToolDefinition[] = [
  {
    name: 'get_kpi_summary',
    label: 'KPI summary',
    description:
      'Get headline KPIs (total revenue, active users, conversion rate, growth) for the current period.',
    inputShape: {},
    handler: () => ({
      summary:
        'Revenue is $128,400 (+12.5% MoM), 4,820 active users, 3.4% conversion rate.',
      render: 'kpi',
      data: {
        revenue: 128400,
        revenueChangePct: 12.5,
        activeUsers: 4820,
        conversionRate: 3.4,
      },
    }),
  },
  {
    name: 'get_revenue_timeseries',
    label: 'Revenue vs. expenses',
    description:
      'Get monthly revenue and expenses over the last N months (1-12, defaults to 6). Useful for a line chart of trends; use 12 for a full year.',
    inputShape: { months: z.number().int().min(1).max(12).optional() },
    handler: ({ months }: { months?: number }) => {
      const n = Math.min(Math.max(months ?? 6, 1), MONTHS.length);
      const data = MONTHS.slice(-n).map((month, i) => ({
        month,
        revenue: 60000 + i * 11000 + (i % 2) * 4000,
        expenses: 38000 + i * 5200,
      }));
      return {
        summary: `Revenue grew from $${data[0].revenue.toLocaleString()} to $${data[
          data.length - 1
        ].revenue.toLocaleString()} over ${n} months.`,
        render: 'line',
        data,
      };
    },
  },
  {
    name: 'get_sales_by_region',
    label: 'Sales by region',
    description:
      'Get total sales broken down by region. Useful for a bar chart comparison.',
    inputShape: {},
    handler: () => ({
      summary: 'North America leads with $52k, followed by Europe at $41k.',
      render: 'bar',
      data: [
        { region: 'N. America', sales: 52000 },
        { region: 'Europe', sales: 41000 },
        { region: 'APAC', sales: 33500 },
        { region: 'LATAM', sales: 18200 },
        { region: 'MEA', sales: 9400 },
      ],
    }),
  },
  {
    name: 'get_traffic_by_channel',
    label: 'Traffic by channel',
    description:
      'Get the share of traffic by acquisition channel. Useful for a pie chart.',
    inputShape: {},
    handler: () => ({
      summary:
        'Organic search drives the largest share (38%), then direct (24%).',
      render: 'pie',
      data: [
        { name: 'Organic', value: 38 },
        { name: 'Direct', value: 24 },
        { name: 'Referral', value: 18 },
        { name: 'Social', value: 12 },
        { name: 'Paid', value: 8 },
      ],
    }),
  },
  {
    name: 'list_recent_orders',
    label: 'Recent orders',
    description:
      'List the most recent orders with customer, status, and amount. Useful for a data table.',
    inputShape: { limit: z.number().int().min(1).max(50).optional() },
    handler: ({ limit }: { limit?: number }) => {
      const all = [
        { id: 'ORD-1042', customer: 'Acme Co', status: 'paid', amount: 1240 },
        { id: 'ORD-1041', customer: 'Globex', status: 'pending', amount: 880 },
        { id: 'ORD-1040', customer: 'Initech', status: 'paid', amount: 3120 },
        { id: 'ORD-1039', customer: 'Umbrella', status: 'refunded', amount: 540 },
        { id: 'ORD-1038', customer: 'Soylent', status: 'paid', amount: 2025 },
        { id: 'ORD-1037', customer: 'Hooli', status: 'pending', amount: 1599 },
        { id: 'ORD-1036', customer: 'Stark Ind', status: 'paid', amount: 4810 },
        { id: 'ORD-1035', customer: 'Wayne Ent', status: 'paid', amount: 760 },
      ];
      const rows = all.slice(0, limit ?? 8);
      return {
        summary: `${rows.length} recent orders, ${
          rows.filter((r) => r.status === 'paid').length
        } paid.`,
        render: 'table',
        data: rows,
      };
    },
  },
];

export const toolByName = (name: string) => tools.find((t) => t.name === name);
