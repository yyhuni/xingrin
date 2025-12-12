import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Directory, DirectoryListResponse } from '@/types/directory.types'

// API 服务函数
const directoryService = {
  // 获取目标的目录列表
  getTargetDirectories: async (
    targetId: number,
    params: { page: number; pageSize: number; search?: string }
  ): Promise<DirectoryListResponse> => {
    const searchParam = params.search ? `&search=${encodeURIComponent(params.search)}` : ''
    const response = await fetch(
      `/api/targets/${targetId}/directories/?page=${params.page}&pageSize=${params.pageSize}${searchParam}`
    )
    if (!response.ok) {
      throw new Error('获取目录列表失败')
    }
    return response.json()
  },

  // 获取扫描的目录列表
  getScanDirectories: async (
    scanId: number,
    params: { page: number; pageSize: number; search?: string }
  ): Promise<DirectoryListResponse> => {
    const searchParam = params.search ? `&search=${encodeURIComponent(params.search)}` : ''
    const response = await fetch(
      `/api/scans/${scanId}/directories/?page=${params.page}&pageSize=${params.pageSize}${searchParam}`
    )
    if (!response.ok) {
      throw new Error('获取目录列表失败')
    }
    return response.json()
  },

  // 批量删除目录（支持单个或多个）
  bulkDeleteDirectories: async (ids: number[]): Promise<{
    message: string
    deletedCount: number
    requestedIds: number[]
    cascadeDeleted: Record<string, number>
  }> => {
    const response = await fetch('/api/directories/bulk-delete/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    })
    if (!response.ok) {
      throw new Error('批量删除目录失败')
    }
    return response.json()
  },

  // 删除单个目录（使用单独的 DELETE API）
  deleteDirectory: async (directoryId: number): Promise<{
    message: string
    directoryId: number
    directoryUrl: string
    deletedCount: number
    deletedDirectories: string[]
    detail: {
      phase1: string
      phase2: string
    }
  }> => {
    const response = await fetch(`/api/directories/${directoryId}/`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除目录失败')
    }
    return response.json()
  },
}

// 获取目标的目录列表
export function useTargetDirectories(
  targetId: number,
  params: { page: number; pageSize: number; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['target-directories', targetId, params],
    queryFn: () => directoryService.getTargetDirectories(targetId, params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  })
}

// 获取扫描的目录列表
export function useScanDirectories(
  scanId: number,
  params: { page: number; pageSize: number; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['scan-directories', scanId, params],
    queryFn: () => directoryService.getScanDirectories(scanId, params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  })
}

// 删除单个目录（使用单独的 DELETE API）
export function useDeleteDirectory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: directoryService.deleteDirectory,
    onMutate: (id) => {
      toast.loading('正在删除目录...', { id: `delete-directory-${id}` })
    },
    onSuccess: (response, id) => {
      toast.dismiss(`delete-directory-${id}`)
      
      // 显示删除信息（单个删除 API 返回两阶段信息）
      const { directoryUrl, detail } = response
      toast.success(`目录 "${directoryUrl}" 已成功删除`, {
        description: `${detail.phase1}；${detail.phase2}`,
        duration: 4000
      })
      
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['target-directories'] })
      queryClient.invalidateQueries({ queryKey: ['scan-directories'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
    onError: (error: Error, id) => {
      toast.dismiss(`delete-directory-${id}`)
      toast.error(error.message || '删除目录失败')
    },
  })
}

// 批量删除目录（使用统一的批量删除接口）
export function useBulkDeleteDirectories() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: directoryService.bulkDeleteDirectories,
    onMutate: () => {
      toast.loading('正在批量删除目录...', { id: 'bulk-delete-directories' })
    },
    onSuccess: (response) => {
      toast.dismiss('bulk-delete-directories')
      toast.success(`成功删除 ${response.deletedCount} 个目录`)
      
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['target-directories'] })
      queryClient.invalidateQueries({ queryKey: ['scan-directories'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
    onError: (error: Error) => {
      toast.dismiss('bulk-delete-directories')
      toast.error(error.message || '批量删除目录失败')
    },
  })
}
