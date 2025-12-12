"use client"

import React from "react"
import { ScheduledScanDataTable } from "@/components/scan/scheduled/scheduled-scan-data-table"
import { createScheduledScanColumns } from "@/components/scan/scheduled/scheduled-scan-columns"
import { CreateScheduledScanDialog } from "@/components/scan/scheduled/create-scheduled-scan-dialog"
import { EditScheduledScanDialog } from "@/components/scan/scheduled/edit-scheduled-scan-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  useScheduledScans, 
  useDeleteScheduledScan, 
  useToggleScheduledScan 
} from "@/hooks/use-scheduled-scans"
import type { ScheduledScan } from "@/types/scheduled-scan.types"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"

/**
 * 定时扫描页面
 * 管理定时扫描任务配置
 */
export default function ScheduledScanPage() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingScheduledScan, setEditingScheduledScan] = React.useState<ScheduledScan | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingScheduledScan, setDeletingScheduledScan] = React.useState<ScheduledScan | null>(null)
  
  // 分页状态
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)

  // 搜索状态
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isSearching, setIsSearching] = React.useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPage(1)
  }
  
  // 使用实际 API
  const { data, isLoading, isFetching, refetch } = useScheduledScans({ page, pageSize, search: searchQuery || undefined })

  // 当请求完成时重置搜索状态
  React.useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])
  const { mutate: deleteScheduledScan } = useDeleteScheduledScan()
  const { mutate: toggleScheduledScan } = useToggleScheduledScan()

  const scheduledScans = data?.results || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  // 格式化日期
  const formatDate = React.useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  // 查看任务详情
  const handleView = React.useCallback((scan: ScheduledScan) => {
    // TODO: 导航到详情页
  }, [])

  // 编辑任务
  const handleEdit = React.useCallback((scan: ScheduledScan) => {
    setEditingScheduledScan(scan)
    setEditDialogOpen(true)
  }, [])

  // 删除任务（打开确认弹窗）
  const handleDelete = React.useCallback((scan: ScheduledScan) => {
    setDeletingScheduledScan(scan)
    setDeleteDialogOpen(true)
  }, [])

  // 确认删除任务
  const confirmDelete = React.useCallback(() => {
    if (deletingScheduledScan) {
      deleteScheduledScan(deletingScheduledScan.id)
      setDeleteDialogOpen(false)
      setDeletingScheduledScan(null)
    }
  }, [deletingScheduledScan, deleteScheduledScan])

  // 切换任务启用状态
  const handleToggleStatus = React.useCallback((scan: ScheduledScan, enabled: boolean) => {
    toggleScheduledScan({ id: scan.id, isEnabled: enabled })
  }, [toggleScheduledScan])

  // 页码变化处理
  const handlePageChange = React.useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  // 每页数量变化处理
  const handlePageSizeChange = React.useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1) // 重置到第一页
  }, [])

  // 添加新任务
  const handleAddNew = React.useCallback(() => {
    setCreateDialogOpen(true)
  }, [])

  // 创建列定义
  const columns = React.useMemo(
    () =>
      createScheduledScanColumns({
        formatDate,
        handleView,
        handleEdit,
        handleDelete,
        handleToggleStatus,
      }),
    [formatDate, handleView, handleEdit, handleDelete, handleToggleStatus]
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div>
            <h1 className="text-3xl font-bold">定时扫描</h1>
            <p className="text-muted-foreground mt-1">配置和管理定时扫描任务</p>
          </div>
        </div>
        <DataTableSkeleton
          toolbarButtonCount={2}
          rows={5}
          columns={6}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* 页面标题 */}
      <div className="px-4 lg:px-6">
        <div>
          <h1 className="text-3xl font-bold">定时扫描</h1>
          <p className="text-muted-foreground mt-1">配置和管理定时扫描任务</p>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="px-4 lg:px-6">
        <ScheduledScanDataTable
          data={scheduledScans}
          columns={columns}
          onAddNew={handleAddNew}
          searchPlaceholder="搜索任务名称..."
          searchColumn="name"
          searchValue={searchQuery}
          onSearch={handleSearchChange}
          isSearching={isSearching}
          addButtonText="新建定时扫描"
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* 新建定时扫描对话框 */}
      <CreateScheduledScanDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => refetch()}
      />

      {/* 编辑定时扫描对话框 */}
      <EditScheduledScanDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        scheduledScan={editingScheduledScan}
        onSuccess={() => refetch()}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除定时扫描任务 &quot;{deletingScheduledScan?.name}&quot; 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
