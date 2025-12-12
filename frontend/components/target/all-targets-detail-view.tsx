"use client"

import React, { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createAllTargetsColumns } from "@/components/target/all-targets-columns"
import { TargetsDataTable } from "@/components/target/targets-data-table"
import { AddTargetDialog } from "@/components/target/add-target-dialog"
import { InitiateScanDialog } from "@/components/scan/initiate-scan-dialog"
import { CreateScheduledScanDialog } from "@/components/scan/scheduled/create-scheduled-scan-dialog"
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
import { formatDate } from "@/lib/utils"
import { LoadingSpinner } from "@/components/loading-spinner"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
import { useTargets, useDeleteTarget, useBatchDeleteTargets } from "@/hooks/use-targets"
import type { Target } from "@/types/target.types"
import type { Organization } from "@/types/organization.types"

/**
 * 所有目标详情视图组件
 * 显示系统中所有目标的列表，支持搜索、分页、删除等操作
 */
export function AllTargetsDetailView() {
  const router = useRouter()
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTargets, setSelectedTargets] = useState<Target[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [targetToDelete, setTargetToDelete] = useState<Target | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [shouldPrefetchOrgs, setShouldPrefetchOrgs] = useState(false)
  const [initiateScanDialogOpen, setInitiateScanDialogOpen] = useState(false)
  const [scheduleScanDialogOpen, setScheduleScanDialogOpen] = useState(false)
  const [targetToScan, setTargetToScan] = useState<Target | null>(null)
  const [targetToSchedule, setTargetToSchedule] = useState<Target | null>(null)

  // 处理分页状态变化
  const handlePaginationChange = React.useCallback((newPagination: { pageIndex: number, pageSize: number }) => {
    setPagination(newPagination)
  }, [])

  const [isSearching, setIsSearching] = React.useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  // 使用 API hooks
  const { data, isLoading, isFetching, error } = useTargets(pagination.pageIndex + 1, pagination.pageSize, undefined, searchQuery || undefined)
  const deleteTargetMutation = useDeleteTarget()
  const batchDeleteMutation = useBatchDeleteTargets()

  const targets = data?.results || []
  const totalCount = data?.total || 0

  React.useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])

  // 处理添加目标
  const handleAddTarget = useCallback(() => {
    setIsAddDialogOpen(true)
  }, [])

  // 处理删除单个目标
  const handleDeleteTarget = useCallback((target: Target) => {
    setTargetToDelete(target)
    setDeleteDialogOpen(true)
  }, [])

  // 确认删除目标
  const confirmDelete = async () => {
    if (!targetToDelete) return

    try {
      await deleteTargetMutation.mutateAsync(targetToDelete.id)
      setDeleteDialogOpen(false)
      setTargetToDelete(null)
    } catch (error) {
      // 错误已在 hook 中处理
      console.error('删除失败:', error)
    }
  }

  // 处理批量删除
  const handleBatchDelete = useCallback(() => {
    if (selectedTargets.length === 0) return
    setBulkDeleteDialogOpen(true)
  }, [selectedTargets])

  // 确认批量删除
  const confirmBulkDelete = async () => {
    if (selectedTargets.length === 0) return

    try {
      await batchDeleteMutation.mutateAsync({
        ids: selectedTargets.map((t) => t.id),
      })
      setBulkDeleteDialogOpen(false)
      setSelectedTargets([])
    } catch (error) {
      // 错误已在 hook 中处理
      console.error('批量删除失败:', error)
    }
  }

  // 处理发起扫描
  const handleInitiateScan = useCallback((target: Target) => {
    setTargetToScan(target)
    setInitiateScanDialogOpen(true)
  }, [])

  // 处理定时扫描
  const handleScheduleScan = useCallback((target: Target) => {
    setTargetToSchedule(target)
    setScheduleScanDialogOpen(true)
  }, [])

  // 创建表格列
  const columns = createAllTargetsColumns({
    formatDate,
    navigate: (path: string) => router.push(path),
    handleDelete: handleDeleteTarget,
    handleInitiateScan,
    handleScheduleScan,
  })

  // 加载中
  if (isLoading) {
    return (
      <DataTableSkeleton
        toolbarButtonCount={2}
        rows={6}
        columns={5}
      />
    )
  }

  // 错误处理
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive mb-2">加载失败</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <TargetsDataTable
        data={targets}
        columns={columns}
        onAddNew={handleAddTarget}
        onAddHover={() => setShouldPrefetchOrgs(true)}
        onBulkDelete={handleBatchDelete}
        onSelectionChange={setSelectedTargets}
        searchPlaceholder="搜索目标名称..."
        searchColumn="name"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        addButtonText="添加目标"
        // 分页相关属性
        pagination={pagination}
        onPaginationChange={handlePaginationChange}
        totalCount={totalCount}
        manualPagination={true}
      />

      {/* 添加目标对话框 */}
      <AddTargetDialog
        onAdd={() => {
          setIsAddDialogOpen(false)
        }}
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        prefetchEnabled={shouldPrefetchOrgs}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除目标</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除目标 &quot;{targetToDelete?.name}&quot; 及其所有关联数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTargetMutation.isPending}
            >
              {deleteTargetMutation.isPending ? (
                <>
                  <LoadingSpinner/>
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 发起扫描对话框 */}
      <InitiateScanDialog
        organization={
          targetToScan?.organizations && targetToScan.organizations.length > 0
            ? {
                id: targetToScan.organizations[0].id,
                name: targetToScan.organizations[0].name,
                targetCount: 1, // 当前目标
              } as Organization
            : null
        }
        targetId={targetToScan?.id}
        targetName={targetToScan?.name}
        open={initiateScanDialogOpen}
        onOpenChange={setInitiateScanDialogOpen}
        onSuccess={() => {
          setTargetToScan(null)
        }}
      />

      {/* 定时扫描对话框 */}
      <CreateScheduledScanDialog
        open={scheduleScanDialogOpen}
        onOpenChange={setScheduleScanDialogOpen}
        presetTargetId={targetToSchedule?.id}
        presetTargetName={targetToSchedule?.name}
        onSuccess={() => {
          setTargetToSchedule(null)
        }}
      />

      {/* 批量删除确认对话框 */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除目标</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除以下 {selectedTargets.length} 个目标及其所有关联数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* 目标列表容器 - 固定最大高度并支持滚动 */}
          <div className="mt-2 p-2 bg-muted rounded-md max-h-96 overflow-y-auto">
            <ul className="text-sm space-y-1">
              {selectedTargets.map((target) => (
                <li key={target.id} className="flex items-center">
                  <span className="font-medium">{target.name}</span>
                  {target.description && (
                    <span className="text-muted-foreground ml-2">- {target.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={batchDeleteMutation.isPending}
            >
              {batchDeleteMutation.isPending ? (
                <>
                  <LoadingSpinner/>
                  删除中...
                </>
              ) : (
                `确认删除 ${selectedTargets.length} 个目标`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
