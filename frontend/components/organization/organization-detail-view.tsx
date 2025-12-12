"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Building2, AlertTriangle } from "lucide-react"
import { TargetsDataTable } from "./targets/targets-data-table"
import { createTargetColumns } from "./targets/targets-columns"
import { AddTargetDialog } from "./targets/add-target-dialog"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { useOrganization, useOrganizationTargets, useUnlinkTargetsFromOrganization } from "@/hooks/use-organizations"
import type { Target } from "@/types/target.types"
import { toast } from "sonner"

/**
 * 组织详情视图组件
 * 显示组织的统计信息和目标列表
 */
export function OrganizationDetailView({
  organizationId
}: {
  organizationId: string
}) {
  const [selectedTargets, setSelectedTargets] = useState<Target[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [targetToDelete, setTargetToDelete] = useState<Target | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)

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

  // 使用解除关联 mutation
  const unlinkTargets = useUnlinkTargetsFromOrganization()

  // 使用 React Query 获取组织基本信息
  const {
    data: organization,
    isLoading: isLoadingOrg,
    error: orgError,
  } = useOrganization(parseInt(organizationId))

  // 使用 React Query 获取组织的目标列表
  const {
    data: targetsData,
    isLoading: isLoadingTargets,
    isFetching: isFetchingTargets,
    error: targetsError,
    refetch
  } = useOrganizationTargets(
    parseInt(organizationId),
    {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    }
  )

  // 当请求完成时重置搜索状态
  React.useEffect(() => {
    if (!isFetchingTargets && isSearching) {
      setIsSearching(false)
    }
  }, [isFetchingTargets, isSearching])

  const isLoading = isLoadingOrg || isLoadingTargets
  const error = orgError || targetsError

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

  // 处理解除关联目标
  const handleDeleteTarget = (target: Target) => {
    setTargetToDelete(target)
    setDeleteDialogOpen(true)
  }

  // 确认解除关联目标
  const confirmDelete = async () => {
    if (!targetToDelete) return

    setDeleteDialogOpen(false)
    const targetId = targetToDelete.id
    setTargetToDelete(null)

    // 调用解除关联 API
    unlinkTargets.mutate({
      organizationId: parseInt(organizationId),
      targetIds: [targetId]
    })
  }

  // 处理批量解除关联
  const handleBulkDelete = () => {
    if (selectedTargets.length === 0) {
      return
    }
    setBulkDeleteDialogOpen(true)
  }

  // 确认批量解除关联
  const confirmBulkDelete = async () => {
    if (selectedTargets.length === 0) return

    const targetIds = selectedTargets.map(target => target.id)

    setBulkDeleteDialogOpen(false)
    setSelectedTargets([])

    // 调用批量解除关联 API
    unlinkTargets.mutate({
      organizationId: parseInt(organizationId),
      targetIds
    })
  }

  // 处理添加目标
  const handleAddTarget = () => {
    setIsAddDialogOpen(true)
  }

  // 处理添加成功
  const handleAddSuccess = () => {
    setIsAddDialogOpen(false)
    refetch()
  }

  // 处理分页变化
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination)
    setSelectedTargets([])
  }

  // 创建列定义
  const targetColumns = useMemo(
    () =>
      createTargetColumns({
        formatDate,
        navigate,
        handleDelete: handleDeleteTarget,
      }),
    [formatDate, navigate, handleDeleteTarget]
  )

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">加载失败</h3>
        <p className="text-muted-foreground text-center mb-4">
          {error.message || "加载数据时出现错误，请重试"}
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

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        {/* 页面头部骨架 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-4 w-96" />
        </div>

        {/* 表格骨架 */}
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Building2 className="mx-auto text-muted-foreground mb-4 h-12 w-12" />
        <h3 className="text-lg font-semibold mb-2">组织不存在</h3>
        <p className="text-muted-foreground">未找到ID为 {organizationId} 的组织</p>
      </div>
    )
  }

  // 计算统计数据
  const stats = {
    totalTargets: targetsData?.total || 0,
  }

  return (
    <>
      {/* 页面头部 - 简洁版 */}
      <div className="px-4 lg:px-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              {organization.name}
            </h2>
            <p className="text-muted-foreground">
              {organization.description || "暂无描述"}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
              <span>创建于 {formatDate(organization.createdAt)}</span>
              <span>·</span>
              <span>{stats.totalTargets} 个目标</span>
            </div>
          </div>
        </div>
      </div>

      {/* 目标列表 */}
      <div className="px-4 lg:px-6">
        <TargetsDataTable
          data={targetsData?.results || []}
          columns={targetColumns}
          onAddNew={handleAddTarget}
          onBulkDelete={handleBulkDelete}
          onSelectionChange={setSelectedTargets}
          searchPlaceholder="搜索目标名称..."
          searchColumn="name"
          searchValue={searchQuery}
          onSearch={handleSearchChange}
          isSearching={isSearching}
          addButtonText="关联目标"
          pagination={pagination}
          setPagination={setPagination}
          paginationInfo={targetsData ? {
            total: targetsData.total,
            page: targetsData.page,
            pageSize: targetsData.pageSize,
            totalPages: targetsData.totalPages,
          } : undefined}
          onPaginationChange={handlePaginationChange}
        />
      </div>

      {/* 添加目标对话框 */}
      <AddTargetDialog
        organizationId={parseInt(organizationId)}
        organizationName={organization.name}
        onAdd={handleAddSuccess}
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />

      {/* 解除关联确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认解除关联</AlertDialogTitle>
            <AlertDialogDescription>
              确定要解除目标 &quot;{targetToDelete?.name}&quot; 与此组织的关联吗？此操作只会解除关联关系，目标本身不会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认解除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量解除关联确认对话框 */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量解除关联</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将解除以下 {selectedTargets.length} 个目标与此组织的关联。目标本身不会被删除，仍可正常使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
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
            >
              确认解除 {selectedTargets.length} 个关联
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
