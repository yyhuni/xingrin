/**
 * Worker 节点管理 Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workerService } from '@/services/worker.service'
import type { CreateWorkerRequest, UpdateWorkerRequest } from '@/types/worker.types'
import { toast } from 'sonner'

// Query Keys
export const workerKeys = {
  all: ['workers'] as const,
  lists: () => [...workerKeys.all, 'list'] as const,
  list: (page: number, pageSize: number) => [...workerKeys.lists(), { page, pageSize }] as const,
  details: () => [...workerKeys.all, 'detail'] as const,
  detail: (id: number) => [...workerKeys.details(), id] as const,
}

/**
 * 获取 Worker 列表
 */
export function useWorkers(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: workerKeys.list(page, pageSize),
    queryFn: () => workerService.getWorkers(page, pageSize),
  })
}

/**
 * 获取单个 Worker 详情
 */
export function useWorker(id: number) {
  return useQuery({
    queryKey: workerKeys.detail(id),
    queryFn: () => workerService.getWorker(id),
    enabled: id > 0,
  })
}

/**
 * 创建 Worker
 */
export function useCreateWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateWorkerRequest) => workerService.createWorker(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workerKeys.lists() })
      toast.success('Worker 节点创建成功')
    },
    onError: (error: Error) => {
      toast.error(`创建失败: ${error.message}`)
    },
  })
}

/**
 * 更新 Worker
 */
export function useUpdateWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateWorkerRequest }) =>
      workerService.updateWorker(id, data),
    onSuccess: (_: unknown, { id }: { id: number; data: UpdateWorkerRequest }) => {
      queryClient.invalidateQueries({ queryKey: workerKeys.lists() })
      queryClient.invalidateQueries({ queryKey: workerKeys.detail(id) })
      toast.success('Worker 节点更新成功')
    },
    onError: (error: Error) => {
      toast.error(`更新失败: ${error.message}`)
    },
  })
}

/**
 * 删除 Worker
 */
export function useDeleteWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => workerService.deleteWorker(id),
    onSuccess: () => {
      // 立即刷新活跃的列表查询
      queryClient.invalidateQueries({ 
        queryKey: workerKeys.lists(),
        refetchType: 'active',
      })
      toast.success('Worker 节点已删除')
    },
    onError: (error: Error) => {
      toast.error(`删除失败: ${error.message}`)
    },
  })
}

/**
 * 部署 Worker
 */
export function useDeployWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => workerService.deployWorker(id),
    onSuccess: (_: unknown, id: number) => {
      queryClient.invalidateQueries({ queryKey: workerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: workerKeys.lists() })
      toast.success('部署已启动')
    },
    onError: (error: Error) => {
      toast.error(`部署失败: ${error.message}`)
    },
  })
}

/**
 * 重启 Worker
 */
export function useRestartWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => workerService.restartWorker(id),
    onSuccess: (_: unknown, id: number) => {
      queryClient.invalidateQueries({ queryKey: workerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: workerKeys.lists() })
      toast.success('Worker 正在重启')
    },
    onError: (error: Error) => {
      toast.error(`重启失败: ${error.message}`)
    },
  })
}

/**
 * 停止 Worker
 */
export function useStopWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => workerService.stopWorker(id),
    onSuccess: (_: unknown, id: number) => {
      queryClient.invalidateQueries({ queryKey: workerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: workerKeys.lists() })
      toast.success('Worker 已停止')
    },
    onError: (error: Error) => {
      toast.error(`停止失败: ${error.message}`)
    },
  })
}
