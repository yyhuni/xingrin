import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getEngines,
  getEngine,
  createEngine,
  updateEngine,
  deleteEngine,
} from '@/services/engine.service'
import type { ScanEngine } from '@/types/engine.types'

/**
 * 获取引擎列表
 */
export function useEngines() {
  return useQuery({
    queryKey: ['engines'],
    queryFn: getEngines,
  })
}

/**
 * 获取引擎详情
 */
export function useEngine(id: number) {
  return useQuery({
    queryKey: ['engines', id],
    queryFn: () => getEngine(id),
    enabled: !!id,
  })
}

/**
 * 创建引擎
 */
export function useCreateEngine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createEngine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engines'] })
      toast.success('引擎创建成功')
    },
    onError: (error: any) => {
      toast.error('引擎创建失败', {
        description: error?.response?.data?.error || error.message,
      })
    },
  })
}

/**
 * 更新引擎
 */
export function useUpdateEngine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateEngine>[1] }) =>
      updateEngine(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['engines'] })
      queryClient.invalidateQueries({ queryKey: ['engines', variables.id] })
      toast.success('引擎更新成功')
    },
    onError: (error: any) => {
      toast.error('引擎更新失败', {
        description: error?.response?.data?.error || error.message,
      })
    },
  })
}

/**
 * 删除引擎
 */
export function useDeleteEngine() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteEngine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engines'] })
      toast.success('引擎删除成功')
    },
    onError: (error: any) => {
      toast.error('引擎删除失败', {
        description: error?.response?.data?.error || error.message,
      })
    },
  })
}

