"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { IconLayoutColumns, IconBug, IconRadar, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconSearch, IconLoader2, IconChevronDown } from "@tabler/icons-react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllVulnerabilities } from "@/hooks/use-vulnerabilities"
import { useScans } from "@/hooks/use-scans"
import { VulnerabilityDetailDialog } from "@/components/vulnerabilities/vulnerability-detail-dialog"
import { createVulnerabilityColumns } from "@/components/vulnerabilities/vulnerabilities-columns"
import { createScanHistoryColumns } from "@/components/scan/history/scan-history-columns"
import { ScanProgressDialog, buildScanProgressData, type ScanProgressData } from "@/components/scan/scan-progress-dialog"
import { getScan } from "@/services/scan.service"
import { useRouter } from "next/navigation"
import type { Vulnerability } from "@/types/vulnerability.types"
import type { ScanRecord } from "@/types/scan.types"

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function DashboardDataTable() {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState("scans")
  const [vulnColumnVisibility, setVulnColumnVisibility] = React.useState<VisibilityState>({})
  const [scanColumnVisibility, setScanColumnVisibility] = React.useState<VisibilityState>({})
  const [vulnColumnSizing, setVulnColumnSizing] = React.useState<ColumnSizingState>({})
  const [scanColumnSizing, setScanColumnSizing] = React.useState<ColumnSizingState>({})
  
  // 漏洞详情弹窗
  const [selectedVuln, setSelectedVuln] = React.useState<Vulnerability | null>(null)
  const [vulnDialogOpen, setVulnDialogOpen] = React.useState(false)
  
  // 扫描进度弹窗
  const [progressData, setProgressData] = React.useState<ScanProgressData | null>(null)
  const [progressDialogOpen, setProgressDialogOpen] = React.useState(false)
  
  // 分页状态
  const [vulnPagination, setVulnPagination] = React.useState({ pageIndex: 0, pageSize: 10 })
  const [scanPagination, setScanPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  // 服务端搜索状态
  const [vulnSearchQuery, setVulnSearchQuery] = React.useState("")
  const [scanSearchQuery, setScanSearchQuery] = React.useState("")
  const [localVulnSearch, setLocalVulnSearch] = React.useState("")
  const [localScanSearch, setLocalScanSearch] = React.useState("")
  const [isVulnSearching, setIsVulnSearching] = React.useState(false)
  const [isScanSearching, setIsScanSearching] = React.useState(false)

  // 获取漏洞数据
  const vulnQuery = useAllVulnerabilities({
    page: vulnPagination.pageIndex + 1,
    pageSize: vulnPagination.pageSize,
    search: vulnSearchQuery || undefined,
  })
  
  // 获取扫描数据
  const scanQuery = useScans({
    page: scanPagination.pageIndex + 1,
    pageSize: scanPagination.pageSize,
    search: scanSearchQuery || undefined,
  })

  // 当请求完成时重置搜索状态
  React.useEffect(() => {
    if (!vulnQuery.isFetching && isVulnSearching) {
      setIsVulnSearching(false)
    }
  }, [vulnQuery.isFetching, isVulnSearching])

  React.useEffect(() => {
    if (!scanQuery.isFetching && isScanSearching) {
      setIsScanSearching(false)
    }
  }, [scanQuery.isFetching, isScanSearching])

  // 搜索处理
  const handleVulnSearch = () => {
    setIsVulnSearching(true)
    setVulnSearchQuery(localVulnSearch)
    setVulnPagination(prev => ({ ...prev, pageIndex: 0 }))
  }

  const handleScanSearch = () => {
    setIsScanSearching(true)
    setScanSearchQuery(localScanSearch)
    setScanPagination(prev => ({ ...prev, pageIndex: 0 }))
  }

  const vulnerabilities = vulnQuery.data?.vulnerabilities ?? []
  const scans = scanQuery.data?.results ?? []

  // 格式化日期
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  // 点击漏洞行
  const handleVulnRowClick = React.useCallback((vuln: Vulnerability) => {
    setSelectedVuln(vuln)
    setVulnDialogOpen(true)
  }, [])

  // 漏洞列定义 - 复用 vulnerabilities 页面的列
  const vulnColumns = React.useMemo(
    () => createVulnerabilityColumns({
      formatDate,
      handleViewDetail: handleVulnRowClick,
    }),
    [handleVulnRowClick]
  )

  // 扫描进度查看
  const handleViewProgress = React.useCallback(async (scan: ScanRecord) => {
    try {
      const fullScan = await getScan(scan.id)
      const data = buildScanProgressData(fullScan)
      setProgressData(data)
      setProgressDialogOpen(true)
    } catch (error) {
      console.error("获取扫描详情失败:", error)
    }
  }, [])

  // 扫描列定义 - 复用 scan-history 页面的列
  const scanColumns = React.useMemo(
    () => createScanHistoryColumns({
      formatDate,
      navigate: (path: string) => router.push(path),
      handleDelete: () => {}, // Dashboard 不需要删除功能
      handleStop: () => {},   // Dashboard 不需要停止功能
      handleViewProgress,
    }),
    [router, handleViewProgress]
  )

  // 漏洞表格
  const vulnTable = useReactTable({
    data: vulnerabilities,
    columns: vulnColumns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setVulnColumnVisibility,
    onColumnSizingChange: setVulnColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    state: {
      columnVisibility: vulnColumnVisibility,
      columnSizing: vulnColumnSizing,
    },
    manualPagination: true,
    pageCount: vulnQuery.data?.pagination?.totalPages ?? -1,
  })

  // 扫描表格
  const scanTable = useReactTable({
    data: scans,
    columns: scanColumns,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setScanColumnVisibility,
    onColumnSizingChange: setScanColumnSizing,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    state: {
      columnVisibility: scanColumnVisibility,
      columnSizing: scanColumnSizing,
    },
    manualPagination: true,
    pageCount: scanQuery.data?.totalPages ?? -1,
  })

  const currentTable = activeTab === "vulnerabilities" ? vulnTable : scanTable
  const currentLocalSearch = activeTab === "vulnerabilities" ? localVulnSearch : localScanSearch
  const setCurrentLocalSearch = activeTab === "vulnerabilities" ? setLocalVulnSearch : setLocalScanSearch
  const handleCurrentSearch = activeTab === "vulnerabilities" ? handleVulnSearch : handleScanSearch
  const isCurrentSearching = activeTab === "vulnerabilities" ? isVulnSearching : isScanSearching
  const isLoading = activeTab === "vulnerabilities" ? vulnQuery.isLoading : scanQuery.isLoading
  const pagination = activeTab === "vulnerabilities" ? vulnPagination : scanPagination
  const setPagination = activeTab === "vulnerabilities" ? setVulnPagination : setScanPagination
  const totalPages = activeTab === "vulnerabilities" 
    ? (vulnQuery.data?.pagination?.totalPages ?? 1) 
    : (scanQuery.data?.totalPages ?? 1)

  return (
    <>
      <VulnerabilityDetailDialog
        vulnerability={selectedVuln}
        open={vulnDialogOpen}
        onOpenChange={setVulnDialogOpen}
      />
      {progressData && (
        <ScanProgressDialog
          open={progressDialogOpen}
          onOpenChange={setProgressDialogOpen}
          data={progressData}
        />
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab + 搜索框 + Columns 在同一行 */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="scans" className="gap-1.5">
              <IconRadar className="h-4 w-4" />
              扫描历史
            </TabsTrigger>
            <TabsTrigger value="vulnerabilities" className="gap-1.5">
              <IconBug className="h-4 w-4" />
              漏洞
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Input
              placeholder={activeTab === "vulnerabilities" ? "搜索漏洞类型..." : "搜索目标名称..."}
              value={currentLocalSearch}
              onChange={(e) => setCurrentLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCurrentSearch()}
              className="h-8 w-[200px]"
            />
            <Button variant="outline" size="sm" onClick={handleCurrentSearch} disabled={isCurrentSearching} className="h-8">
              {isCurrentSearching ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconSearch className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <IconLayoutColumns />
                  Columns
                  <IconChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {currentTable
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 表格内容 */}
        <TabsContent value="vulnerabilities" className="mt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table style={{ minWidth: vulnTable.getCenterTotalSize() }}>
                <TableHeader>
                  {vulnTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className="relative group"
                        >
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                  {vulnTable.getRowModel().rows?.length ? (
                    vulnTable.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="hover:bg-muted/50"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={vulnColumns.length} className="h-24 text-center">
                        暂无漏洞数据
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scans" className="mt-0">
          {scanQuery.isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table style={{ minWidth: scanTable.getCenterTotalSize() }}>
                <TableHeader>
                  {scanTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id}
                          style={{ width: header.getSize() }}
                          className="relative group"
                        >
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                  {scanTable.getRowModel().rows?.length ? (
                    scanTable.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="hover:bg-muted/50"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={scanColumns.length} className="h-24 text-center">
                        暂无扫描记录
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* 分页控制 */}
        <div className="flex items-center justify-between px-2 py-4">
          {/* 选中行信息 */}
          <div className="flex-1 text-sm text-muted-foreground">
            {currentTable.getFilteredSelectedRowModel().rows.length} of{" "}
            {activeTab === "vulnerabilities" 
              ? (vulnQuery.data?.pagination?.total ?? 0) 
              : (scanQuery.data?.total ?? 0)} row(s) selected
          </div>

          {/* 分页控制器 */}
          <div className="flex items-center space-x-6 lg:space-x-8">
            {/* 每页显示数量选择 */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${pagination.pageSize}`}
                onValueChange={(value) => {
                  setPagination(prev => ({ ...prev, pageIndex: 0, pageSize: Number(value) }))
                }}
              >
                <SelectTrigger className="h-8 w-[90px]" id="rows-per-page">
                  <SelectValue placeholder={pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 页码信息 */}
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {pagination.pageIndex + 1} of {totalPages}
            </div>

            {/* 分页按钮 */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: 0 }))}
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) }))}
                disabled={pagination.pageIndex === 0}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}
                disabled={pagination.pageIndex >= totalPages - 1}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setPagination(prev => ({ ...prev, pageIndex: totalPages - 1 }))}
                disabled={pagination.pageIndex >= totalPages - 1}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Tabs>
    </>
  )
}
