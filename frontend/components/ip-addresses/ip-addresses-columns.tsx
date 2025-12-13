"use client"

import React from "react"
import { Column, ColumnDef } from "@tanstack/react-table"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import type { IPAddress } from "@/types/ip-address.types"

import { TruncatedCell } from "@/components/ui/truncated-cell"

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
      cell: ({ row }) => (
        <TruncatedCell value={row.original.ip} maxLength="ip" mono />
      ),
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
