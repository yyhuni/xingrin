import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface DataTableSkeletonProps {
  statsCount?: number
  toolbarButtonCount?: number
  rows?: number
  columns?: number
  withSearch?: boolean
  paginationButtonCount?: number
  withPadding?: boolean
  className?: string
}

/**
 * 通用表格页面骨架屏
 * 可配置统计卡片、工具栏按钮、表格列数等
 */
export function DataTableSkeleton({
  statsCount = 0,
  toolbarButtonCount = 2,
  rows = 5,
  columns = 4,
  withSearch = true,
  paginationButtonCount = 3,
  withPadding = true,
  className,
}: DataTableSkeletonProps) {
  const containerClass = cn(
    "space-y-4",
    withPadding && "px-4 lg:px-6",
    className
  )

  const toolbarNeeded = withSearch || toolbarButtonCount > 0

  return (
    <div className={containerClass}>
      {statsCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: statsCount }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-card p-4 shadow-sm space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      )}

      {toolbarNeeded && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {withSearch && <Skeleton className="h-9 w-full sm:max-w-sm" />}
            {toolbarButtonCount > 0 && (
              <div className="flex items-center gap-2">
                {Array.from({ length: toolbarButtonCount }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-24" />
                ))}
              </div>
            )}
          </div>
          <div
            className="border-b mt-4"
            style={{ borderColor: "var(--sidebar-border)" }}
          />
        </>
      )}

      <div className="overflow-x-auto">
        <div
          className="hidden md:flex items-center gap-4 border-b px-2 py-3"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} className="h-5 flex-1" />
          ))}
        </div>

        <div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className={cn(
                "flex flex-col gap-3 border-b px-2 py-3 md:flex-row md:items-center md:justify-between",
                rowIndex === rows - 1 && "border-b-0"
              )}
              style={{ borderColor: rowIndex === rows - 1 ? "transparent" : "var(--sidebar)" }}
            >
              {Array.from({ length: Math.max(columns, 3) }).map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  className="h-5 w-full md:w-1/4"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-5 w-48" />
        <div className="flex items-center gap-2">
          {Array.from({ length: paginationButtonCount }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-10 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
