"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Eye, MoreHorizontal } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import type { Vulnerability, VulnerabilitySeverity } from "@/types/vulnerability.types"

import { CopyablePopoverContent } from "@/components/ui/copyable-popover-content"
import { TRUNCATE_LENGTHS } from "@/components/ui/truncated-cell"

// 统一的漏洞严重程度颜色配置（与图表一致）
const severityConfig: Record<VulnerabilitySeverity, { label: string; className: string }> = {
  critical: { label: "严重", className: "bg-red-600 text-white hover:bg-red-600" },
  high: { label: "高危", className: "bg-orange-500 text-white hover:bg-orange-500" },
  medium: { label: "中危", className: "bg-yellow-500 text-white hover:bg-yellow-500" },
  low: { label: "低危", className: "bg-blue-500 text-white hover:bg-blue-500" },
  info: { label: "信息", className: "bg-gray-500 text-white hover:bg-gray-500" },
}

interface ColumnActions {
  formatDate: (date: string) => string
  handleViewDetail: (vulnerability: Vulnerability) => void
}

export function createVulnerabilityColumns({
  formatDate,
  handleViewDetail,
}: ColumnActions): ColumnDef<Vulnerability>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="全选"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="选择行"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "severity",
      header: "Status",
      cell: ({ row }) => {
        const severity = row.getValue("severity") as VulnerabilitySeverity
        const config = severityConfig[severity]
        return (
          <Badge className={config.className}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => {
        const source = row.getValue("source") as string
        return (
          <Badge variant="outline">
            {source}
          </Badge>
        )
      },
    },
    {
      accessorKey: "vulnType",
      header: "类型",
      cell: ({ row }) => {
        const vulnType = row.getValue("vulnType") as string
        const vulnerability = row.original
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                className="font-medium cursor-pointer hover:text-primary hover:underline underline-offset-2 transition-colors"
                onClick={() => handleViewDetail(vulnerability)}
              >
                {vulnType}
              </span>
            </TooltipTrigger>
            <TooltipContent>漏洞详情</TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      accessorKey: "url",
      header: "URL",
      size: 300,
      minSize: 200,
      maxSize: 400,
      cell: ({ row }) => {
        const url = row.original.url
        if (!url) return <span className="text-muted-foreground">-</span>
        
        const maxLength = TRUNCATE_LENGTHS.url
        const isLong = url.length > maxLength
        const displayUrl = isLong ? url.substring(0, maxLength) + "..." : url
        
        return (
          <div className="flex items-center gap-1 w-[280px] min-w-[280px]">
            <a 
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {displayUrl}
            </a>
            {isLong && (
              <Popover>
                <PopoverTrigger asChild>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-3">
                  <CopyablePopoverContent value={url} className="font-mono text-xs" />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "discoveredAt",
      header: "发现时间",
      cell: ({ row }) => {
        const discoveredAt = row.getValue("discoveredAt") as string
        return (
          <span className="text-sm text-muted-foreground">
            {formatDate(discoveredAt)}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const vulnerability = row.original

        return (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => handleViewDetail(vulnerability)}
            >
              <Eye className="h-4 w-4 mr-1" />
              详情
            </Button>
          </div>
        )
      },
    },
  ]
}
