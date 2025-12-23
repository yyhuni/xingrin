import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getScheduledScans,
  getScheduledScan,
  createScheduledScan,
  updateScheduledScan,
  deleteScheduledScan,
  toggleScheduledScan,
} from '@/services/scheduled-scan.service'
import type { CreateScheduledScanRequest, UpdateScheduledScanRequest } from '@/types/scheduled-scan.types'

/**
 * 获取定时扫描列表
 */
export function useScheduledScans(params: { page?: number; pageSize?: number; search?: string } = { page: 1, pageSize: 10 }) {
  return useQuery({
    queryKey: ['scheduled-scans', params],
    queryFn: () => getScheduledScans(params),
    placeholderData: keepPreviousData,
  })
}

/**
 * 获取定时扫描详情
 */
export function useScheduledScan(id: number) {
  return useQuery({
    queryKey: ['scheduled-scan', id],
    queryFn: () => getScheduledScan(id),
    enabled: !!id,
  })
}

/**
 * 创建定时扫描
 */
export function useCreateScheduledScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateScheduledScanRequest) => createScheduledScan(data),
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['scheduled-scans'] })
    },
    onError: (error: Error) => {
      toast.error(`创建失败: ${error.message}`)
    },
  })
}

/**
 * 更新定时扫描
 */
export function useUpdateScheduledScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateScheduledScanRequest }) =>
      updateScheduledScan(id, data),
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['scheduled-scans'] })
      queryClient.invalidateQueries({ queryKey: ['scheduled-scan'] })
    },
    onError: (error: Error) => {
      toast.error(`更新失败: ${error.message}`)
    },
  })
}

/**
 * 删除定时扫描
 */
export function useDeleteScheduledScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteScheduledScan(id),
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['scheduled-scans'] })
    },
    onError: (error: Error) => {
      toast.error(`删除失败: ${error.message}`)
    },
  })
}

/**
 * 切换定时扫描启用状态
 * 使用乐观更新，避免重新获取数据导致列表重新排序
 */
export function useToggleScheduledScan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: number; isEnabled: boolean }) =>
      toggleScheduledScan(id, isEnabled),
    onMutate: async ({ id, isEnabled }) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['scheduled-scans'] })

      // 获取当前缓存的所有 scheduled-scans 查询
      const previousQueries = queryClient.getQueriesData({ queryKey: ['scheduled-scans'] })

      // 乐观更新所有匹配的查询缓存
      queryClient.setQueriesData(
        { queryKey: ['scheduled-scans'] },
        (old: any) => {
          if (!old?.results) return old
          return {
            ...old,
            results: old.results.map((item: any) =>
              item.id === id ? { ...item, isEnabled } : item
            ),
          }
        }
      )

      // 返回上下文用于回滚
      return { previousQueries }
    },
    onSuccess: (result) => {
      toast.success(result.message)
      // 不调用 invalidateQueries，保持当前排序
    },
    onError: (error: Error, _variables, context) => {
      // 回滚到之前的状态
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      toast.error(`操作失败: ${error.message}`)
    },
  })
}

