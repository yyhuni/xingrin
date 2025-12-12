"use client"

import React, { useCallback, useMemo, useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { WebSitesDataTable } from "./websites-data-table"
import { createWebSiteColumns } from "./websites-columns"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
import { Button } from "@/components/ui/button"
import { useTargetWebSites, useScanWebSites } from "@/hooks/use-websites"
import { WebsiteService } from "@/services/website.service"
import type { WebSite } from "@/types/website.types"
import { toast } from "sonner"

export function WebSitesView({
  targetId,
  scanId,
}: {
  targetId?: number
  scanId?: number
}) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [selectedWebSites, setSelectedWebSites] = useState<WebSite[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const targetQuery = useTargetWebSites(
    targetId || 0,
    {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    },
    { enabled: !!targetId }
  )

  const scanQuery = useScanWebSites(
    scanId || 0,
    {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    },
    { enabled: !!scanId }
  )

  const activeQuery = targetId ? targetQuery : scanQuery
  const { data, isLoading, isFetching, error, refetch } = activeQuery

  // 当请求完成时重置搜索状态
  useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }, [])

  const handleViewDetail = (website: WebSite) => {
    // TODO: 实现查看网站详细功能
    console.log('查看网站详细:', website)
  }

  const columns = useMemo(
    () =>
      createWebSiteColumns({
        formatDate,
        onViewDetail: handleViewDetail,
      }),
    [formatDate]
  )

  const websites: WebSite[] = useMemo(() => {
    if (!data?.results) return []
    return data.results
  }, [data])

  const paginationInfo = data
    ? {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    }
    : undefined

  const handleSelectionChange = useCallback((selectedRows: WebSite[]) => {
    setSelectedWebSites(selectedRows)
  }, [])

  // 处理下载所有网站
  const handleDownloadAll = async () => {
    try {
      let blob: Blob | null = null

      if (scanId) {
        const data = await WebsiteService.exportWebsitesByScanId(scanId)
        blob = data
      } else if (targetId) {
        const data = await WebsiteService.exportWebsitesByTargetId(targetId)
        blob = data
      } else {
        if (!websites || websites.length === 0) {
          return
        }
        const content = websites.map((item) => item.url).join("\n")
        blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      }

      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "websites"
      a.href = url
      a.download = `${prefix}-websites-${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("下载网站列表失败", error)
      toast.error("下载网站列表失败，请稍后重试")
    }
  }

  // 处理下载选中的网站
  const handleDownloadSelected = () => {
    if (selectedWebSites.length === 0) {
      return
    }
    const content = selectedWebSites.map((item) => item.url).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "websites"
    a.href = url
    a.download = `${prefix}-websites-selected-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">加载失败</h3>
        <p className="text-muted-foreground text-center mb-4">
          加载网站数据时出现错误，请重试
        </p>
        <Button onClick={() => refetch()}>重新加载</Button>
      </div>
    )
  }

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
      <WebSitesDataTable
        data={websites}
        columns={columns}
        searchPlaceholder="搜索主机名..."
        searchColumn="url"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        pagination={pagination}
        setPagination={setPagination}
        paginationInfo={paginationInfo}
        onPaginationChange={setPagination}
        onSelectionChange={handleSelectionChange}
        onDownloadAll={handleDownloadAll}
        onDownloadSelected={handleDownloadSelected}
      />
    </>
  )
}
