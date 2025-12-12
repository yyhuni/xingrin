"use client"

import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  IconRadar, 
  IconPlayerPlay, 
  IconBug,
  IconStack2
} from "@tabler/icons-react"
import { useScanStatistics } from "@/hooks/use-scans"

function StatCard({
  title,
  value,
  icon,
  loading,
  footer,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  loading?: boolean
  footer: string
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
            {value}
          </CardTitle>
        )}
        <CardAction>
          <Badge variant="outline">全部</Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="text-muted-foreground">{footer}</div>
      </CardFooter>
    </Card>
  )
}

export function ScanHistoryStatCards() {
  const { data, isLoading } = useScanStatistics()

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        title="总扫描数"
        value={data?.total ?? 0}
        icon={<IconRadar className="size-4" />}
        loading={isLoading}
        footer="所有扫描任务"
      />
      <StatCard
        title="进行中"
        value={data?.running ?? 0}
        icon={<IconPlayerPlay className="size-4" />}
        loading={isLoading}
        footer="正在执行的扫描"
      />
      <StatCard
        title="发现漏洞"
        value={data?.totalVulns ?? 0}
        icon={<IconBug className="size-4" />}
        loading={isLoading}
        footer="已完成扫描发现"
      />
      <StatCard
        title="发现资产"
        value={data?.totalAssets ?? 0}
        icon={<IconStack2 className="size-4" />}
        loading={isLoading}
        footer="子域名 + IP + 端点 + 网站"
      />
    </div>
  )
}
