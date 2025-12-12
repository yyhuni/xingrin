"use client"

import React, { useState, useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTargetEndpoints } from "@/hooks/use-targets"
import { useDeleteEndpoint, useScanEndpoints } from "@/hooks/use-endpoints"
import { EndpointsDataTable } from "./endpoints-data-table"
import { createEndpointColumns } from "./endpoints-columns"
import { LoadingSpinner } from "@/components/loading-spinner"
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
import type { Endpoint } from "@/types/endpoint.types"
import { EndpointService } from "@/services/endpoint.service"
import { toast } from "sonner"

/**
 * 目标端点详情视图组件
 * 用于显示和管理目标下的端点列表
 */
export function EndpointsDetailView({
  targetId,
  scanId,
}: {
  targetId?: number
  scanId?: number
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [endpointToDelete, setEndpointToDelete] = useState<Endpoint | null>(null)
  const [selectedEndpoints, setSelectedEndpoints] = useState<Endpoint[]>([])

  // 分页状态管理
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  // 删除相关 hooks
  const deleteEndpoint = useDeleteEndpoint()

  // 使用 React Query 获取端点数据：优先按 targetId，其次按 scanId（历史快照）
  const targetEndpointsQuery = useTargetEndpoints(targetId || 0, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: searchQuery || undefined,
  }, { enabled: !!targetId })

  const scanEndpointsQuery = useScanEndpoints(scanId || 0, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: searchQuery || undefined,
  }, { enabled: !!scanId })

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = targetId ? targetEndpointsQuery : scanEndpointsQuery

  React.useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])

  // 辅助函数 - 格式化日期
  const formatDate = React.useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }, [])

  // 导航函数
  const router = useRouter()
  const navigate = React.useCallback((path: string) => {
    router.push(path)
  }, [router])

  // 处理删除端点
  const handleDeleteEndpoint = React.useCallback((endpoint: Endpoint) => {
    setEndpointToDelete(endpoint)
    setDeleteDialogOpen(true)
  }, [])

  // 确认删除端点
  const confirmDelete = async () => {
    if (!endpointToDelete) return

    setDeleteDialogOpen(false)
    setEndpointToDelete(null)

    deleteEndpoint.mutate(endpointToDelete.id)
  }

  // 处理分页变化
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination)
  }

  const handleSelectionChange = React.useCallback((selectedRows: Endpoint[]) => {
    setSelectedEndpoints(selectedRows)
  }, [])

  // 创建列定义
  const endpointColumns = useMemo(
    () =>
      createEndpointColumns({
        formatDate,
        navigate,
        handleDelete: handleDeleteEndpoint,
      }),
    [formatDate, navigate, handleDeleteEndpoint]
  )

  // 下载所有端点 URL
  const handleDownloadAll = async () => {
    try {
      let blob: Blob | null = null

      if (scanId) {
        const data = await EndpointService.exportEndpointsByScanId(scanId)
        blob = data
      } else if (targetId) {
        const data = await EndpointService.exportEndpointsByTargetId(targetId)
        blob = data
      } else {
        const endpoints: Endpoint[] = (data as any)?.endpoints || []
        if (!endpoints || endpoints.length === 0) {
          return
        }
        const content = endpoints.map((item) => item.url).join("\n")
        blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      }

      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "endpoints"
      a.href = url
      a.download = `${prefix}-endpoints-${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("下载端点列表失败", error)
      toast.error("下载端点列表失败，请稍后重试")
    }
  }

  // 下载选中的端点 URL
  const handleDownloadSelected = () => {
    if (selectedEndpoints.length === 0) {
      return
    }
    const content = selectedEndpoints.map((item) => item.url).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "endpoints"
    a.href = url
    a.download = `${prefix}-endpoints-selected-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">加载失败</h3>
        <p className="text-muted-foreground text-center mb-4">
          {error.message || "加载端点数据时出现错误，请重试"}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          重新加载
        </button>
      </div>
    )
  }

  // 加载状态（仅首次加载时显示骨架屏）
  if (isLoading && !data) {
    return (
      <DataTableSkeleton
        toolbarButtonCount={2}
        rows={6}
        columns={5}
      />
    )
  }

  return (
    <>
      <EndpointsDataTable
        data={data?.endpoints || []}
        columns={endpointColumns}
        searchPlaceholder="搜索主机名..."
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        pagination={pagination}
        onPaginationChange={handlePaginationChange}
        totalCount={data?.pagination?.total || 0}
        totalPages={data?.pagination?.totalPages || 1}
        onSelectionChange={handleSelectionChange}
        onDownloadAll={handleDownloadAll}
        onDownloadSelected={handleDownloadSelected}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除该端点及其相关数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEndpoint.isPending}
            >
              {deleteEndpoint.isPending ? (
                <>
                  <LoadingSpinner />
                  删除中...
                </>
              ) : (
                "删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
