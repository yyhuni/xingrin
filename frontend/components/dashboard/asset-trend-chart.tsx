"use client"

import { useState, useMemo } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { useStatisticsHistory } from "@/hooks/use-dashboard"
import type { StatisticsHistoryItem } from "@/types/dashboard.types"

/**
 * 填充缺失的日期数据，确保始终返回完整的 days 天
 * 以最早一条记录的日期为基准，往前补齐，缺失的日期填充 0
 */
function fillMissingDates(data: StatisticsHistoryItem[] | undefined, days: number): StatisticsHistoryItem[] {
  if (!data || data.length === 0) return []
  
  // 构建日期到数据的映射
  const dataMap = new Map(data.map(item => [item.date, item]))
  
  // 找到最早的日期
  const earliestDate = new Date(data[0].date)
  
  // 生成完整的日期列表（从最早日期往前 days-1 天开始）
  const result: StatisticsHistoryItem[] = []
  const startDate = new Date(earliestDate)
  startDate.setDate(startDate.getDate() - (days - data.length))
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    const dateStr = currentDate.toISOString().split('T')[0]
    
    const existing = dataMap.get(dateStr)
    if (existing) {
      result.push(existing)
    } else {
      // 缺失的日期填充 0
      result.push({
        date: dateStr,
        totalTargets: 0,
        totalSubdomains: 0,
        totalIps: 0,
        totalEndpoints: 0,
        totalWebsites: 0,
        totalVulns: 0,
        totalAssets: 0,
      })
    }
  }
  
  return result
}
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
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"

const chartConfig = {
  totalSubdomains: {
    label: "子域名",
    color: "#3b82f6", // 蓝色
  },
  totalIps: {
    label: "IP",
    color: "#f97316", // 橙色
  },
  totalEndpoints: {
    label: "端点",
    color: "#eab308", // 黄色
  },
  totalWebsites: {
    label: "网站",
    color: "#22c55e", // 绿色
  },
} satisfies ChartConfig

// 数据系列的 key 类型
type SeriesKey = 'totalSubdomains' | 'totalIps' | 'totalEndpoints' | 'totalWebsites'

// 所有系列
const ALL_SERIES: SeriesKey[] = ['totalSubdomains', 'totalIps', 'totalEndpoints', 'totalWebsites']

export function AssetTrendChart() {
  const { data: rawData, isLoading } = useStatisticsHistory(7)
  const [activeData, setActiveData] = useState<StatisticsHistoryItem | null>(null)
  
  // 可见系列状态（默认全部显示）
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(new Set(ALL_SERIES))
  
  // 当前悬停的折线
  const [hoveredLine, setHoveredLine] = useState<SeriesKey | null>(null)
  
  // 切换系列可见性
  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        // 至少保留一个可见
        if (next.size > 1) {
          next.delete(key)
        }
      } else {
        next.add(key)
      }
      return next
    })
  }

  // 填充缺失的日期，确保始终显示7天
  const data = useMemo(() => fillMissingDates(rawData, 7), [rawData])

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  // 获取最新数据（使用原始数据中的最新值）
  const latest = rawData && rawData.length > 0 ? rawData[rawData.length - 1] : null
  
  // 显示的数据：悬停时显示悬停数据，否则显示最新数据
  const displayData = activeData || latest

  return (
    <Card>
      <CardHeader>
        <CardTitle>资产趋势</CardTitle>
        <CardDescription>近 7 天各类资产变化 · 点击折线或图例可隐藏/显示</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[180px] w-full" />
          </div>
        ) : !rawData || rawData.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-muted-foreground">
            暂无历史数据
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="aspect-auto h-[160px] w-full">
              <LineChart
                accessibilityLayer
                data={data}
                margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
                onMouseMove={(state) => {
                  if (state?.activePayload?.[0]?.payload) {
                    setActiveData(state.activePayload[0].payload)
                  }
                }}
                onMouseLeave={() => setActiveData(null)}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={formatDate}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={40}
                  fontSize={12}
                />
                {visibleSeries.has('totalSubdomains') && (
                  <Line
                    dataKey="totalSubdomains"
                    type="monotone"
                    stroke="var(--color-totalSubdomains)"
                    strokeWidth={hoveredLine === 'totalSubdomains' ? 4 : 2}
                    dot={{ r: 3, fill: "var(--color-totalSubdomains)" }}
                    style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
                    onClick={() => toggleSeries('totalSubdomains')}
                    onMouseEnter={() => setHoveredLine('totalSubdomains')}
                    onMouseLeave={() => setHoveredLine(null)}
                  />
                )}
                {visibleSeries.has('totalIps') && (
                  <Line
                    dataKey="totalIps"
                    type="monotone"
                    stroke="var(--color-totalIps)"
                    strokeWidth={hoveredLine === 'totalIps' ? 4 : 2}
                    dot={{ r: 3, fill: "var(--color-totalIps)" }}
                    style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
                    onClick={() => toggleSeries('totalIps')}
                    onMouseEnter={() => setHoveredLine('totalIps')}
                    onMouseLeave={() => setHoveredLine(null)}
                  />
                )}
                {visibleSeries.has('totalEndpoints') && (
                  <Line
                    dataKey="totalEndpoints"
                    type="monotone"
                    stroke="var(--color-totalEndpoints)"
                    strokeWidth={hoveredLine === 'totalEndpoints' ? 4 : 2}
                    dot={{ r: 3, fill: "var(--color-totalEndpoints)" }}
                    style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
                    onClick={() => toggleSeries('totalEndpoints')}
                    onMouseEnter={() => setHoveredLine('totalEndpoints')}
                    onMouseLeave={() => setHoveredLine(null)}
                  />
                )}
                {visibleSeries.has('totalWebsites') && (
                  <Line
                    dataKey="totalWebsites"
                    type="monotone"
                    stroke="var(--color-totalWebsites)"
                    strokeWidth={hoveredLine === 'totalWebsites' ? 4 : 2}
                    dot={{ r: 3, fill: "var(--color-totalWebsites)" }}
                    style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
                    onClick={() => toggleSeries('totalWebsites')}
                    onMouseEnter={() => setHoveredLine('totalWebsites')}
                    onMouseLeave={() => setHoveredLine(null)}
                  />
                )}
              </LineChart>
            </ChartContainer>
            <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-sm">
              <span className="text-muted-foreground text-xs">
                {activeData ? formatDate(activeData.date) : "当前"}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleSeries('totalSubdomains')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:bg-muted ${
                    !visibleSeries.has('totalSubdomains') ? 'opacity-40' : ''
                  }`}
                >
                  <div 
                    className={`h-2.5 w-2.5 rounded-full ${!visibleSeries.has('totalSubdomains') ? 'bg-muted-foreground' : ''}`} 
                    style={{ backgroundColor: visibleSeries.has('totalSubdomains') ? "#3b82f6" : undefined }} 
                  />
                  <span className={`text-muted-foreground ${!visibleSeries.has('totalSubdomains') ? 'line-through' : ''}`}>子域名</span>
                  <span className="font-medium">{displayData?.totalSubdomains ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSeries('totalIps')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:bg-muted ${
                    !visibleSeries.has('totalIps') ? 'opacity-40' : ''
                  }`}
                >
                  <div 
                    className={`h-2.5 w-2.5 rounded-full ${!visibleSeries.has('totalIps') ? 'bg-muted-foreground' : ''}`} 
                    style={{ backgroundColor: visibleSeries.has('totalIps') ? "#f97316" : undefined }} 
                  />
                  <span className={`text-muted-foreground ${!visibleSeries.has('totalIps') ? 'line-through' : ''}`}>IP</span>
                  <span className="font-medium">{displayData?.totalIps ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSeries('totalEndpoints')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:bg-muted ${
                    !visibleSeries.has('totalEndpoints') ? 'opacity-40' : ''
                  }`}
                >
                  <div 
                    className={`h-2.5 w-2.5 rounded-full ${!visibleSeries.has('totalEndpoints') ? 'bg-muted-foreground' : ''}`} 
                    style={{ backgroundColor: visibleSeries.has('totalEndpoints') ? "#eab308" : undefined }} 
                  />
                  <span className={`text-muted-foreground ${!visibleSeries.has('totalEndpoints') ? 'line-through' : ''}`}>端点</span>
                  <span className="font-medium">{displayData?.totalEndpoints ?? 0}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSeries('totalWebsites')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all hover:bg-muted ${
                    !visibleSeries.has('totalWebsites') ? 'opacity-40' : ''
                  }`}
                >
                  <div 
                    className={`h-2.5 w-2.5 rounded-full ${!visibleSeries.has('totalWebsites') ? 'bg-muted-foreground' : ''}`} 
                    style={{ backgroundColor: visibleSeries.has('totalWebsites') ? "#22c55e" : undefined }} 
                  />
                  <span className={`text-muted-foreground ${!visibleSeries.has('totalWebsites') ? 'line-through' : ''}`}>网站</span>
                  <span className="font-medium">{displayData?.totalWebsites ?? 0}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
