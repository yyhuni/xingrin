"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ScanHistoryDataTable } from "@/components/scan/history/scan-history-data-table"
import { createScanHistoryColumns } from "@/components/scan/history/scan-history-columns"
import { useScans } from "@/hooks/use-scans"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
import type { ScanRecord } from "@/types/scan.types"
import type { ColumnDef } from "@tanstack/react-table"

export function DashboardScanHistory() {
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 5 })
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isSearching, setIsSearching] = React.useState(false)
  const router = useRouter()

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const { data, isLoading, isFetching } = useScans({
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    status: 'running',
    search: searchQuery || undefined,
  })

  React.useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])

  const formatDate = React.useCallback((dateString: string) => new Date(dateString).toLocaleString("zh-CN", { hour12: false }), [])
  const navigate = React.useCallback((path: string) => router.push(path), [router])
  const handleDelete = React.useCallback(() => {}, [])
  const handleStop = React.useCallback((scan: ScanRecord) => {
    // 仪表盘列表暂时不提供停止逻辑，实现时可在此调用对应的停止扫描接口
  }, [])

  const columns = React.useMemo(
    () => createScanHistoryColumns({ formatDate, navigate, handleDelete, handleStop }) as ColumnDef<ScanRecord>[],
    [formatDate, navigate, handleDelete, handleStop]
  )

  if (isLoading && !data) {
    return (
      <DataTableSkeleton
        withPadding={false}
        toolbarButtonCount={2}
        rows={4}
        columns={3}
      />
    )
  }

  const paginationInfo = data
    ? { total: data.total, page: data.page, pageSize: data.pageSize, totalPages: data.totalPages }
    : undefined

  return (
    <ScanHistoryDataTable
      data={data?.results ?? []}
      columns={columns}
      searchValue={searchQuery}
      onSearch={handleSearchChange}
      isSearching={isSearching}
      hidePagination
      pagination={pagination}
      setPagination={setPagination}
      paginationInfo={paginationInfo}
      onPaginationChange={setPagination}
    />
  )
}
