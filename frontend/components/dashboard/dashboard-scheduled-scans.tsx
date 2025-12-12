"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ScheduledScanDataTable } from "@/components/scan/scheduled/scheduled-scan-data-table"
import { createScheduledScanColumns } from "@/components/scan/scheduled/scheduled-scan-columns"
import { useScheduledScans } from "@/hooks/use-scheduled-scans"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"

export function DashboardScheduledScans() {
  const [pagination, setPagination] = React.useState({ page: 1, pageSize: 10 })
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isSearching, setIsSearching] = React.useState(false)
  const router = useRouter()

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const { data, isLoading, isFetching } = useScheduledScans({
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: searchQuery || undefined,
  })

  React.useEffect(() => {
    if (!isFetching && isSearching) {
      setIsSearching(false)
    }
  }, [isFetching, isSearching])

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString("zh-CN", { hour12: false })
  const handleView = () => router.push(`/scan/scheduled/`)
  const handleEdit = () => router.push(`/scan/scheduled/`)
  const handleDelete = () => {}
  const handleToggleStatus = () => {}

  const columns = React.useMemo(
    () =>
      createScheduledScanColumns({
        formatDate,
        handleView,
        handleEdit,
        handleDelete,
        handleToggleStatus,
      }),
    [formatDate, handleView, handleEdit]
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

  const list = data?.results ?? []

  return (
    <ScheduledScanDataTable
      data={list}
      columns={columns}
      searchPlaceholder="搜索任务名称..."
      searchValue={searchQuery}
      onSearch={handleSearchChange}
      isSearching={isSearching}
      page={pagination.page}
      pageSize={pagination.pageSize}
      total={data?.total || 0}
      totalPages={data?.totalPages || 1}
      onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
      onPageSizeChange={(pageSize) => setPagination({ page: 1, pageSize })}
    />
  )
}
