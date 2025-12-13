"use client"

import React, { useState, useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTarget } from "@/hooks/use-targets"
import {
  useTargetSubdomains,
  useScanSubdomains
} from "@/hooks/use-subdomains"
import { SubdomainsDataTable } from "./subdomains-data-table"
import { createSubdomainColumns } from "./subdomains-columns"
import { LoadingSpinner } from "@/components/loading-spinner"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
import { SubdomainService } from "@/services/subdomain.service"
import type { Subdomain } from "@/types/subdomain.types"

/**
 * 子域名详情视图组件
 * 支持两种模式：
 * 1. targetId: 显示目标下的所有子域名
 * 2. scanId: 显示扫描历史中的子域名
 */
export function SubdomainsDetailView({
  targetId,
  scanId
}: {
  targetId?: number
  scanId?: number
}) {
  const [selectedSubdomains, setSelectedSubdomains] = useState<Subdomain[]>([])

  // 分页状态
  const [pagination, setPagination] = useState({
    pageIndex: 0,  // 0-based for react-table
    pageSize: 10,
  })

  // 搜索状态（服务端搜索）
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  // 根据 targetId 或 scanId 获取子域名数据（传入分页和搜索参数）
  const targetSubdomainsQuery = useTargetSubdomains(
    targetId || 0,
    {
      page: pagination.pageIndex + 1, // 转换为 1-based
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    },
    { enabled: !!targetId }
  )
  const scanSubdomainsQuery = useScanSubdomains(
    scanId || 0,
    {
      page: pagination.pageIndex + 1, // 转换为 1-based
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    },
    { enabled: !!scanId }
  )

  // 选择当前使用的查询结果
  const activeQuery = targetId ? targetSubdomainsQuery : scanSubdomainsQuery
  const { data: subdomainsData, isLoading, isFetching, error, refetch } = activeQuery

  // 当请求完成时重置搜索状态
  React.useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])

  // 获取目标信息（仅在 targetId 模式下）
  const { data: targetData } = useTarget(targetId || 0)

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

  // 处理分页变化
  const handlePaginationChange = (newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination)
  }

  // 处理下载所有子域名
  const handleDownloadAll = async () => {
    try {
      let blob: Blob | null = null

      if (scanId) {
        const data = await SubdomainService.exportSubdomainsByScanId(scanId)
        blob = data
      } else if (targetId) {
        const data = await SubdomainService.exportSubdomainsByTargetId(targetId)
        blob = data
      } else {
        if (!subdomains || subdomains.length === 0) {
          return
        }
        const content = subdomains.map((item) => item.name).join("\n")
        blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      }

      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "subdomains"
      a.href = url
      a.download = `${prefix}-subdomains-${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("下载子域名失败", error)
    }
  }

  // 处理下载选中的子域名
  const handleDownloadSelected = () => {
    if (selectedSubdomains.length === 0) {
      return
    }
    const content = selectedSubdomains.map((item) => item.name).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `subdomains-selected-${scanId ?? targetId ?? "all"}-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 创建列定义
  const subdomainColumns = useMemo(
    () =>
      createSubdomainColumns({
        formatDate,
      }),
    [formatDate]
  )

  // 转换后端数据格式为前端 Subdomain 类型（必须在条件渲染之前调用）
  // 注意：后端使用 djangorestframework-camel-case 自动转换字段名为 camelCase
  const subdomains: Subdomain[] = useMemo(() => {
    if (!subdomainsData?.results) return []
    return subdomainsData.results.map((item: any) => ({
      id: item.id,
      name: item.name,
      discoveredAt: item.discoveredAt,  // 发现时间（后端已转换为 camelCase）
    }))
  }, [subdomainsData])

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">加载失败</h3>
        <p className="text-muted-foreground text-center mb-4">
          {error.message || "加载域名数据时出现错误，请重试"}
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

  // 加载状态（仅首次加载时显示骨架屏，搜索时不显示）
  if (isLoading && !subdomainsData) {
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
      <SubdomainsDataTable
        data={subdomains}
        columns={subdomainColumns}
        onSelectionChange={setSelectedSubdomains}
        searchPlaceholder="搜索子域名..."
        searchColumn="name"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        onDownloadAll={handleDownloadAll}
        onDownloadSelected={handleDownloadSelected}
        pagination={pagination}
        setPagination={setPagination}
        paginationInfo={{
          total: subdomainsData?.total || 0,
          page: subdomainsData?.page || 1,
          pageSize: subdomainsData?.pageSize || 10,
          totalPages: subdomainsData?.totalPages || 1,
        }}
        onPaginationChange={handlePaginationChange}
      />
    </>
  )
}
