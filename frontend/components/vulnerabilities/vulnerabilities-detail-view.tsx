"use client"

import React, { useState, useMemo } from "react"
import { VulnerabilitiesDataTable } from "./vulnerabilities-data-table"
import { createVulnerabilityColumns } from "./vulnerabilities-columns"
import { VulnerabilityDetailDialog } from "./vulnerability-detail-dialog"
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
import type { Vulnerability } from "@/types/vulnerability.types"
import { useScanVulnerabilities, useTargetVulnerabilities, useAllVulnerabilities } from "@/hooks/use-vulnerabilities"

interface VulnerabilitiesDetailViewProps {
  /** 扫描历史页面使用：按 scan 维度查看漏洞 */
  scanId?: number
  /** 目标详情页面使用：按 target 维度查看漏洞 */
  targetId?: number
}

export function VulnerabilitiesDetailView({
  scanId,
  targetId,
}: VulnerabilitiesDetailViewProps) {
  const [selectedVulnerabilities, setSelectedVulnerabilities] = useState<Vulnerability[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [vulnerabilityToDelete, setVulnerabilityToDelete] = useState<Vulnerability | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null)

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const paginationParams = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    search: searchQuery || undefined,
  }

  // 按 scan 维度加载（扫描历史页面）
  const scanQuery = useScanVulnerabilities(
    scanId ?? 0,
    paginationParams,
    { enabled: !!scanId },
  )

  // 按 target 维度加载（目标详情页面）
  const targetQuery = useTargetVulnerabilities(
    targetId ?? 0,
    paginationParams,
    { enabled: !!targetId && !scanId },
  )

  // 获取所有漏洞（全局漏洞页面）
  const allQuery = useAllVulnerabilities(
    paginationParams,
    { enabled: !scanId && !targetId },
  )

  // 根据参数选择使用哪个 query
  const activeQuery = scanId ? scanQuery : targetId ? targetQuery : allQuery
  const isQueryLoading = activeQuery.isLoading

  // 当请求完成时重置搜索状态
  React.useEffect(() => {
    if (!activeQuery.isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [activeQuery.isFetching, isSearching])

  const vulnerabilities = activeQuery.data?.vulnerabilities ?? []
  const paginationInfo = activeQuery.data?.pagination ?? {
    total: vulnerabilities.length,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    totalPages: 1,
  }

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

  const navigate = (path: string) => {
    console.log("导航到:", path)
  }

  const handleViewDetail = (vulnerability: Vulnerability) => {
    setSelectedVulnerability(vulnerability)
    setDetailDialogOpen(true)
  }

  const handleDeleteVulnerability = (vulnerability: Vulnerability) => {
    setVulnerabilityToDelete(vulnerability)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!vulnerabilityToDelete) return

    setDeleteDialogOpen(false)
    setIsLoading(true)

    setTimeout(() => {
      console.log("删除漏洞:", vulnerabilityToDelete.id)
      setVulnerabilityToDelete(null)
      setIsLoading(false)
    }, 1000)
  }

  const handleBulkDelete = () => {
    if (selectedVulnerabilities.length === 0) {
      return
    }
    setBulkDeleteDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    if (selectedVulnerabilities.length === 0) return

    const deletedIds = selectedVulnerabilities.map(vulnerability => vulnerability.id)

    setBulkDeleteDialogOpen(false)
    setIsLoading(true)

    setTimeout(() => {
      console.log("批量删除漏洞:", deletedIds)
      setSelectedVulnerabilities([])
      setIsLoading(false)
    }, 1000)
  }

  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination)
  }

  // 处理下载所有漏洞
  const handleDownloadAll = () => {
    // TODO: 实现下载所有漏洞功能
    console.log('下载所有漏洞')
  }

  // 处理下载选中的漏洞
  const handleDownloadSelected = () => {
    // TODO: 实现下载选中的漏洞功能
    console.log('下载选中的漏洞:', selectedVulnerabilities)
    if (selectedVulnerabilities.length === 0) {
      return
    }
  }

  const vulnerabilityColumns = useMemo(
    () =>
      createVulnerabilityColumns({
        formatDate,
        handleViewDetail,
      }),
    [handleViewDetail]
  )

  if ((isLoading || isQueryLoading) && !activeQuery.data) {
    return (
      <DataTableSkeleton
        toolbarButtonCount={2}
        rows={6}
        columns={6}
      />
    )
  }

  return (
    <>
      <VulnerabilityDetailDialog
        vulnerability={selectedVulnerability}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <VulnerabilitiesDataTable
        data={vulnerabilities}
        columns={vulnerabilityColumns}
        searchPlaceholder="搜索漏洞类型..."
        searchColumn="vulnType"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        pagination={pagination}
        setPagination={setPagination}
        paginationInfo={{
          total: paginationInfo.total,
          page: paginationInfo.page,
          pageSize: paginationInfo.pageSize,
          totalPages: paginationInfo.totalPages,
        }}
        onPaginationChange={handlePaginationChange}
        onSelectionChange={setSelectedVulnerabilities}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除漏洞 &quot;{vulnerabilityToDelete?.vulnType}&quot; 及其相关数据。
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

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除以下 {selectedVulnerabilities.length} 个漏洞及其相关数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2 p-2 bg-muted rounded-md max-h-96 overflow-y-auto">
            <ul className="text-sm space-y-1">
              {selectedVulnerabilities.map((vulnerability) => (
                <li key={vulnerability.id} className="flex items-center">
                  <span className="font-medium">{vulnerability.vulnType}</span>
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
              删除 {selectedVulnerabilities.length} 个漏洞
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
