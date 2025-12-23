"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconLayoutColumns,
  IconPlus,
  IconSearch,
  IconLoader2,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { ScheduledScan } from "@/types/scheduled-scan.types"

// 组件属性类型定义
interface ScheduledScanDataTableProps {
  data: ScheduledScan[]
  columns: ColumnDef<ScheduledScan>[]
  onAddNew?: () => void
  searchPlaceholder?: string
  searchColumn?: string
  searchValue?: string
  onSearch?: (value: string) => void
  isSearching?: boolean
  addButtonText?: string
  // 服务端分页相关
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

/**
 * 定时扫描数据表格组件
 * 用于显示和管理定时扫描任务数据
 * 包含搜索、分页、列显示控制等功能
 */
export function ScheduledScanDataTable({
  data = [],
  columns,
  onAddNew,
  searchPlaceholder = "搜索任务名称...",
  searchColumn = "name",
  searchValue,
  onSearch,
  isSearching = false,
  addButtonText = "新建定时扫描",
  // 服务端分页
  page = 1,
  pageSize = 10,
  total = 0,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
}: ScheduledScanDataTableProps) {
  // 搜索本地状态
  const [localSearchValue, setLocalSearchValue] = React.useState(searchValue || "")

  React.useEffect(() => {
    setLocalSearchValue(searchValue || "")
  }, [searchValue])

  const handleSearchSubmit = () => {
    if (onSearch) {
      onSearch(localSearchValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearchSubmit()
    }
  }

  // 表格状态管理
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})

  // 服务端分页：不使用 TanStack Table 的分页，而是手动控制
  const isServerPagination = !!onPageChange

  // 过滤有效数据
  const validData = React.useMemo(() => {
    return (data || []).filter(
      (item) => item && typeof item.id !== "undefined" && item.id !== null
    )
  }, [data])

  // 创建表格实例
  const table = useReactTable({
    data: validData,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      // 服务端分页时不使用内部分页状态
      ...(isServerPagination ? {} : {
        pagination: { pageIndex: page - 1, pageSize }
      }),
      columnSizing,
    },
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onColumnSizingChange: setColumnSizing,
    getRowId: (row) => row.id.toString(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // 服务端分页时不使用客户端分页
    ...(isServerPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    // 服务端分页：告诉 table 总行数
    ...(isServerPagination ? { manualPagination: true, pageCount: totalPages } : {}),
  })


  return (
    <div className="w-full space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        {/* 搜索框 */}
        <div className="flex items-center space-x-2">
          <Input
            placeholder={searchPlaceholder}
            value={localSearchValue}
            onChange={(e) => setLocalSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 max-w-sm"
          />
          <Button variant="outline" size="sm" onClick={handleSearchSubmit} disabled={isSearching}>
            {isSearching ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconSearch className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* 右侧操作按钮 */}
        <div className="flex items-center space-x-2">
          {/* 列显示控制 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                Columns
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" && column.getCanHide()
                )
                .map((column) => {
                  const columnNameMap: Record<string, string> = {
                    name: "任务名称",
                    engine_name: "扫描引擎",
                    frequency: "执行频率",
                    target_domains: "目标域名",
                    is_enabled: "状态",
                    next_run_time: "下次执行",
                    run_count: "执行次数",
                    last_run_time: "上次执行",
                  }

                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {columnNameMap[column.id] || column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 添加新记录按钮 */}
          {onAddNew && (
            <Button onClick={onAddNew} size="sm">
              <IconPlus />
              {addButtonText}
            </Button>
          )}
        </div>
      </div>

      {/* 表格容器 */}
      <div className="rounded-md border overflow-x-auto">
        <table 
          className="caption-bottom text-sm border-collapse"
          style={{ width: table.getTotalSize() }}
        >
          {/* 表头 */}
          <thead className="[&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr 
                key={headerGroup.id}
                className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <th 
                      key={header.id} 
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() }}
                      className="h-10 px-2 text-left align-middle font-medium text-foreground whitespace-nowrap relative group"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          className="absolute right-0 top-0 h-full w-4 cursor-col-resize select-none touch-none z-10"
                        >
                          <div className="absolute right-0 top-0 h-full w-1 bg-transparent group-hover:bg-border" />
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          {/* 表体 */}
          <tbody className="[&_tr:last-child]:border-0">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td 
                      key={cell.id} 
                      style={{ width: cell.column.getSize() }}
                      className="p-2 align-middle whitespace-nowrap"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-b transition-colors">
                <td
                  colSpan={columns.length}
                  className="h-24 text-center p-2 align-middle"
                >
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      <div className="flex items-center justify-end px-2">
        {/* 分页控制器 */}
        <div className="flex items-center space-x-6 lg:space-x-8">
          {/* 每页显示数量选择 */}
          <div className="flex items-center space-x-2">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                if (onPageSizeChange) {
                  onPageSizeChange(Number(value))
                }
              }}
            >
              <SelectTrigger className="h-8 w-[90px]" id="rows-per-page">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 50, 100, 200, 500, 1000].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 页码信息 */}
          <div className="flex w-[120px] items-center justify-center text-sm font-medium">
            Page {page} of {totalPages} ({total} items)
          </div>

          {/* 分页按钮 */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange?.(1)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to first page</span>
              <IconChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to previous page</span>
              <IconChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to next page</span>
              <IconChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange?.(totalPages)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to last page</span>
              <IconChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
