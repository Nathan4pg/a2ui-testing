import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  XAxis,
  YAxis,
} from 'recharts';

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

interface LineChartCardProps {
  title?: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  /** Key on each datum used for the X axis. */
  xKey: string;
  /** One or more numeric series to plot as lines. */
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

export function LineChartCard({
  title = 'Trend',
  description,
  data,
  xKey,
  series,
  className,
}: LineChartCardProps) {
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
          <ReLineChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            {series.length > 1 ? (
              <ChartLegend content={<ChartLegendContent />} />
            ) : null}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </ReLineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
