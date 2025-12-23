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
  IconTrash,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ScanRecord } from "@/types/scan.types"
import type { PaginationInfo } from "@/types/common.types"

// 组件属性类型定义
interface ScanHistoryDataTableProps {
  data: ScanRecord[]
  columns: ColumnDef<ScanRecord>[]
  onAddNew?: () => void
  onBulkDelete?: () => void
  onSelectionChange?: (selectedRows: ScanRecord[]) => void
  searchPlaceholder?: string
  searchColumn?: string
  searchValue?: string
  onSearch?: (value: string) => void
  isSearching?: boolean
  addButtonText?: string
  // 服务端分页支持
  pagination?: { pageIndex: number; pageSize: number }
  setPagination?: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  paginationInfo?: PaginationInfo
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  hideToolbar?: boolean
  hidePagination?: boolean
}

/**
 * 扫描历史数据表格组件
 * 专门用于显示和管理扫描历史数据的表格
 * 包含搜索、分页、列显示控制等功能
 */
export function ScanHistoryDataTable({
  data = [],
  columns,
  onAddNew,
  onBulkDelete,
  onSelectionChange,
  searchPlaceholder = "搜索目标名称...",
  searchColumn = "targetName",
  searchValue,
  onSearch,
  isSearching = false,
  addButtonText = "新建扫描",
  pagination: externalPagination,
  setPagination: setExternalPagination,
  paginationInfo,
  onPaginationChange,
  hideToolbar = false,
  hidePagination = false,
}: ScanHistoryDataTableProps) {
  // 搜索本地状态
  const [localSearchValue, setLocalSearchValue] = React.useState(searchValue || "")

  // 同步外部搜索值
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
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  
  // 使用外部分页状态或内部默认状态
  const [internalPagination, setInternalPagination] = React.useState<{ pageIndex: number, pageSize: number }>({
    pageIndex: 0,
    pageSize: 10,
  })
  
  const pagination = externalPagination || internalPagination
  const setPagination = setExternalPagination || setInternalPagination

  // 过滤有效数据
  const validData = React.useMemo(() => {
    return (data || []).filter(item => item && typeof item.id !== 'undefined' && item.id !== null)
  }, [data])

  // 创建表格实例
  const table = useReactTable({
    data: validData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
      columnSizing,
    },
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onColumnSizingChange: setColumnSizing,
    // 服务端分页配置
    pageCount: paginationInfo?.totalPages ?? -1,
    manualPagination: !!paginationInfo,
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater
      setPagination(newPagination)
      if (onPaginationChange) {
        onPaginationChange(newPagination)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // 监听选中行变化
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original)
      onSelectionChange(selectedRows)
    }
  }, [rowSelection, onSelectionChange, table])

  return (
    <div className="w-full">
      {!hideToolbar && (
        <>
          <div className="flex items-center justify-between">
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

            <div className="flex items-center space-x-2">
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
                        domainName: "Domain Name",
                        summary: "Summary",
                        scanEngine: "Scan Engine Used",
                        lastScan: "Last Scan",
                        status: "Status",
                        progress: "Progress",
                      }

                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        >
                          {columnNameMap[column.id] || column.id}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>

              {onBulkDelete && (
                <Button 
                  onClick={onBulkDelete}
                  size="sm"
                  variant="outline"
                  disabled={table.getFilteredSelectedRowModel().rows.length === 0}
                  className={
                    table.getFilteredSelectedRowModel().rows.length === 0
                      ? "text-muted-foreground"
                      : "text-destructive hover:text-destructive hover:bg-destructive/10"
                  }
                >
                  <IconTrash />
                  Delete
                </Button>
              )}

              {onAddNew && (
                <Button onClick={onAddNew} size="sm">
                  <IconPlus />
                  {addButtonText}
                </Button>
              )}
            </div>
          </div>
          <div
            className="border-b mt-4"
            style={{ borderColor: "var(--sidebar-border)" }}
          />
        </>
      )}

      {/* 表格容器 */}
      <div className="rounded-md border overflow-x-auto">
        <Table style={{ minWidth: table.getCenterTotalSize() }}>
          {/* 表头 */}
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b"
                style={{ borderColor: "var(--sidebar-border)" }}
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead 
                      key={header.id} 
                      colSpan={header.colSpan}
                      style={{ width: header.getSize() }}
                      className="relative group"
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
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>

          {/* 表体 */}
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="group border-b [&>td]:py-2 last:border-b-0"
                  style={{ borderColor: "var(--sidebar)" }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow
                className="border-b"
                style={{ borderColor: "var(--sidebar)" }}
              >
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {!hidePagination && (
        <div className="border-t border-border pt-4 flex items-center justify-between px-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {paginationInfo ? paginationInfo.total : table.getFilteredRowModel().rows.length} row(s) selected
          </div>

          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger className="h-8 w-[90px]" id="rows-per-page">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50, 100, 200, 500, 1000].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
