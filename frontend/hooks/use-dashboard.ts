import { useQuery } from '@tanstack/react-query'
import { getDashboardStats, getAssetStatistics, getStatisticsHistory } from '@/services/dashboard.service'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => getDashboardStats(),
  })
}

/**
 * 获取资产统计数据（预聚合）
 */
export function useAssetStatistics() {
  return useQuery({
    queryKey: ['asset', 'statistics'],
    queryFn: getAssetStatistics,
  })
}

/**
 * 获取统计历史数据（用于折线图）
 */
export function useStatisticsHistory(days: number = 7) {
  return useQuery({
    queryKey: ['asset', 'statistics', 'history', days],
    queryFn: () => getStatisticsHistory(days),
  })
}
