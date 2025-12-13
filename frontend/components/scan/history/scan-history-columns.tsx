"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ScanRecord, ScanStatus } from "@/types/scan.types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  ChevronsUpDown, 
  ChevronUp, 
  ChevronDown,
  CircleArrowRight,
  StopCircle,
} from "lucide-react"
import {
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconLoader,
  IconWorld,
  IconBrowser,
  IconServer,
  IconLink,
  IconBug,
} from "@tabler/icons-react"

import { CopyablePopoverContent } from "@/components/ui/copyable-popover-content"

/**
 * 状态徽章组件
 * 使用 shadcn Badge 的标准 variant
 * Running/Initiated 状态可点击查看进度详情
 */
function StatusBadge({ 
  status, 
  onClick 
}: { 
  status: ScanStatus
  onClick?: () => void 
}) {
  const config: Record<ScanStatus, {
    icon: React.ComponentType<{ className?: string }>
    label: string
    variant: "secondary" | "default" | "outline" | "destructive"
    className?: string
  }> = {
    cancelled: {
      icon: IconCircleX,
      label: "Cancelled",
      variant: "outline",
      className: "bg-gray-500/15 text-gray-600 border-gray-500/30 hover:bg-gray-500/25 dark:text-gray-400 transition-colors",
    },
    completed: {
      icon: IconCircleCheck,
      label: "Completed",
      variant: "outline",
      className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25 dark:text-emerald-400 transition-colors",
    },
    failed: {
      icon: IconCircleX,
      label: "Failed",
      variant: "outline",
      className: "bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/25 dark:text-red-400 transition-colors",
    },
    initiated: {
      icon: IconClock,
      label: "Initiated",
      variant: "outline",
      className: "bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25 dark:text-amber-400 transition-colors",
    },
    running: {
      icon: IconLoader,
      label: "Running",
      variant: "outline",
      className: "bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/25 dark:text-blue-400 transition-colors",
    },
  }

  const { icon: Icon, label, variant, className } = config[status]

  const badge = (
    <Badge variant={variant} className={className}>
      {(status === "running" || status === "initiated") ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
      {label}
      {onClick && <span className="ml-0.5 text-xs opacity-60">›</span>}
    </Badge>
  )

  if (onClick) {
    return (
      <button 
        onClick={onClick}
        className="cursor-pointer hover:scale-105 transition-transform"
        title="点击查看进度详情"
      >
        {badge}
      </button>
    )
  }

  return badge
}

// 列创建函数的参数类型
interface CreateColumnsProps {
  formatDate: (dateString: string) => string
  navigate: (path: string) => void
  handleDelete: (scan: ScanRecord) => void
  handleStop: (scan: ScanRecord) => void
  handleViewProgress?: (scan: ScanRecord) => void
}

/**
 * 数据表格列头组件
 */
function DataTableColumnHeader({
  column,
  title,
}: {
  column: { getCanSort: () => boolean; getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void }
  title: string
}) {
  if (!column.getCanSort()) {
    return <div className="-ml-3 font-medium">{title}</div>
  }

  const isSorted = column.getIsSorted()

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className="-ml-3 h-8 data-[state=open]:bg-accent hover:bg-muted"
    >
      {title}
      {isSorted === "asc" ? (
        <ChevronUp />
      ) : isSorted === "desc" ? (
        <ChevronDown />
      ) : (
        <ChevronsUpDown />
      )}
    </Button>
  )
}

/**
 * 创建扫描历史表格列定义
 */
export const createScanHistoryColumns = ({
  formatDate,
  navigate,
  handleDelete,
  handleStop,
  handleViewProgress,
}: CreateColumnsProps): ColumnDef<ScanRecord>[] => [
  // 选择列
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  // Target 列
  {
    accessorKey: "targetName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Target" />
    ),
    cell: ({ row }) => {
      const targetName = row.getValue("targetName") as string
      const targetId = row.original.target
      
      const maxLength = 30
      const isLong = targetName.length > maxLength
      const displayText = isLong ? targetName.substring(0, maxLength) + "..." : targetName
      
      return (
        <div className="group inline-flex items-center gap-1 max-w-[250px]">
          <div className="flex items-center gap-1">
            {targetId ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(`/target/${targetId}/details`)}
                    className="text-sm font-medium hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    {displayText}
                  </button>
                </TooltipTrigger>
                <TooltipContent>目标详情</TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-sm font-medium">
                {displayText}
              </span>
            )}
            {isLong && (
              <Popover>
                <PopoverTrigger asChild>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-3">
                  <CopyablePopoverContent value={targetName} />
                </PopoverContent>
              </Popover>
            )}
          </div>
          {targetId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/target/${targetId}/details`)
              }}
            >
              <CircleArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      )
    },
  },

  // Summary 列
  {
    accessorKey: "summary",
    header: "Summary",
    cell: ({ row }) => {
      const summary = (row.getValue("summary") as {
        subdomains: number
        websites: number
        endpoints: number
        ips: number
        vulnerabilities: {
          total: number
          critical: number
          high: number
          medium: number
          low: number
        }
      }) || {}

      const subdomains = summary?.subdomains ?? 0
      const websites = summary?.websites ?? 0
      const endpoints = summary?.endpoints ?? 0
      const ips = summary?.ips ?? 0
      const vulns = summary?.vulnerabilities?.total ?? 0

      const badges: React.ReactNode[] = []

      if (subdomains > 0) {
        badges.push(
          <TooltipProvider delayDuration={300} key="subdomains">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className="bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/25 dark:text-blue-400 transition-colors gap-1"
                >
                  <IconWorld className="h-3 w-3" />
                  {subdomains}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Subdomains</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }

      if (websites > 0) {
        badges.push(
          <TooltipProvider delayDuration={300} key="websites">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25 dark:text-emerald-400 transition-colors gap-1"
                >
                  <IconBrowser className="h-3 w-3" />
                  {websites}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Websites</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }

      if (ips > 0) {
        badges.push(
          <TooltipProvider delayDuration={300} key="ips">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className="bg-orange-500/15 text-orange-600 border-orange-500/30 hover:bg-orange-500/25 dark:text-orange-400 transition-colors gap-1"
                >
                  <IconServer className="h-3 w-3" />
                  {ips}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">IP Addresses</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }

      if (endpoints > 0) {
        badges.push(
          <TooltipProvider delayDuration={300} key="endpoints">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className="bg-violet-500/15 text-violet-600 border-violet-500/30 hover:bg-violet-500/25 dark:text-violet-400 transition-colors gap-1"
                >
                  <IconLink className="h-3 w-3" />
                  {endpoints}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Endpoints</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }

      if (vulns > 0) {
        badges.push(
          <TooltipProvider delayDuration={300} key="vulnerabilities">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline"
                  className="gap-1 bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/25 dark:text-red-400 transition-colors"
                >
                  <IconBug className="h-3 w-3" />
                  {vulns}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs font-medium">
                  {summary?.vulnerabilities?.critical ?? 0} Critical, {summary?.vulnerabilities?.high ?? 0} High, {summary?.vulnerabilities?.medium ?? 0} Medium Vulnerabilities
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }

      return (
        <div className="flex items-center gap-1.5">
          {badges.length > 0 ? (
            badges
          ) : (
            <Badge
              variant="outline"
              className="gap-0 bg-muted/70 text-muted-foreground/80 border-border/40 px-1.5 py-0.5 rounded-full justify-center"
            >
              <span className="text-[11px] font-medium leading-none">-</span>
              <span className="sr-only">No summary</span>
            </Badge>
          )}
        </div>
      )
    },
    enableSorting: false,
  },

  // Engine Name 列
  {
    accessorKey: "engineName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Engine Name" />
    ),
    cell: ({ row }) => {
      const engineName = row.getValue("engineName") as string
      return (
        <Badge variant="secondary">
          {engineName}
        </Badge>
      )
    },
  },

  // Created At 列
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => {
      const createdAt = row.getValue("createdAt") as string
      return (
        <div className="text-sm text-muted-foreground">
          {formatDate(createdAt)}
        </div>
      )
    },
  },

  // Status 列
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as ScanStatus
      return (
        <StatusBadge 
          status={status} 
          onClick={handleViewProgress ? () => handleViewProgress(row.original) : undefined}
        />
      )
    },
  },

  // Progress 列
  {
    accessorKey: "progress",
    header: "Progress",
    cell: ({ row }) => {
      const progress = row.getValue("progress") as number
      const status = row.original.status
      
      // 如果状态是completed，显示100%
      const displayProgress = status === "completed" ? 100 : progress
      
      return (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-2 bg-primary/10 rounded-full overflow-hidden border border-border">
            <div 
              className={`h-full transition-all ${
                status === "completed" ? "bg-emerald-500/80" : 
                status === "failed" ? "bg-red-500/80" : 
                status === "running" ? "bg-blue-500/80 progress-striped" : 
                status === "cancelled" ? "bg-gray-500/80" :
                status === "initiated" ? "bg-amber-500/80 progress-striped" :
                "bg-muted-foreground/80"
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono w-10">
            {displayProgress}%
          </span>
        </div>
      )
    },
    enableSorting: false,
  },

  // 操作列
  {
    id: "actions",
    cell: ({ row }) => {
      const scan = row.original
      const canStop = scan.status === 'running' || scan.status === 'initiated'
      
      return (
        <div className="flex items-center gap-1">
          {/* View Results 按钮 - 直接显示 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => navigate(`/scan/history/${scan.id}/`)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            查看
          </Button>
          
          {/* 更多操作菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">打开菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canStop && (
                <>
                  <DropdownMenuItem
                    onClick={() => handleStop(scan)}
                    className="text-chart-2 focus:text-chart-2"
                  >
                    <StopCircle />
                    停止扫描
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleDelete(scan)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
]
