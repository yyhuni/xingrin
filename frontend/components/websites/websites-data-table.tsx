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

import type { WebSite } from "@/types/website.types"
import type { PaginationInfo } from "@/types/common.types"

interface WebSitesDataTableProps {
  data: WebSite[]
  columns: ColumnDef<WebSite>[]
  searchPlaceholder?: string
  searchColumn?: string
  searchValue?: string
  onSearch?: (value: string) => void
  isSearching?: boolean
  pagination?: { pageIndex: number; pageSize: number }
  setPagination?: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  paginationInfo?: PaginationInfo
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onBulkDelete?: () => void                      // 批量删除回调函数
  onSelectionChange?: (selectedRows: WebSite[]) => void  // 选中行变化回调
  // 下载回调函数
  onDownloadAll?: () => void                     // 下载所有网站
  onDownloadSelected?: () => void                // 下载选中的网站
}

export function WebSitesDataTable({
  data = [],
  columns,
  searchPlaceholder = "搜索主机名...",
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
}: WebSitesDataTableProps) {
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
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id === "select" && "Select"}
                    {column.id === "url" && "URL"}
                    {column.id === "title" && "Title"}
                    {column.id === "statusCode" && "Status"}
                    {column.id === "contentLength" && "Content Length"}
                    {column.id === "location" && "Location"}
                    {column.id === "webserver" && "Web Server"}
                    {column.id === "contentType" && "Content Type"}
                    {column.id === "tech" && "Technologies"}
                    {column.id === "bodyPreview" && "Body Preview"}
                    {column.id === "vhost" && "VHost"}
                    {column.id === "discoveredAt" && "Discovered At"}
                    {column.id === "actions" && "Actions"}
                    {!["select", "url", "title", "statusCode", "contentLength", "location", "webserver", "contentType", "tech", "bodyPreview", "vhost", "discoveredAt", "actions"].includes(column.id) && column.id}
                  </DropdownMenuCheckboxItem>
                ))}
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
                    Download All Websites
                  </DropdownMenuItem>
                )}
                {onDownloadSelected && (
                  <DropdownMenuItem 
                    onClick={onDownloadSelected}
                    disabled={table.getFilteredSelectedRowModel().rows.length === 0}
                  >
                    <IconDownload className="h-4 w-4" />
                    Download Selected Websites
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

      <div className="rounded-md border overflow-x-auto">
        <Table style={{ minWidth: table.getCenterTotalSize() }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
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
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className="absolute -right-2.5 top-0 h-full w-8 cursor-col-resize select-none touch-none bg-transparent flex justify-center"
                      >
                        <div className="w-1.5 h-full bg-transparent group-hover:bg-border" />
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="group"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell 
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页控制 */}
      <div className="flex items-center justify-between px-2">
        {/* 选中行信息 */}
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {paginationInfo ? paginationInfo.total : table.getFilteredRowModel().rows.length} row(s) selected
        </div>

        {/* 分页控制器 */}
        <div className="flex items-center space-x-6 lg:space-x-8">
          {/* 每页显示数量选择 */}
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

          {/* 页码信息 */}
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>

          {/* 分页按钮 */}
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
    </div>
  )
}
