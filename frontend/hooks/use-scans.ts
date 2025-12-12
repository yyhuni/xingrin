import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getScans, getScan, getScanStatistics } from '@/services/scan.service'
import type { GetScansParams } from '@/types/scan.types'

export function useScans(params: GetScansParams = { page: 1, pageSize: 10 }) {
  return useQuery({
    queryKey: ['scans', params],
    queryFn: () => getScans(params),
    placeholderData: keepPreviousData,
  })
}

export function useRunningScans(page = 1, pageSize = 10) {
  return useScans({ page, pageSize, status: 'running' })
}

export function useScan(id: number) {
  return useQuery({
    queryKey: ['scan', id],
    queryFn: () => getScan(id),
    enabled: !!id,
  })
}

/**
 * 获取扫描统计数据
 */
export function useScanStatistics() {
  return useQuery({
    queryKey: ['scan-statistics'],
    queryFn: getScanStatistics,
  })
}
