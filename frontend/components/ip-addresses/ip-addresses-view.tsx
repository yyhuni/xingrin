"use client"

import React, { useCallback, useMemo, useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { IPAddressesDataTable } from "./ip-addresses-data-table"
import { createIPAddressColumns } from "./ip-addresses-columns"
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton"
import { Button } from "@/components/ui/button"
import { useTargetIPAddresses, useScanIPAddresses } from "@/hooks/use-ip-addresses"
import type { IPAddress } from "@/types/ip-address.types"
import { IPAddressService } from "@/services/ip-address.service"
import { toast } from "sonner"

export function IPAddressesView({
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
  const [selectedIPAddresses, setSelectedIPAddresses] = useState<IPAddress[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const handleSearchChange = (value: string) => {
    setIsSearching(true)
    setSearchQuery(value)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }

  const targetQuery = useTargetIPAddresses(
    targetId || 0,
    {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: searchQuery || undefined,
    },
    { enabled: !!targetId }
  )

  const scanQuery = useScanIPAddresses(
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

  const columns = useMemo(
    () =>
      createIPAddressColumns({
        formatDate,
      }),
    [formatDate]
  )

  const ipAddresses: IPAddress[] = useMemo(() => {
    return data?.results ?? []
  }, [data])

  const paginationInfo = data
    ? {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    }
    : undefined
  const handleSelectionChange = useCallback((selectedRows: IPAddress[]) => {
    setSelectedIPAddresses(selectedRows)
  }, [])

  // 处理下载所有 IP 地址
  const handleDownloadAll = async () => {
    try {
      let blob: Blob | null = null

      if (scanId) {
        const data = await IPAddressService.exportIPAddressesByScanId(scanId)
        blob = data
      } else if (targetId) {
        const data = await IPAddressService.exportIPAddressesByTargetId(targetId)
        blob = data
      } else {
        if (!ipAddresses || ipAddresses.length === 0) {
          return
        }
        const content = ipAddresses.map((item) => item.ip).join("\n")
        blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      }

      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "ip-addresses"
      a.href = url
      a.download = `${prefix}-ip-addresses-${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("下载 IP 地址列表失败", error)
      toast.error("下载 IP 地址列表失败，请稍后重试")
    }
  }

  // 处理下载选中的 IP 地址
  const handleDownloadSelected = () => {
    if (selectedIPAddresses.length === 0) {
      return
    }
    const content = selectedIPAddresses.map((item) => item.ip).join("\n")
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const prefix = scanId ? `scan-${scanId}` : targetId ? `target-${targetId}` : "ip-addresses"
    a.href = url
    a.download = `${prefix}-ip-addresses-selected-${Date.now()}.txt`
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
          {error.message || "加载 IP 地址数据时出现错误，请重试"}
        </p>
        <Button onClick={() => refetch()}>重新加载</Button>
      </div>
    )
  }

  if (isLoading && !data) {
    return (
      <DataTableSkeleton
        toolbarButtonCount={1}
        rows={6}
        columns={4}
      />
    )
  }

  return (
    <>
      <IPAddressesDataTable
        data={ipAddresses}
        columns={columns}
        searchPlaceholder="搜索IP地址..."
        searchColumn="ip"
        searchValue={searchQuery}
        onSearch={handleSearchChange}
        isSearching={isSearching}
        pagination={pagination}
        setPagination={setPagination}
        paginationInfo={paginationInfo}
        onSelectionChange={handleSelectionChange}
        onDownloadAll={handleDownloadAll}
        onDownloadSelected={handleDownloadSelected}
      />
    </>
  )
}
