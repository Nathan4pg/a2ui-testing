import * as React from 'react';
import { Pie, PieChart as RePieChart, Cell } from 'recharts';

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

export interface PieDatum {
  name: string;
  value: number;
  fill?: string;
}

interface PieChartCardProps {
  title?: string;
  description?: string;
  data: PieDatum[];
  config?: ChartConfig;
  /** Render as a donut with a hole. */
  donut?: boolean;
  className?: string;
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function PieChartCard({
  title = 'Distribution',
  description,
  data,
  config,
  donut = true,
  className,
}: PieChartCardProps) {
  const chartConfig: ChartConfig =
    config ??
    data.reduce<ChartConfig>((acc, d, i) => {
      acc[d.name] = {
        label: d.name,
        color: d.fill ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      };
      return acc;
    }, {});

  return (
    <Card className={className}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[260px]"
        >
          <RePieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={donut ? 55 : 0}
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.fill ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                  }
                />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </RePieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
