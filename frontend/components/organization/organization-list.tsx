"use client"

import React, { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Plus, Building2 } from "lucide-react"

// 导入 UI 组件
import { Button } from "@/components/ui/button"
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
import { LoadingSpinner } from "@/components/loading-spinner"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"

// 导入数据表格组件
import { OrganizationDataTable } from "./organization-data-table"
import { createOrganizationColumns } from "./organization-columns"

// 导入业务组件
import { AddOrganizationDialog } from "./add-organization-dialog"
import { EditOrganizationDialog } from "./edit-organization-dialog"
import { InitiateScanDialog } from "@/components/scan/initiate-scan-dialog"
import { CreateScheduledScanDialog } from "@/components/scan/scheduled/create-scheduled-scan-dialog"

// 导入 React Query Hooks
import {
  useOrganizations,
  useDeleteOrganization,
  useBatchDeleteOrganizations,
  useUpdateOrganization,
} from "@/hooks/use-organizations"

// 导入类型定义
import type { Organization } from "@/types/organization.types"

/**
 * 组织列表组件（使用 React Query）
 * 
 * 功能特性：
 * 1. 统一的 Loading 状态管理
 * 2. 自动缓存和重新验证
 * 3. 乐观更新
 * 4. 自动错误处理
 * 5. 更好的用户体验
 */
export function OrganizationList() {
  // 状态管理
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [initiateScanDialogOpen, setInitiateScanDialogOpen] = useState(false)
  const [scheduleScanDialogOpen, setScheduleScanDialogOpen] = useState(false)
  const [organizationToDelete, setOrganizationToDelete] = useState<Organization | null>(null)
  const [organizationToEdit, setOrganizationToEdit] = useState<Organization | null>(null)
  const [organizationToScan, setOrganizationToScan] = useState<Organization | null>(null)
  const [organizationToSchedule, setOrganizationToSchedule] = useState<Organization | null>(null)
  const [selectedOrganizations, setSelectedOrganizations] = useState<Organization[]>([])
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  
  // 分页状态
  const [pagination, setPagination] = useState({
    pageIndex: 0,  // 0-based for react-table
    pageSize: 10,
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  // 使用 React Query 获取组织数据
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch
  } = useOrganizations({
    page: pagination.pageIndex + 1, // 转换为 1-based
    pageSize: pagination.pageSize,
    search: searchQuery || undefined,
  }, { enabled: true })

  useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])

  // Mutations
  const deleteOrganization = useDeleteOrganization()
  const batchDeleteOrganizations = useBatchDeleteOrganizations()
  const updateOrganization = useUpdateOrganization()

  // 辅助函数 - 格式化日期
  const formatDate = useCallback((dateString: string): string => {
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

  // 处理删除操作
  const handleDelete = useCallback((org: Organization) => {
    setOrganizationToDelete(org)
    setDeleteDialogOpen(true)
  }, [])

  // 处理编辑操作
  const handleEdit = useCallback((org: Organization) => {
    setOrganizationToEdit(org)
    setEditDialogOpen(true)
  }, [])

  // 处理发起扫描操作
  const handleInitiateScan = useCallback((org: Organization) => {
    setOrganizationToScan(org)
    setInitiateScanDialogOpen(true)
  }, [])

  // 处理计划扫描操作
  const handleScheduleScan = useCallback((org: Organization) => {
    setOrganizationToSchedule(org)
    setScheduleScanDialogOpen(true)
  }, [])

  // 导航到详情页面（使用 Next.js 客户端路由）
  const router = useRouter()
  const navigate = useCallback((path: string) => {
    router.push(path)
  }, [router])

  // 创建列定义
  const columns = useMemo(() =>
    createOrganizationColumns({ 
      formatDate, 
      navigate, 
      handleEdit, 
      handleDelete,
      handleInitiateScan,
      handleScheduleScan,
    }),
    [formatDate, navigate, handleEdit, handleDelete, handleInitiateScan, handleScheduleScan]
  )

  // 确认删除组织
  const confirmDelete = async () => {
    if (!organizationToDelete) return

    setDeleteDialogOpen(false)
    setOrganizationToDelete(null)
    
    // 使用 React Query 的删除 mutation（自动乐观更新）
    deleteOrganization.mutate(Number(organizationToDelete.id))
  }

  // 编辑组织成功回调
  const handleOrganizationEdited = (updatedOrganization: Organization) => {
    // 只需要关闭对话框，React Query 已经在 dialog 中处理了更新
    setEditDialogOpen(false)
    setOrganizationToEdit(null)
  }

  // 批量删除处理函数
  const handleBulkDelete = () => {
    if (selectedOrganizations.length === 0) {
      return
    }
    setBulkDeleteDialogOpen(true)
  }

  // 确认批量删除
  const confirmBulkDelete = async () => {
    if (selectedOrganizations.length === 0) return

    const deletedIds = selectedOrganizations.map(org => Number(org.id))
    
    setBulkDeleteDialogOpen(false)
    setSelectedOrganizations([])
    
    // 使用 React Query 的批量删除 mutation（自动乐观更新）
    batchDeleteOrganizations.mutate(deletedIds)
  }

  // 处理分页变化
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination)
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <Trash2 className="text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">加载失败</h3>
        <p className="text-muted-foreground text-center mb-4">
          {error.message || "加载组织数据时出现错误，请重试"}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          重新加载
        </Button>
      </div>
    )
  }

  // 加载状态
  if (isLoading) {
    return <OrganizationListSkeleton />
  }

  // 数据为空检查
  if (!data) {
    return <OrganizationListSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* 主要内容 */}
      <OrganizationDataTable
        data={data.organizations}
        columns={columns}
        onAddNew={() => setAddDialogOpen(true)}
        onBulkDelete={handleBulkDelete}
        onSelectionChange={setSelectedOrganizations}
        searchPlaceholder="搜索组织名称..."
        searchColumn="name"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        pagination={pagination}
        setPagination={setPagination}
        paginationInfo={data.pagination}
        onPaginationChange={handlePaginationChange}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除组织 &quot;{organizationToDelete?.name}&quot; 并解除其与域名的关联。域名本身不会被删除，仍可正常使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteOrganization.isPending}
            >
              {deleteOrganization.isPending ? (
                <>
                  <LoadingSpinner/>
                  删除中...
                </>
              ) : (
                "删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 编辑组织对话框 */}
      {organizationToEdit && (
        <EditOrganizationDialog
          organization={organizationToEdit}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onEdit={handleOrganizationEdited}
        />
      )}

      {/* 批量删除确认对话框 */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除以下 {selectedOrganizations.length} 个组织并解除其与域名的关联。域名本身不会被删除，仍可正常使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* 组织列表容器 - 固定最大高度并支持滚动 */}
          <div className="mt-2 p-2 bg-muted rounded-md max-h-96 overflow-y-auto">
            <ul className="text-sm space-y-1">
              {selectedOrganizations.map((org) => (
                <li key={org.id} className="flex items-center">
                  <span className="font-medium">{org.name}</span>
                  {org.description && (
                    <span className="ml-2 text-muted-foreground">- {org.description}</span>
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
              disabled={batchDeleteOrganizations.isPending}
            >
              {batchDeleteOrganizations.isPending ? (
                <>
                  <LoadingSpinner/>
                  删除中...
                </>
              ) : (
                `删除 ${selectedOrganizations.length} 个组织`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加组织对话框 */}
      <AddOrganizationDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={() => {
          // React Query 会自动刷新数据，不需要手动处理
          setAddDialogOpen(false)
        }} 
      />

      {/* 发起扫描对话框 */}
      <InitiateScanDialog
        organization={organizationToScan}
        organizationId={organizationToScan?.id}
        open={initiateScanDialogOpen}
        onOpenChange={setInitiateScanDialogOpen}
        onSuccess={() => {
          setOrganizationToScan(null)
        }}
      />

      {/* 定时扫描对话框 */}
      <CreateScheduledScanDialog
        open={scheduleScanDialogOpen}
        onOpenChange={setScheduleScanDialogOpen}
        presetOrganizationId={organizationToSchedule?.id}
        presetOrganizationName={organizationToSchedule?.name}
        onSuccess={() => {
          setOrganizationToSchedule(null)
        }}
      />
    </div>
  )
}

function OrganizationListSkeleton() {
  return (
    <DataTableSkeleton toolbarButtonCount={2} rows={6} columns={4} />
  )
}
