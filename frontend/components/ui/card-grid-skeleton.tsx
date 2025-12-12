import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface CardGridSkeletonProps {
  cards?: number
  actionButtonCount?: number
  showToolbar?: boolean
  withPadding?: boolean
  className?: string
}

/**
 * 通用卡片网格骨架屏
 * 适用于工具列表等卡片布局
 */
export function CardGridSkeleton({
  cards = 4,
  actionButtonCount = 2,
  showToolbar = true,
  withPadding = true,
  className,
}: CardGridSkeletonProps) {
  const containerClass = cn(
    "flex flex-col gap-4",
    withPadding && "px-4 lg:px-6",
    className
  )

  return (
    <div className={containerClass}>
      {showToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-9 w-full sm:max-w-sm" />
          <div className="flex items-center gap-2">
            {Array.from({ length: actionButtonCount }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-24" />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 3 }).map((_, badgeIndex) => (
                <Skeleton key={badgeIndex} className="h-6 w-16 rounded-full" />
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
