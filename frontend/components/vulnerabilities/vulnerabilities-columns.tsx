"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Eye, Copy, Check } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useState } from "react"
import { toast } from "sonner"
import type { Vulnerability, VulnerabilitySeverity } from "@/types/vulnerability.types"

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

/** URL 弹窗组件 */
function UrlPopover({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const success = await copyToClipboard(url)
    if (success) {
      setCopied(true)
      toast.success("URL 已复制")
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("复制失败")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span className="inline-flex items-center rounded border bg-muted px-1.5 text-[10px] text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
          ···
        </span>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto max-w-[450px] p-0" 
        align="start"
        onInteractOutside={(e) => {
          // 复制中不关闭弹窗
          if (copied) e.preventDefault()
        }}
      >
        <div className="group relative">
          <div className="text-xs break-all bg-muted/30 px-3 py-2.5 font-mono text-muted-foreground select-all max-h-40 overflow-y-auto">
            {url}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-1.5 right-1.5 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

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
        
        const maxLength = 40
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
            {isLong && <UrlPopover url={url} />}
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
