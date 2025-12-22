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
  IconTrash,
  IconDownload,
  IconSearch,
  IconLoader2,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
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

import type { Directory } from "@/types/directory.types"
import type { PaginationInfo } from "@/types/common.types"

interface DirectoriesDataTableProps {
  data: Directory[]
  columns: ColumnDef<Directory>[]
  searchPlaceholder?: string
  searchColumn?: string
  searchValue?: string
  onSearch?: (value: string) => void
  isSearching?: boolean
  pagination?: { pageIndex: number; pageSize: number }
  setPagination?: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  paginationInfo?: PaginationInfo
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onBulkDelete?: () => void
  onSelectionChange?: (selectedRows: Directory[]) => void
  // 下载回调函数
  onDownloadAll?: () => void
  onDownloadSelected?: () => void
}

export function DirectoriesDataTable({
  data = [],
  columns,
  searchPlaceholder = "搜索URL...",
  searchColumn = "url",
  searchValue,
  onSearch,
  isSearching = false,
  pagination,
  setPagination,
  paginationInfo,
  onPaginationChange,
  onBulkDelete,
  onSelectionChange,
  onDownloadAll,
  onDownloadSelected,
}: DirectoriesDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [internalPagination, setInternalPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // 本地搜索输入状态（只在回车或点击按钮时触发搜索）
  const [localSearchValue, setLocalSearchValue] = React.useState(searchValue ?? "")
  
  React.useEffect(() => {
    setLocalSearchValue(searchValue ?? "")
  }, [searchValue])

  const handleSearchSubmit = () => {
    if (onSearch) {
      onSearch(localSearchValue)
    } else {
      table.getColumn(searchColumn)?.setFilterValue(localSearchValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit()
    }
  }

  const useServerPagination = !!paginationInfo && !!pagination && !!setPagination
  const tablePagination = useServerPagination ? pagination : internalPagination
  const setTablePagination = useServerPagination ? setPagination : setInternalPagination

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      columnSizing,
      pagination: tablePagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: (updater) => {
      const nextPagination =
        typeof updater === "function" ? updater(tablePagination) : updater
      setTablePagination?.(nextPagination as { pageIndex: number; pageSize: number })
      onPaginationChange?.(nextPagination)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: useServerPagination,
    pageCount: useServerPagination
      ? paginationInfo?.totalPages ?? -1
      : Math.ceil(data.length / tablePagination.pageSize) || 1,
  })

  const totalItems = useServerPagination
    ? paginationInfo?.total ?? data.length
    : table.getFilteredRowModel().rows.length

  // 处理选中行变化
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original)
      onSelectionChange(selectedRows)
    }
  }, [rowSelection, onSelectionChange, table])

  return (
    <div className="w-full space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col gap-4 @container/toolbar">
        {/* 第一行：搜索和列控制 */}
        <div className="flex flex-col gap-4 @xl/toolbar:flex-row @xl/toolbar:items-center @xl/toolbar:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <Input
              placeholder={searchPlaceholder}
              value={localSearchValue}
              onChange={(e) => setLocalSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-full @xl/toolbar:max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={handleSearchSubmit} disabled={isSearching}>
              {isSearching ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconSearch className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* 列可见性控制 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <IconLayoutColumns className="mr-2 h-4 w-4" />
                  Columns
                  <IconChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== "undefined" && column.getCanHide()
                  )
                  .map((column) => {
                    const columnTitle = {
                      url: "URL",
                      status: "Status",
                      contentLength: "Length",
                      words: "Words",
                      lines: "Lines",
                      contentType: "Content Type",
                      duration: "Duration",
                      discoveredAt: "Discovered At",
                    }[column.id] || column.id

                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {columnTitle}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 下载按钮 */}
            {(onDownloadAll || onDownloadSelected) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <IconDownload />
                    Download
                    <IconChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Download Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {onDownloadAll && (
                    <DropdownMenuItem onClick={onDownloadAll}>
                      <IconDownload className="h-4 w-4" />
                      Download All Directories
                    </DropdownMenuItem>
                  )}
                  {onDownloadSelected && (
                    <DropdownMenuItem 
                      onClick={onDownloadSelected}
                      disabled={table.getFilteredSelectedRowModel().rows.length === 0}
                    >
                      <IconDownload className="h-4 w-4" />
                      Download Selected Directories
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* 批量删除按钮 */}
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
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="rounded-md border overflow-x-auto">
        <Table style={{ minWidth: table.getCenterTotalSize() }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead 
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative group"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      {/* 列宽拖拽手柄 */}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          className="absolute -right-2.5 top-0 h-full w-5 cursor-col-resize select-none touch-none bg-transparent flex justify-center"
                        >
                          <div className="w-1.5 h-full bg-transparent group-hover:bg-border" />
                        </div>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页控制 */}
      <div className="flex flex-col gap-4 @container/pagination">
        <div className="flex flex-col gap-4 @xl/pagination:flex-row @xl/pagination:items-center @xl/pagination:justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div>
              {table.getFilteredSelectedRowModel().rows.length > 0 && (
                <span>
                  已选择 {table.getFilteredSelectedRowModel().rows.length} /{" "}
                  {totalItems} 条
                </span>
              )}
              {table.getFilteredSelectedRowModel().rows.length === 0 && (
                <span>共 {totalItems} 条</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 @sm/pagination:flex-row @sm/pagination:items-center">
            {/* 每页显示条数 */}
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-sm text-muted-foreground whitespace-nowrap">
                每页显示
              </Label>
              <Select
                value={`${tablePagination.pageSize}`}
                onValueChange={(value) => {
                  const newPageSize = Number(value)
                  const newPagination = {
                    pageSize: newPageSize,
                    pageIndex: 0,
                  }
                  setTablePagination(newPagination)
                  onPaginationChange?.(newPagination)
                }}
              >
                <SelectTrigger id="pageSize" className="h-9 w-[70px]">
                  <SelectValue placeholder={tablePagination.pageSize} />
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

            {/* 分页按钮 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center text-sm font-medium whitespace-nowrap">
                第 {tablePagination.pageIndex + 1} /{" "}
                {table.getPageCount() || 1} 页
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const newPagination = {
                      ...tablePagination,
                      pageIndex: 0,
                    }
                    setTablePagination(newPagination)
                    onPaginationChange?.(newPagination)
                  }}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">跳转到第一页</span>
                  <IconChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const newPagination = {
                      ...tablePagination,
                      pageIndex: tablePagination.pageIndex - 1,
                    }
                    setTablePagination(newPagination)
                    onPaginationChange?.(newPagination)
                  }}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Previous page</span>
                  <IconChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const newPagination = {
                      ...tablePagination,
                      pageIndex: tablePagination.pageIndex + 1,
                    }
                    setTablePagination(newPagination)
                    onPaginationChange?.(newPagination)
                  }}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Next page</span>
                  <IconChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    const newPagination = {
                      ...tablePagination,
                      pageIndex: table.getPageCount() - 1,
                    }
                    setTablePagination(newPagination)
                    onPaginationChange?.(newPagination)
                  }}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">跳转到最后一页</span>
                  <IconChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
