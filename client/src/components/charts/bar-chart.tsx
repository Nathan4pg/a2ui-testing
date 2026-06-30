import * as React from 'react';
import { Bar, BarChart as ReBarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface SeriesDef {
  key: string;
  label?: string;
  color?: string;
}

interface BarChartCardProps {
  title?: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  /** Key on each datum used for the X axis category. */
  xKey: string;
  /** One or more numeric series to plot as bars. */
  series: SeriesDef[];
  className?: string;
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function BarChartCard({
  title = 'Bar chart',
  description,
  data,
  xKey,
  series,
  className,
}: BarChartCardProps) {
  const chartConfig: ChartConfig = series.reduce<ChartConfig>((acc, s, i) => {
    acc[s.key] = {
      label: s.label ?? s.key,
      color: s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    };
    return acc;
  }, {});

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="max-h-[260px] w-full">
          <ReBarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.length > 1 ? (
              <ChartLegend content={<ChartLegendContent />} />
            ) : null}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={`var(--color-${s.key})`}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </ReBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
