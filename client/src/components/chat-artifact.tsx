import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChartCard, PieDatum } from '@/components/charts/pie-chart';
import { LineChartCard } from '@/components/charts/line-chart';
import { BarChartCard } from '@/components/charts/bar-chart';
import { DataTable } from '@/components/data-table/data-table';
import type { ArtifactItem } from '@/store/chat-store';

type Row = Record<string, string | number>;

/** Infer the category (x) key and numeric series from a row set. */
function inferAxes(rows: Row[]) {
  const first = rows[0] ?? {};
  const keys = Object.keys(first);
  const xKey = keys.find((k) => typeof first[k] === 'string') ?? keys[0];
  const series = keys
    .filter((k) => k !== xKey && typeof first[k] === 'number')
    .map((k) => ({ key: k, label: k }));
  return { xKey, series };
}

function genericColumns(rows: Row[]): ColumnDef<Row>[] {
  const keys = Object.keys(rows[0] ?? {});
  return keys.map((k) => ({ accessorKey: k, header: k }));
}

/**
 * Renders a tool result inline in the chat as the appropriate shadcn chart or
 * data table (the same components the Dashboard uses).
 */
export function ChatArtifact({ artifact }: { artifact: ArtifactItem }) {
  const { render, data, summary, tool } = artifact;

  if (render === 'kpi' && data && typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{tool}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {entries.map(([k, v]) => (
            <div key={k} className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="text-base font-semibold">{String(v)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const rows = Array.isArray(data) ? (data as Row[]) : [];
  if (!rows.length) return null;

  if (render === 'pie') {
    const pieData: PieDatum[] = rows.map((r) => ({
      name: String(r.name),
      value: Number(r.value),
    }));
    return <PieChartCard title="Breakdown" data={pieData} />;
  }

  if (render === 'table') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{summary || tool}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={genericColumns(rows)} data={rows} />
        </CardContent>
      </Card>
    );
  }

  const { xKey, series } = inferAxes(rows);
  if (!series.length) return null;

  if (render === 'bar') {
    return <BarChartCard title="Comparison" data={rows} xKey={xKey} series={series} />;
  }

  // default: line
  return <LineChartCard title="Trend" data={rows} xKey={xKey} series={series} />;
}
