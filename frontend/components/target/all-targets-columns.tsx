"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
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
import { MoreHorizontal, Eye, Trash2, ChevronsUpDown, ChevronUp, ChevronDown, Play, Calendar, Copy, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { Target } from "@/types/target.types"

/**
 * 复制到剪贴板（兼容 HTTP 环境）
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // Fallback: 使用临时 textarea
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
    return true
  } catch {
    return false
  }
}

/**
 * 目标名称单元格组件
 */
function TargetNameCell({ 
  name, 
  targetId, 
  navigate 
}: { 
  name: string
  targetId: number
  navigate: (path: string) => void 
}) {
  const [copied, setCopied] = React.useState(false)
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const success = await copyToClipboard(name)
    if (success) {
      setCopied(true)
      toast.success("已复制目标名称")
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("复制失败")
    }
  }
  
  return (
    <div className="group inline-flex items-center gap-1 max-w-[350px]">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            onClick={() => navigate(`/target/${targetId}/details`)}
            className="text-sm font-medium hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer truncate"
          >
            {name}
          </span>
        </TooltipTrigger>
        <TooltipContent>目标详情</TooltipContent>
      </Tooltip>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 flex-shrink-0 hover:bg-accent transition-opacity ${
                copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
            <p className="text-xs">{copied ? '已复制!' : '点击复制'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// 列创建函数的参数类型
interface CreateColumnsProps {
  formatDate: (dateString: string) => string
  navigate: (path: string) => void
  handleDelete: (target: Target) => void
  handleInitiateScan: (target: Target) => void
  handleScheduleScan: (target: Target) => void
}

/**
 * 目标行操作组件
 */
function TargetRowActions({
  target,
  onView,
  onInitiateScan,
  onScheduleScan,
  onDelete,
}: {
  target: Target
  onView: () => void
  onInitiateScan: () => void
  onScheduleScan: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {/* Target Summary 按钮 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onView}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Target Summary</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Initiate Scan 按钮 */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onInitiateScan}
            >
              <Play className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Initiate Scan</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* 更多操作菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 data-[state=open]:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">更多操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onScheduleScan}>
            <Calendar />
            Schedule Scan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
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
 * 创建所有目标表格列定义
 */
export const createAllTargetsColumns = ({
  formatDate,
  navigate,
  handleDelete,
  handleInitiateScan,
  handleScheduleScan,
}: CreateColumnsProps): ColumnDef<Target>[] => [
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

  // 目标名称列
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Target" />
    ),
    cell: ({ row }) => (
      <TargetNameCell
        name={row.getValue("name") as string}
        targetId={row.original.id}
        navigate={navigate}
      />
    ),
  },

  // 所属组织列
  {
    accessorKey: "organizations",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Organization" />
    ),
    cell: ({ row }) => {
      const organizations = row.getValue("organizations") as Array<{ id: number; name: string }> | undefined
      if (!organizations || organizations.length === 0) {
        return <span className="text-sm text-muted-foreground">-</span>
      }
      
      const displayOrgs = organizations.slice(0, 2)
      const remainingCount = organizations.length - 2
      
      return (
        <div className="flex flex-wrap gap-1">
          {displayOrgs.map((org) => (
            <Badge 
              key={org.id} 
              variant="secondary" 
              className="text-xs"
              title={org.name}
            >
              {org.name}
            </Badge>
          ))}
          {remainingCount > 0 && (
            <TooltipProvider delayDuration={500} skipDelayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="text-xs cursor-default"
                  >
                    +{remainingCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent 
                  side="top" 
                  align="start"
                  sideOffset={5}
                  className="max-w-sm"
                >
                  <div className="flex flex-col gap-1">
                    {organizations.slice(2).map((org) => (
                      <div key={org.id} className="text-xs">
                        {org.name}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )
    },
    enableSorting: false,
  },

  // 创建时间列
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Added On" />
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

  // 最后扫描时间列
  {
    accessorKey: "lastScannedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Scanned" />
    ),
    cell: ({ row }) => {
      const lastScannedAt = row.original.lastScannedAt
      if (!lastScannedAt) {
        return <span className="text-sm text-muted-foreground">-</span>
      }
      return (
        <div className="text-sm text-muted-foreground">
          {formatDate(lastScannedAt)}
        </div>
      )
    },
  },

  // 操作列
  {
    id: "actions",
    cell: ({ row }) => (
      <TargetRowActions
        target={row.original}
        onView={() => navigate(`/target/${row.original.id}/details`)}
        onInitiateScan={() => handleInitiateScan(row.original)}
        onScheduleScan={() => handleScheduleScan(row.original)}
        onDelete={() => handleDelete(row.original)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
]
