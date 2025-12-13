"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react"

import type { Subdomain } from "@/types/subdomain.types"

import { TruncatedCell } from "@/components/ui/truncated-cell"

// 列创建函数的参数类型
interface CreateColumnsProps {
  formatDate: (dateString: string) => string
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
 * 创建目标域名表格列定义
 */
export const createSubdomainColumns = ({
  formatDate,
}: CreateColumnsProps): ColumnDef<Subdomain>[] => [
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

  // 子域名列
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subdomain" />
    ),
    cell: ({ row }) => (
      <TruncatedCell 
        value={row.getValue("name")} 
        maxLength="subdomain" 
        mono 
        className="font-medium"
      />
    ),
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
]
