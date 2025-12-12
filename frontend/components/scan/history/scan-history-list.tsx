"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { ScanHistoryDataTable } from "./scan-history-data-table"
import { createScanHistoryColumns } from "./scan-history-columns"
import type { ScanRecord } from "@/types/scan.types"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
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
import { toast } from "sonner"
import { useScans } from "@/hooks/use-scans"
import { deleteScan, bulkDeleteScans, stopScan, getScan } from "@/services/scan.service"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ScanProgressDialog, buildScanProgressData, type ScanProgressData } from "@/components/scan/scan-progress-dialog"

/**
 * 扫描历史列表组件
 * 用于显示和管理扫描历史记录
 */
export function ScanHistoryList() {
  const queryClient = useQueryClient()
  const [selectedScans, setSelectedScans] = useState<ScanRecord[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [scanToDelete, setScanToDelete] = useState<ScanRecord | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [stopDialogOpen, setStopDialogOpen] = useState(false)
  const [scanToStop, setScanToStop] = useState<ScanRecord | null>(null)
  
  // 进度弹窗状态
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [progressData, setProgressData] = useState<ScanProgressData | null>(null)
  
  // 分页状态
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }
  
  // 获取扫描列表数据
  const { data, isLoading, isFetching, error } = useScans({
    page: pagination.pageIndex + 1, // API 页码从 1 开始
    pageSize: pagination.pageSize,
    search: searchQuery || undefined,
  })

  // 当请求完成时重置搜索状态
  React.useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])
  
  // 扫描列表数据
  const scans = data?.results || []
  
  // 删除单个扫描的 mutation
  const deleteMutation = useMutation({
    mutationFn: deleteScan,
    onSuccess: () => {
      // 刷新列表数据
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
  })
  
  // 批量删除的 mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteScans,
    onSuccess: () => {
      // 刷新列表数据
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      // 清空选中项
      setSelectedScans([])
    },
  })
  
  // 停止扫描的 mutation
  const stopMutation = useMutation({
    mutationFn: stopScan,
    onSuccess: () => {
      // 刷新列表数据
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
  })

  // 辅助函数 - 格式化日期
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

  // 导航函数
  const router = useRouter()
  const navigate = (path: string) => {
    router.push(path)
  }

  // 处理删除扫描记录
  const handleDeleteScan = (scan: ScanRecord) => {
    setScanToDelete(scan)
    setDeleteDialogOpen(true)
  }

  // 确认删除扫描记录
  const confirmDelete = async () => {
    if (!scanToDelete) return

    setDeleteDialogOpen(false)
    
    try {
      await deleteMutation.mutateAsync(scanToDelete.id)
      toast.success(`已删除扫描记录: ${scanToDelete.targetName}`)
    } catch (error) {
      toast.error("删除失败，请重试")
      console.error('删除失败:', error)
    } finally {
      setScanToDelete(null)
    }
  }

  // 处理批量删除
  const handleBulkDelete = () => {
    if (selectedScans.length === 0) {
      return
    }
    setBulkDeleteDialogOpen(true)
  }
  
  // 处理停止扫描
  const handleStopScan = (scan: ScanRecord) => {
    setScanToStop(scan)
    setStopDialogOpen(true)
  }
  
  // 确认停止扫描
  const confirmStop = async () => {
    if (!scanToStop) return

    setStopDialogOpen(false)
    
    try {
      await stopMutation.mutateAsync(scanToStop.id)
      toast.success(`已停止扫描任务: ${scanToStop.targetName}`)
    } catch (error) {
      toast.error("停止失败，请重试")
      console.error('停止扫描失败:', error)
    } finally {
      setScanToStop(null)
    }
  }
  
  // 查看扫描进度（获取单个扫描的最新数据）
  const handleViewProgress = async (scan: ScanRecord) => {
    try {
      // 获取单个扫描的最新数据，而不是刷新整个列表
      const freshScan = await getScan(scan.id)
      const progressData = buildScanProgressData(freshScan)
      setProgressData(progressData)
      setProgressDialogOpen(true)
    } catch (error) {
      // 如果获取失败，使用当前数据
      const progressData = buildScanProgressData(scan)
      setProgressData(progressData)
      setProgressDialogOpen(true)
    }
  }

  // 确认批量删除
  const confirmBulkDelete = async () => {
    if (selectedScans.length === 0) return

    const deletedIds = selectedScans.map(scan => scan.id)
    
    setBulkDeleteDialogOpen(false)
    
    try {
      const result = await bulkDeleteMutation.mutateAsync(deletedIds)
      toast.success(result.message || `已删除 ${result.deletedCount} 个扫描记录`)
    } catch (error) {
      toast.error("批量删除失败，请重试")
      console.error('批量删除失败:', error)
    }
  }


  // 处理分页变化
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination)
  }

  // 创建列定义
  const scanColumns = useMemo(
    () =>
      createScanHistoryColumns({
        formatDate,
        navigate,
        handleDelete: handleDeleteScan,
        handleStop: handleStopScan,
        handleViewProgress,
      }),
    [navigate]
  )

  // 错误处理
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">加载扫描历史失败</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['scans'] })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          重试
        </button>
      </div>
    )
  }

  // 加载状态
  if (isLoading) {
    return (
      <DataTableSkeleton
        toolbarButtonCount={2}
        rows={6}
        columns={6}
        withPadding={false}
      />
    )
  }

  return (
    <>
      <ScanHistoryDataTable
        data={scans}
        columns={scanColumns as ColumnDef<ScanRecord>[]}
        onBulkDelete={handleBulkDelete}
        onSelectionChange={setSelectedScans}
        searchPlaceholder="搜索目标名称..."
        searchColumn="targetName"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        pagination={pagination}
        setPagination={setPagination}
        paginationInfo={{
          total: data?.total || 0,
          page: data?.page || 1,
          pageSize: data?.pageSize || 10,
          totalPages: data?.totalPages || 1,
        }}
        onPaginationChange={handlePaginationChange}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除扫描记录 &quot;{scanToDelete?.targetName}&quot; 及其相关数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除以下 {selectedScans.length} 个扫描记录及其相关数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* 扫描记录列表容器 */}
          <div className="mt-2 p-2 bg-muted rounded-md max-h-96 overflow-y-auto">
            <ul className="text-sm space-y-1">
              {selectedScans.map((scan) => (
                <li key={scan.id} className="flex items-center justify-between">
                  <span className="font-medium">{scan.targetName}</span>
                  <span className="text-muted-foreground text-xs">{scan.engineName}</span>
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除 {selectedScans.length} 个记录
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 停止扫描确认对话框 */}
      <AlertDialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认停止扫描</AlertDialogTitle>
            <AlertDialogDescription>
              确定要停止扫描任务 &quot;{scanToStop?.targetName}&quot; 吗？扫描将会中止，已收集的数据将会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmStop} 
              className="bg-chart-2 text-white hover:bg-chart-2/90"
            >
              停止扫描
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 扫描进度弹窗 */}
      <ScanProgressDialog
        open={progressDialogOpen}
        onOpenChange={setProgressDialogOpen}
        data={progressData}
      />
    </>
  )
}
