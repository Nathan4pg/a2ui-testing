import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChartCard } from '@/components/charts/pie-chart';
import { LineChartCard } from '@/components/charts/line-chart';
import { BarChartCard } from '@/components/charts/bar-chart';
import { DataTable } from '@/components/data-table/data-table';
import type { Datasets } from '@/store/chat-store';

interface Order {
  id: string;
  customer: string;
  status: string;
  amount: number;
}

// Seed data so the dashboard is populated before the agent runs. Live tool
// results from the chat replace these.
const SEED = {
  kpi: { revenue: 128400, revenueChangePct: 12.5, activeUsers: 4820, conversionRate: 3.4 },
  line: [
    { month: 'Mar', revenue: 60000, expenses: 38000 },
    { month: 'Apr', revenue: 75000, expenses: 43200 },
    { month: 'May', revenue: 82000, expenses: 48400 },
    { month: 'Jun', revenue: 97000, expenses: 53600 },
    { month: 'Jul', revenue: 104000, expenses: 58800 },
    { month: 'Aug', revenue: 119000, expenses: 64000 },
  ],
  bar: [
    { region: 'N. America', sales: 52000 },
    { region: 'Europe', sales: 41000 },
    { region: 'APAC', sales: 33500 },
    { region: 'LATAM', sales: 18200 },
    { region: 'MEA', sales: 9400 },
  ],
  pie: [
    { name: 'Organic', value: 38 },
    { name: 'Direct', value: 24 },
    { name: 'Referral', value: 18 },
    { name: 'Social', value: 12 },
    { name: 'Paid', value: 8 },
  ],
  table: [
    { id: 'ORD-1042', customer: 'Acme Co', status: 'paid', amount: 1240 },
    { id: 'ORD-1041', customer: 'Globex', status: 'pending', amount: 880 },
    { id: 'ORD-1040', customer: 'Initech', status: 'paid', amount: 3120 },
    { id: 'ORD-1039', customer: 'Umbrella', status: 'refunded', amount: 540 },
    { id: 'ORD-1038', customer: 'Soylent', status: 'paid', amount: 2025 },
  ] as Order[],
};

const orderColumns: ColumnDef<Order>[] = [
  { accessorKey: 'id', header: 'Order' },
  { accessorKey: 'customer', header: 'Customer' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant =
        status === 'paid'
          ? 'default'
          : status === 'refunded'
          ? 'destructive'
          : 'secondary';
      return <Badge variant={variant as any}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono">
        ${(row.getValue('amount') as number).toLocaleString()}
      </div>
    ),
  },
];

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{value}</div>
        {delta !== undefined ? (
          <div
            className={`mt-1 flex items-center text-xs ${
              up ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {up ? (
              <ArrowUpRight className="mr-0.5 h-3 w-3" />
            ) : (
              <ArrowDownRight className="mr-0.5 h-3 w-3" />
            )}
            {Math.abs(delta)}% MoM
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function Dashboard({ datasets }: { datasets: Datasets }) {
  const kpi = (datasets.kpi?.data as typeof SEED.kpi) ?? SEED.kpi;
  const line = (datasets.line?.data as typeof SEED.line) ?? SEED.line;
  const bar = (datasets.bar?.data as typeof SEED.bar) ?? SEED.bar;
  const pie = (datasets.pie?.data as typeof SEED.pie) ?? SEED.pie;
  const table = (datasets.table?.data as Order[]) ?? SEED.table;

  return (
    <div className="space-y-4 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          label="Revenue"
          value={`$${kpi.revenue.toLocaleString()}`}
          delta={kpi.revenueChangePct}
        />
        <Kpi label="Active users" value={kpi.activeUsers.toLocaleString()} />
        <Kpi label="Conversion" value={`${kpi.conversionRate}%`} />
        <Kpi
          label="Avg. order"
          value={`$${Math.round(
            table.reduce((s, o) => s + o.amount, 0) / Math.max(table.length, 1)
          ).toLocaleString()}`}
        />
      </div>

      <LineChartCard
        title="Revenue vs. expenses"
        description="Monthly, last 6 months"
        data={line}
        xKey="month"
        series={[
          { key: 'revenue', label: 'Revenue' },
          { key: 'expenses', label: 'Expenses' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4">
        <BarChartCard
          title="Sales by region"
          data={bar}
          xKey="region"
          series={[{ key: 'sales', label: 'Sales' }]}
        />
        <PieChartCard
          title="Traffic by channel"
          description="Share of sessions"
          data={pie}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={orderColumns}
            data={table}
            filterColumn="customer"
            filterPlaceholder="Filter customers…"
          />
        </CardContent>
      </Card>
    </div>
  );
}
