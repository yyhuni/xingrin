"use client"

import { useDiskStats } from '@/hooks/use-disk'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { IconDatabase } from '@tabler/icons-react'
import { formatBytes } from '@/lib/utils'

function StatCard({ title, value, icon, loading }: { title: string; value: string | number; icon: React.ReactNode; loading?: boolean }) {
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
      </CardHeader>
    </Card>
  )
}

export function DiskStatCards() {
  const { data, isLoading } = useDiskStats()

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-3">
      <StatCard title="总容量" value={formatBytes(data?.totalBytes ?? 0)} icon={<IconDatabase />} loading={isLoading} />
      <StatCard title="已使用" value={formatBytes(data?.usedBytes ?? 0)} icon={<IconDatabase />} loading={isLoading} />
      <StatCard title="可用空间" value={formatBytes(data?.freeBytes ?? 0)} icon={<IconDatabase />} loading={isLoading} />
    </div>
  )
}
