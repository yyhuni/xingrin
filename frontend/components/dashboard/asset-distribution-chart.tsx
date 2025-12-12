"use client"

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"
import { useAssetStatistics } from "@/hooks/use-dashboard"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"

// 使用 CSS 变量，跟随主题变化
const COLORS = {
  subdomain: "var(--chart-1)",
  ip: "var(--chart-2)",
  endpoint: "var(--chart-3)",
  website: "var(--chart-4)",
}

const chartConfig = {
  count: {
    label: "数量",
  },
  subdomain: {
    label: "子域名",
    color: COLORS.subdomain,
  },
  ip: {
    label: "IP地址",
    color: COLORS.ip,
  },
  endpoint: {
    label: "端点",
    color: COLORS.endpoint,
  },
  website: {
    label: "网站",
    color: COLORS.website,
  },
} satisfies ChartConfig

export function AssetDistributionChart() {
  const { data, isLoading } = useAssetStatistics()

  const chartData = [
    { name: "子域名", count: data?.totalSubdomains ?? 0, fill: COLORS.subdomain },
    { name: "IP地址", count: data?.totalIps ?? 0, fill: COLORS.ip },
    { name: "端点", count: data?.totalEndpoints ?? 0, fill: COLORS.endpoint },
    { name: "网站", count: data?.totalWebsites ?? 0, fill: COLORS.website },
  ]

  const total = chartData.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>资产分布</CardTitle>
        <CardDescription>各类资产数量统计</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-8 w-2/5" />
          </div>
        ) : (
          <>
          <ChartContainer config={chartConfig} className="aspect-auto h-[160px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 30 }}
            >
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={50}
              />
              <XAxis dataKey="count" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar
                dataKey="count"
                layout="vertical"
                radius={4}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  offset={8}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="mt-3 pt-3 border-t flex items-center justify-end gap-1.5 text-sm">
            <span className="text-muted-foreground">资产总计：</span>
            <span className="font-semibold">{total}</span>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
