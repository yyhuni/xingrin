import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { WebSite, WebSiteListResponse } from '@/types/website.types'

// API 服务函数
const websiteService = {
  // 获取目标的网站列表
  getTargetWebSites: async (
    targetId: number,
    params: { page: number; pageSize: number; search?: string }
  ): Promise<WebSiteListResponse> => {
    const searchParam = params.search ? `&search=${encodeURIComponent(params.search)}` : ''
    const response = await fetch(
      `/api/targets/${targetId}/websites/?page=${params.page}&pageSize=${params.pageSize}${searchParam}`
    )
    if (!response.ok) {
      throw new Error('获取网站列表失败')
    }
    return response.json()
  },

  // 获取扫描的网站列表
  getScanWebSites: async (
    scanId: number,
    params: { page: number; pageSize: number; search?: string }
  ): Promise<WebSiteListResponse> => {
    const searchParam = params.search ? `&search=${encodeURIComponent(params.search)}` : ''
    const response = await fetch(
      `/api/scans/${scanId}/websites/?page=${params.page}&pageSize=${params.pageSize}${searchParam}`
    )
    if (!response.ok) {
      throw new Error('获取网站列表失败')
    }
    return response.json()
  },

  // 批量删除网站（支持单个或多个）
  bulkDeleteWebSites: async (ids: number[]): Promise<{
    message: string
    deletedCount: number
    requestedIds: number[]
    cascadeDeleted: Record<string, number>
  }> => {
    const response = await fetch('/api/websites/bulk-delete/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    })
    if (!response.ok) {
      throw new Error('批量删除网站失败')
    }
    return response.json()
  },

  // 删除单个网站（使用单独的 DELETE API）
  deleteWebSite: async (websiteId: number): Promise<{
    message: string
    websiteId: number
    websiteUrl: string
    deletedCount: number
    deletedWebSites: string[]
    detail: {
      phase1: string
      phase2: string
    }
  }> => {
    const response = await fetch(`/api/websites/${websiteId}/`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('删除网站失败')
    }
    return response.json()
  },
}

// 获取目标的网站列表
export function useTargetWebSites(
  targetId: number,
  params: { page: number; pageSize: number; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['target-websites', targetId, params],
    queryFn: () => websiteService.getTargetWebSites(targetId, params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  })
}

// 获取扫描的网站列表
export function useScanWebSites(
  scanId: number,
  params: { page: number; pageSize: number; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['scan-websites', scanId, params],
    queryFn: () => websiteService.getScanWebSites(scanId, params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  })
}

// 删除单个网站（使用单独的 DELETE API）
export function useDeleteWebSite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: websiteService.deleteWebSite,
    onMutate: (id) => {
      toast.loading('正在删除网站...', { id: `delete-website-${id}` })
    },
    onSuccess: (response, id) => {
      toast.dismiss(`delete-website-${id}`)
      
      // 显示删除信息（单个删除 API 返回两阶段信息）
      const { websiteUrl, detail } = response
      toast.success(`网站 "${websiteUrl}" 已成功删除`, {
        description: `${detail.phase1}；${detail.phase2}`,
        duration: 4000
      })
      
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['target-websites'] })
      queryClient.invalidateQueries({ queryKey: ['scan-websites'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
    onError: (error: Error, id) => {
      toast.dismiss(`delete-website-${id}`)
      toast.error(error.message || '删除网站失败')
    },
  })
}

// 批量删除网站（使用统一的批量删除接口）
export function useBulkDeleteWebSites() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: websiteService.bulkDeleteWebSites,
    onMutate: () => {
      toast.loading('正在批量删除网站...', { id: 'bulk-delete-websites' })
    },
    onSuccess: (response) => {
      toast.dismiss('bulk-delete-websites')
      
      // 显示级联删除信息
      const cascadeInfo = Object.entries(response.cascadeDeleted || {})
        .filter(([key, count]) => key !== 'asset.WebSite' && count > 0)
        .map(([key, count]) => {
          const modelName = key.split('.')[1]
          return `${modelName}: ${count}`
        })
        .join(', ')
      
      if (cascadeInfo) {
        toast.success(`成功删除 ${response.deletedCount} 个网站（级联删除: ${cascadeInfo}）`)
      } else {
        toast.success(`成功删除 ${response.deletedCount} 个网站`)
      }
      
      // 刷新相关查询
      queryClient.invalidateQueries({ queryKey: ['target-websites'] })
      queryClient.invalidateQueries({ queryKey: ['scan-websites'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['scans'] })
    },
    onError: (error: Error) => {
      toast.dismiss('bulk-delete-websites')
      toast.error(error.message || '批量删除网站失败')
    },
  })
}
