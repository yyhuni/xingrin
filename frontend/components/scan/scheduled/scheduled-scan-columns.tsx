"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  Copy,
  Check,
  Edit,
  Clock,
} from "lucide-react"
import {
  IconClock,
  IconCalendar,
  IconCalendarRepeat,
  IconCalendarTime,
  IconAdjustments,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { ScheduledScan } from "@/types/scheduled-scan.types"

/**
 * 可复制单元格组件
 */
function CopyableCell({
  value,
  maxWidth = "300px",
  truncateLength = 40,
  successMessage = "已复制",
  className = "font-medium",
}: {
  value: string
  maxWidth?: string
  truncateLength?: number
  successMessage?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const isLong = value.length > truncateLength

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(successMessage)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("复制失败")
    }
  }

  return (
    <div className="group inline-flex items-center gap-1" style={{ maxWidth }}>
      <TooltipProvider delayDuration={500} skipDelayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`text-sm truncate cursor-default ${className}`}>
              {value}
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="start"
            sideOffset={5}
            className={`text-xs ${
              isLong ? "max-w-[500px] break-all" : "whitespace-nowrap"
            }`}
          >
            {value}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={500} skipDelayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 flex-shrink-0 hover:bg-accent transition-opacity ${
                copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">{copied ? "已复制!" : "点击复制"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

/**
 * 解析 Cron 表达式为人类可读格式
 */
function parseCronExpression(cron: string): string {
  if (!cron) return '-'
  
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron
  
  const [minute, hour, day, month, weekday] = parts
  
  // 每分钟
  if (minute === '*' && hour === '*' && day === '*' && month === '*' && weekday === '*') {
    return '每分钟'
  }
  
  // 每N分钟
  if (minute.startsWith('*/') && hour === '*') {
    return `每 ${minute.slice(2)} 分钟`
  }
  
  // 每小时
  if (minute !== '*' && hour === '*' && day === '*') {
    return `每小时 ${minute}分`
  }
  
  // 每N小时
  if (hour.startsWith('*/')) {
    return `每 ${hour.slice(2)} 小时 ${minute}分`
  }
  
  // 每天
  if (day === '*' && month === '*' && weekday === '*') {
    return `每天 ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }
  
  // 每周
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  if (day === '*' && month === '*' && weekday !== '*') {
    const dayName = weekdays[parseInt(weekday)] || weekday
    return `每${dayName} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }
  
  // 每月
  if (day !== '*' && month === '*' && weekday === '*') {
    return `每月${day}号 ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }
  
  return cron
}

/**
 * 数据表格列头组件
 */
function DataTableColumnHeader({
  column,
  title,
}: {
  column: {
    getCanSort: () => boolean
    getIsSorted: () => false | "asc" | "desc"
    toggleSorting: (desc?: boolean) => void
  }
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

// 列创建函数的参数类型
interface CreateColumnsProps {
  formatDate: (dateString: string) => string
  handleView: (scan: ScheduledScan) => void
  handleEdit: (scan: ScheduledScan) => void
  handleDelete: (scan: ScheduledScan) => void
  handleToggleStatus: (scan: ScheduledScan, enabled: boolean) => void
}

/**
 * 定时扫描行操作组件
 */
function ScheduledScanRowActions({
  scan,
  onView,
  onEdit,
  onDelete,
}: {
  scan: ScheduledScan
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        >
          <MoreHorizontal />
          <span className="sr-only">打开菜单</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>
          <Eye />
          查看详情
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Edit />
          编辑任务
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 创建定时扫描表格列定义
 */
export const createScheduledScanColumns = ({
  formatDate,
  handleView,
  handleEdit,
  handleDelete,
  handleToggleStatus,
}: CreateColumnsProps): ColumnDef<ScheduledScan>[] => [
  // 任务名称列
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="任务名称" />
    ),
    cell: ({ row }) => {
      const name = row.getValue("name") as string
      if (!name) return <span className="text-muted-foreground text-sm">-</span>
      
      const maxLength = 35
      const isLong = name.length > maxLength
      const displayName = isLong ? name.substring(0, maxLength) + "..." : name

      return (
        <div className="flex items-center gap-1 max-w-[300px]">
          <span className="text-sm font-medium">
            {displayName}
          </span>
          {isLong && (
            <Popover>
              <PopoverTrigger asChild>
                <span className="inline-flex items-center rounded border bg-muted px-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                  ···
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">完整任务名称</h4>
                  <div className="text-xs break-all bg-muted p-2 rounded max-h-48 overflow-y-auto">
                    {name}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )
    },
  },

  // 扫描引擎列
  {
    accessorKey: "engineName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="扫描引擎" />
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

  // Cron 表达式列
  {
    accessorKey: "cronExpression",
    header: "调度时间",
    cell: ({ row }) => {
      const cron = row.original.cronExpression
      return (
        <div className="flex flex-col gap-1">
          <span className="text-sm">
            {parseCronExpression(cron)}
          </span>
          <code className="text-xs text-muted-foreground font-mono">
            {cron}
          </code>
        </div>
      )
    },
    enableSorting: false,
  },

  // 目标列（根据 scanMode 显示组织或目标）
  {
    accessorKey: "scanMode",
    header: "目标",
    cell: ({ row }) => {
      const scanMode = row.original.scanMode
      const organizationName = row.original.organizationName
      const targetName = row.original.targetName
      
      // 组织扫描模式
      if (scanMode === 'organization' && organizationName) {
        return (
          <Badge variant="secondary" className="text-xs">
            组织: {organizationName}
          </Badge>
        )
      }
      
      // 目标扫描模式：显示单个目标
      if (!targetName) {
        return <div className="text-sm text-muted-foreground">-</div>
      }
      return (
        <Badge variant="outline" className="text-xs font-mono font-normal">
          {targetName}
        </Badge>
      )
    },
    enableSorting: false,
  },

  // 启用状态列
  {
    accessorKey: "isEnabled",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="状态" />
    ),
    cell: ({ row }) => {
      const isEnabled = row.getValue("isEnabled") as boolean
      const scan = row.original
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked: boolean) =>
              handleToggleStatus(scan, checked)
            }
          />
          <span className="text-sm text-muted-foreground">
            {isEnabled ? "启用" : "禁用"}
          </span>
        </div>
      )
    },
  },

  // 下次执行时间列
  {
    accessorKey: "nextRunTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="下次执行" />
    ),
    cell: ({ row }) => {
      const nextRunTime = row.getValue("nextRunTime") as string | undefined
      return (
        <div className="text-sm text-muted-foreground">
          {nextRunTime ? formatDate(nextRunTime) : "-"}
        </div>
      )
    },
  },

  // 执行次数列
  {
    accessorKey: "runCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="执行次数" />
    ),
    cell: ({ row }) => {
      const count = row.getValue("runCount") as number
      return (
        <div className="text-sm text-muted-foreground font-mono">{count}</div>
      )
    },
  },

  // 上次执行时间列
  {
    accessorKey: "lastRunTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="上次执行" />
    ),
    cell: ({ row }) => {
      const lastRunTime = row.getValue("lastRunTime") as string | undefined
      return (
        <div className="text-sm text-muted-foreground">
          {lastRunTime ? formatDate(lastRunTime) : "-"}
        </div>
      )
    },
  },

  // 操作列
  {
    id: "actions",
    cell: ({ row }) => (
      <ScheduledScanRowActions
        scan={row.original}
        onView={() => handleView(row.original)}
        onEdit={() => handleEdit(row.original)}
        onDelete={() => handleDelete(row.original)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
]
