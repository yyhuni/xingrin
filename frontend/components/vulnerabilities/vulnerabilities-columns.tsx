"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Eye } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TruncatedUrlCell, TruncatedCell } from "@/components/ui/truncated-cell"

import type { Vulnerability, VulnerabilitySeverity } from "@/types/vulnerability.types"

// 统一的漏洞严重程度颜色配置（与图表一致）
const severityConfig: Record<VulnerabilitySeverity, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-[#da3633]/10 text-[#da3633] border border-[#da3633]/20 dark:text-[#f85149]" },
  high: { label: "High", className: "bg-[#d29922]/10 text-[#d29922] border border-[#d29922]/20" },
  medium: { label: "Medium", className: "bg-[#d4a72c]/10 text-[#d4a72c] border border-[#d4a72c]/20" },
  low: { label: "Low", className: "bg-[#238636]/10 text-[#238636] border border-[#238636]/20 dark:text-[#3fb950]" },
  info: { label: "Info", className: "bg-[#848d97]/10 text-[#848d97] border border-[#848d97]/20" },
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
      size: 40,
      minSize: 40,
      maxSize: 40,
      enableResizing: false,
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
      size: 80,
      minSize: 60,
      maxSize: 120,
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
      size: 100,
      minSize: 80,
      maxSize: 150,
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
      header: "Vuln Type",
      size: 150,
      minSize: 100,
      maxSize: 250,
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
      size: 500,
      minSize: 300,
      maxSize: 700,
      cell: ({ row }) => {
        const url = row.original.url
        return <TruncatedUrlCell value={url} />
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      size: 150,
      minSize: 120,
      maxSize: 200,
      cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as string
        return (
          <span className="text-sm text-muted-foreground">
            {formatDate(createdAt)}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      size: 80,
      minSize: 80,
      maxSize: 80,
      enableResizing: false,
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
