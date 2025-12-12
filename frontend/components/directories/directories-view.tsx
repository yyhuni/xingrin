"use client"

import React, { useCallback, useMemo, useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { DirectoriesDataTable } from "./directories-data-table"
import { createDirectoryColumns } from "./directories-columns"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
import { Button } from "@/components/ui/button"
import { useTargetDirectories, useScanDirectories } from "@/hooks/use-directories"
import { DirectoryService } from "@/services/directory.service"
import type { Directory } from "@/types/directory.types"
import { toast } from "sonner"

export function DirectoriesView({
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
  const [selectedDirectories, setSelectedDirectories] = useState<Directory[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const targetQuery = useTargetDirectories(
    targetId || 0,
    {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    },
    { enabled: !!targetId }
  )

  const scanQuery = useScanDirectories(
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

  const handleViewDetail = (directory: Directory) => {
    // TODO: 实现查看目录详细功能
    console.log('查看目录详细:', directory)
  }

  const columns = useMemo(
    () =>
      createDirectoryColumns({
        formatDate,
        onViewDetail: handleViewDetail,
      }),
    [formatDate]
  )

  const directories: Directory[] = useMemo(() => {
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

  const handleSelectionChange = useCallback((selectedRows: Directory[]) => {
    setSelectedDirectories(selectedRows)
  }, [])

  // 处理下载所有目录
  const handleDownloadAll = async () => {
    try {
      let blob: Blob | null = null

      if (scanId) {
        const data = await DirectoryService.exportDirectoriesByScanId(scanId)
        blob = data
      } else if (targetId) {
        const data = await DirectoryService.exportDirectoriesByTargetId(targetId)
        blob = data
      } else {
        if (!directories || directories.length === 0) {
          return
        }
        const content = directories.map((item) => item.url).join("\n")
        blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      }

      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "directories"
      a.href = url
      a.download = `${prefix}-directories-${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("下载目录列表失败", error)
      toast.error("下载目录列表失败，请稍后重试")
    }
  }

  // 处理下载选中的目录
  const handleDownloadSelected = () => {
    if (selectedDirectories.length === 0) {
      return
    }
    const content = selectedDirectories.map((item) => item.url).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "directories"
    a.href = url
    a.download = `${prefix}-directories-selected-${Date.now()}.txt`
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
          加载目录数据时出现错误，请重试
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
      <DirectoriesDataTable
        data={directories}
        columns={columns}
        searchPlaceholder="搜索URL..."
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
