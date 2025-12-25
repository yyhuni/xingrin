"use client"

import { Pie, PieChart, Cell, Label } from "recharts"
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

// 漏洞严重程度使用固定语义化颜色
const chartConfig = {
  count: {
    label: "Count",
  },
  critical: {
    label: "Critical",
    color: "#dc2626", // 红色
  },
  high: {
    label: "High",
    color: "#f97316", // 橙色
  },
  medium: {
    label: "Medium",
    color: "#eab308", // 黄色
  },
  low: {
    label: "Low",
    color: "#3b82f6", // 蓝色
  },
  info: {
    label: "Info",
    color: "#6b7280", // 灰色
  },
} satisfies ChartConfig

export function VulnSeverityChart() {
  const { data, isLoading } = useAssetStatistics()

  const vulnData = data?.vulnBySeverity
  const allData = [
    { severity: "critical", count: vulnData?.critical ?? 0, fill: chartConfig.critical.color },
    { severity: "high", count: vulnData?.high ?? 0, fill: chartConfig.high.color },
    { severity: "medium", count: vulnData?.medium ?? 0, fill: chartConfig.medium.color },
    { severity: "low", count: vulnData?.low ?? 0, fill: chartConfig.low.color },
    { severity: "info", count: vulnData?.info ?? 0, fill: chartConfig.info.color },
  ]
  // 饼图只显示有数据的
  const chartData = allData.filter(item => item.count > 0)

  const total = allData.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>漏洞分布</CardTitle>
        <CardDescription>按严重程度统计</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[180px]">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
          </div>
        ) : total === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-muted-foreground">
            暂无漏洞数据
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <ChartContainer config={chartConfig} className="aspect-square h-[140px]">
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="severity" hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="severity"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.severity} fill={entry.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-2xl font-bold"
                            >
                              {total}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 18}
                              className="fill-muted-foreground text-xs"
                            >
                              漏洞
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-3 pt-3 border-t flex flex-wrap justify-end gap-x-4 gap-y-1.5 text-sm">
              {allData.map((item) => (
                <div key={item.severity} className="flex items-center gap-1.5">
                  <div 
                    className="h-2.5 w-2.5 rounded-full" 
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className={item.count > 0 ? "text-foreground" : "text-muted-foreground"}>
                    {chartConfig[item.severity as keyof typeof chartConfig]?.label}
                  </span>
                  <span className={item.count > 0 ? "font-medium" : "text-muted-foreground"}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
