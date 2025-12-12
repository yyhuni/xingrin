"use client"

import React from "react"
import { Column, ColumnDef } from "@tanstack/react-table"
import { ChevronUp, ChevronDown, ChevronsUpDown, Copy, Check, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { IPAddress } from "@/types/ip-address.types"
import { toast } from "sonner"

/**
 * 可复制单元格组件
 */
function CopyableCell({ 
  value, 
  maxWidth = "400px", 
  truncateLength = 50,
  successMessage = "已复制",
  className = "font-medium"
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
      toast.error('复制失败')
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
            className={`text-xs ${isLong ? 'max-w-[500px] break-all' : 'whitespace-nowrap'}`}
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

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>
  title: string
}

function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column?.getCanSort()) {
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

export function createIPAddressColumns(params: {
  formatDate: (value: string) => string
}) {
  const { formatDate } = params

  const columns: ColumnDef<IPAddress>[] = [
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
    // IP 地址列
    {
      accessorKey: "ip",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="IP 地址" />
      ),
      cell: ({ row }) => {
        const ip = row.original.ip
        if (!ip) return <span className="text-muted-foreground text-sm">-</span>
        
        const maxLength = 40
        const isLong = ip.length > maxLength
        const displayIp = isLong ? ip.substring(0, maxLength) + "..." : ip

        return (
          <div className="flex items-center gap-1 max-w-[350px]">
            <span className="text-sm font-mono">
              {displayIp}
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
                    <h4 className="font-medium text-sm">完整 IP 地址</h4>
                    <div className="text-xs break-all bg-muted p-2 rounded max-h-48 overflow-y-auto font-mono">
                      {ip}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )
      },
    },
    // 关联主机名列
    {
      accessorKey: "hosts",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="关联主机" />
      ),
      cell: ({ getValue }) => {
        const hosts = getValue<string[]>()
        if (!hosts || hosts.length === 0) {
          return <span className="text-muted-foreground">-</span>
        }
        
        // 显示前3个主机名
        const displayHosts = hosts.slice(0, 3)
        const hasMore = hosts.length > 3
        
        return (
          <div className="flex flex-col gap-1">
            {displayHosts.map((host, index) => (
              <span key={index} className="text-sm font-mono">{host}</span>
            ))}
            {hasMore && (
              <Badge variant="secondary" className="text-xs w-fit">
                +{hosts.length - 3} more
              </Badge>
            )}
          </div>
        )
      },
    },
    // 发现时间列
    {
      accessorKey: "discoveredAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="发现时间" />
      ),
      cell: ({ getValue }) => {
        const value = getValue<string | undefined>()
        return value ? formatDate(value) : "-"
      },
    },
    // 开放端口列
    {
      accessorKey: "ports",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="开放端口" />
      ),
      cell: ({ getValue }) => {
        const ports = getValue<number[]>()
        if (!ports || ports.length === 0) {
          return <span className="text-muted-foreground">-</span>
        }

        // 常见端口颜色映射
        const getPortVariant = (portNumber: number) => {
          const commonPorts = [80, 443, 22, 21, 25, 53, 110, 143, 993, 995]
          const webPorts = [80, 443, 8080, 8443, 3000, 8000, 8888]
          const sshPorts = [22]
          
          if (sshPorts.includes(portNumber)) return "destructive"
          if (webPorts.includes(portNumber)) return "default"
          if (commonPorts.includes(portNumber)) return "secondary"
          return "outline"
        }

        // 按端口重要性排序：常见端口优先
        const sortedPorts = [...ports].sort((a, b) => {
          const commonPorts = [80, 443, 22, 21, 25, 53, 110, 143, 993, 995]
          const webPorts = [80, 443, 8080, 8443, 3000, 8000, 8888]
          
          const aScore = webPorts.includes(a) ? 3 : 
                        commonPorts.includes(a) ? 2 : 1
          const bScore = webPorts.includes(b) ? 3 : 
                        commonPorts.includes(b) ? 2 : 1
          
          if (aScore !== bScore) return bScore - aScore
          return a - b
        })

        // 显示前8个端口
        const displayPorts = sortedPorts.slice(0, 8)
        const hasMore = sortedPorts.length > 8

        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {displayPorts.map((port, index) => (
              <Badge 
                key={index} 
                variant={getPortVariant(port)}
                className="text-xs font-mono"
              >
                {port}
              </Badge>
            ))}
            {hasMore && (
              <Popover>
                <PopoverTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                    +{ports.length - 8}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">所有开放端口 ({sortedPorts.length})</h4>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {sortedPorts.map((port, index) => (
                        <Badge 
                          key={index} 
                          variant={getPortVariant(port)}
                          className="text-xs font-mono"
                        >
                          {port}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )
      },
    },
  ]

  return columns
}
