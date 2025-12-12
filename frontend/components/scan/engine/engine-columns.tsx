"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MoreHorizontal,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Check,
  Edit,
  X as XIcon,
} from "lucide-react"
import {
  IconTarget,
  IconBolt,
  IconSettings,
} from "@tabler/icons-react"
import * as yaml from "js-yaml"
import type { ScanEngine } from "@/types/engine.types"

/**
 * 解析引擎的 YAML 配置并检测功能是否启用
 * 
 * 判断逻辑：
 * - 如果 YAML 中存在该配置项（即使是空对象 {}），则认为启用了该功能
 * - 空对象表示使用默认配置启用该功能
 */
function parseEngineFeatures(engine: ScanEngine) {
  // 如果引擎有 configuration 字段，解析 YAML
  if (engine.configuration) {
    try {
      const config = yaml.load(engine.configuration) as any
      return {
        subdomain_discovery: !!config?.subdomain_discovery,
        port_scan: !!config?.port_scan,
        site_scan: !!config?.site_scan,
        directory_scan: !!config?.directory_scan,
        url_fetch: !!config?.url_fetch || !!config?.fetch_url, // 兼容 fetch_url
        osint: !!config?.osint,
        vulnerability_scan: !!config?.vulnerability_scan,
        waf_detection: !!config?.waf_detection,
        screenshot: !!config?.screenshot,
      }
    } catch (error) {
      console.error("Failed to parse YAML configuration:", error)
    }
  }
  
  // 无配置时，所有功能默认为禁用
  return {
    subdomain_discovery: false,
    port_scan: false,
    site_scan: false,
    directory_scan: false,
    url_fetch: false,
    osint: false,
    vulnerability_scan: false,
    waf_detection: false,
    screenshot: false,
  }
}

/**
 * 功能支持状态组件
 */
function FeatureStatus({ enabled }: { enabled?: boolean }) {
  if (enabled) {
    return (
      <div className="flex justify-center">
        <Check className="h-5 w-5 text-chart-4" />
      </div>
    )
  }
  return (
    <div className="flex justify-center">
      <XIcon className="h-5 w-5 text-destructive" />
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
  handleEdit: (engine: ScanEngine) => void
  handleDelete: (engine: ScanEngine) => void
}

/**
 * 引擎行操作组件
 */
function EngineRowActions({
  engine,
  onEdit,
  onDelete,
}: {
  engine: ScanEngine
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
        <DropdownMenuItem onClick={onEdit}>
          <Edit />
          编辑引擎
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
 * 创建引擎表格列定义
 */
export const createEngineColumns = ({
  formatDate,
  handleEdit,
  handleDelete,
}: CreateColumnsProps): ColumnDef<ScanEngine>[] => [
  // 引擎名称列 - 可点击编辑
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="引擎名称" />
    ),
    cell: ({ row }) => {
      const name = row.getValue("name") as string
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleEdit(row.original)}
              className="max-w-[300px] truncate font-medium text-left hover:text-primary hover:underline underline-offset-2 cursor-pointer transition-colors"
            >
              {name}
            </button>
          </TooltipTrigger>
          <TooltipContent>编辑引擎</TooltipContent>
        </Tooltip>
      )
    },
  },

  // Subdomain Discovery
  {
    id: "subdomain_discovery",
    header: "Subdomain Discovery",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.subdomain_discovery} />
    },
    enableSorting: false,
  },

  // Port Scan
  {
    id: "port_scan",
    header: "Port Scan",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.port_scan} />
    },
    enableSorting: false,
  },

  // Site Scan (原 HTTP Crawl)
  {
    id: "site_scan",
    header: "Site Scan",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.site_scan} />
    },
    enableSorting: false,
  },

  // Directory Scan
  {
    id: "directory_scan",
    header: "Directory Scan",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.directory_scan} />
    },
    enableSorting: false,
  },

  // URL Fetch
  {
    id: "url_fetch",
    header: "URL Fetch",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.url_fetch} />
    },
    enableSorting: false,
  },

  // OSINT
  {
    id: "osint",
    header: "OSINT",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.osint} />
    },
    enableSorting: false,
  },

  // Vulnerability Scan
  {
    id: "vulnerability_scan",
    header: "Vulnerability Scan",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.vulnerability_scan} />
    },
    enableSorting: false,
  },

  // WAF Detection
  {
    id: "waf_detection",
    header: "WAF Detection",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.waf_detection} />
    },
    enableSorting: false,
  },

  // Screenshot
  {
    id: "screenshot",
    header: "Screenshot",
    cell: ({ row }) => {
      const features = parseEngineFeatures(row.original)
      return <FeatureStatus enabled={features.screenshot} />
    },
    enableSorting: false,
  },

  // 操作列
  {
    id: "actions",
    cell: ({ row }) => (
      <EngineRowActions
        engine={row.original}
        onEdit={() => handleEdit(row.original)}
        onDelete={() => handleDelete(row.original)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
]

