"use client"

import { useAssetStatistics } from "@/hooks/use-dashboard"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { IconTarget, IconStack2, IconBug, IconPlayerPlay, IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

function TrendBadge({ change }: { change: number }) {
  if (change === 0) return null
  
  const isPositive = change > 0
  return (
    <Badge 
      variant="outline" 
      className={isPositive 
        ? "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950" 
        : "text-destructive border-destructive/30 bg-destructive/15"
      }
    >
      {isPositive ? <IconTrendingUp className="size-3 mr-1" /> : <IconTrendingDown className="size-3 mr-1" />}
      {isPositive ? '+' : ''}{change}
    </Badge>
  )
}

function StatCard({
  title,
  value,
  change,
  icon,
  footer,
  loading,
}: {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  footer: string
  loading?: boolean
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {icon}
          {title}
        </CardDescription>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </CardTitle>
        )}
        {!loading && change !== undefined && (
          <CardAction>
            <TrendBadge change={change} />
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="text-muted-foreground">{footer}</div>
      </CardFooter>
    </Card>
  )
}

function formatUpdateTime(dateStr: string | null) {
  if (!dateStr) return '暂无数据'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DashboardStatCards() {
  const { data, isLoading } = useAssetStatistics()

  return (
    <div className="flex flex-col gap-2 px-4 lg:px-6">
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <StatCard
          title="发现资产"
          value={data?.totalAssets ?? 0}
          change={data?.changeAssets}
          icon={<IconStack2 className="size-4" />}
          loading={isLoading}
          footer="子域名 + IP + 端点 + 网站"
        />
        <StatCard
          title="发现漏洞"
          value={data?.totalVulns ?? 0}
          change={data?.changeVulns}
          icon={<IconBug className="size-4" />}
          loading={isLoading}
          footer="所有扫描发现的漏洞"
        />
        <StatCard
          title="监控目标"
          value={data?.totalTargets ?? 0}
          change={data?.changeTargets}
          icon={<IconTarget className="size-4" />}
          loading={isLoading}
          footer="已添加的目标总数"
        />
        <StatCard
          title="正在扫描"
          value={data?.runningScans ?? 0}
          icon={<IconPlayerPlay className="size-4" />}
          loading={isLoading}
          footer="当前运行中的任务"
        />
      </div>
      <div className="flex items-center gap-3 mt-1 -mb-2 text-xs text-muted-foreground">
        <div className="flex-1 border-t" />
        <span>统计更新于 {formatUpdateTime(data?.updatedAt ?? null)}</span>
      </div>
    </div>
  )
}
