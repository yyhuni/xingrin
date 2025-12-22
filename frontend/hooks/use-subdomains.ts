"use client"

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { SubdomainService } from "@/services/subdomain.service"
import { OrganizationService } from "@/services/organization.service"
import type { Subdomain, GetSubdomainsResponse, GetAllSubdomainsParams } from "@/types/subdomain.types"
import type { PaginationParams } from "@/types/common.types"

// Query Keys
export const subdomainKeys = {
  all: ['subdomains'] as const,
  lists: () => [...subdomainKeys.all, 'list'] as const,
  list: (params: PaginationParams & { organizationId?: string }) => 
    [...subdomainKeys.lists(), params] as const,
  details: () => [...subdomainKeys.all, 'detail'] as const,
  detail: (id: number) => [...subdomainKeys.details(), id] as const,
}

// 获取单个子域名详情
export function useSubdomain(id: number) {
  return useQuery({
    queryKey: subdomainKeys.detail(id),
    queryFn: () => SubdomainService.getSubdomainById(id),
    enabled: !!id,
  })
}

// 获取组织的子域名列表
export function useOrganizationSubdomains(
  organizationId: number,
  params?: { page?: number; pageSize?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['organizations', 'detail', organizationId, 'subdomains', {
      page: params?.page,
      pageSize: params?.pageSize,
    }],
    queryFn: () => SubdomainService.getSubdomainsByOrgId(organizationId, {
      page: params?.page || 1,
      pageSize: params?.pageSize || 10,
    }),
    enabled: options?.enabled !== undefined ? options.enabled : true,
    select: (response) => ({
      domains: response.domains || [],
      pagination: {
        total: response.total || 0,
        page: response.page || 1,
        pageSize: response.pageSize || 10,
        totalPages: response.totalPages || 0,
      }
    }),
  })
}

// 创建子域名（绑定到资产）
export function useCreateSubdomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { domains: Array<{ name: string }>; assetId: number }) =>
      SubdomainService.createSubdomains(data),
    onMutate: async () => {
      toast.loading('正在创建子域名...', { id: 'create-subdomain' })
    },
    onSuccess: (response) => {
      toast.dismiss('create-subdomain')
      const { createdCount, existedCount, skippedCount = 0 } = response
      if (skippedCount > 0 && existedCount > 0) {
        toast.warning(`成功创建 ${createdCount} 个子域名（${existedCount} 个已存在，${skippedCount} 个已跳过）`)
      } else if (skippedCount > 0) {
        toast.warning(`成功创建 ${createdCount} 个子域名（${skippedCount} 个已跳过）`)
      } else if (existedCount > 0) {
        toast.warning(`成功创建 ${createdCount} 个子域名（${existedCount} 个已存在）`)
      } else {
        toast.success(`成功创建 ${createdCount} 个子域名`)
      }
      queryClient.invalidateQueries({ queryKey: ['subdomains'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (error: any) => {
      toast.dismiss('create-subdomain')
      console.error('创建子域名失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      toast.error('创建子域名失败，请查看控制台日志')
    },
  })
}

// 从组织中移除子域名
export function useDeleteSubdomainFromOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { organizationId: number; targetId: number }) =>
      OrganizationService.unlinkTargetsFromOrganization({
        organizationId: data.organizationId,
        targetIds: [data.targetId],
      }),
    onMutate: ({ organizationId, targetId }) => {
      toast.loading('正在移除子域名...', { id: `delete-${organizationId}-${targetId}` })
    },
    onSuccess: (_response, { organizationId }) => {
      toast.dismiss(`delete-${organizationId}`)
      toast.success('子域名已成功移除')
      queryClient.invalidateQueries({ queryKey: ['subdomains'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: any, { organizationId, targetId }) => {
      toast.dismiss(`delete-${organizationId}-${targetId}`)
      console.error('移除子域名失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      toast.error('移除子域名失败，请查看控制台日志')
    },
  })
}

// 批量从组织中移除子域名
export function useBatchDeleteSubdomainsFromOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { organizationId: number; domainIds: number[] }) => 
      SubdomainService.batchDeleteSubdomainsFromOrganization(data),
    onMutate: ({ organizationId }) => {
      toast.loading('正在批量移除子域名...', { id: `batch-delete-${organizationId}` })
    },
    onSuccess: (response, { organizationId }) => {
      toast.dismiss(`batch-delete-${organizationId}`)
      const successCount = response.successCount || 0
      const failedCount = response.failedCount || 0
      if (failedCount > 0) {
        toast.warning(`批量移除完成（成功：${successCount}，失败：${failedCount}）`)
      } else {
        toast.success(`成功移除 ${successCount} 个子域名`)
      }
      queryClient.invalidateQueries({ queryKey: ['subdomains'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: any, { organizationId }) => {
      toast.dismiss(`batch-delete-${organizationId}`)
      console.error('批量移除子域名失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      toast.error('批量移除失败，请查看控制台日志')
    },
  })
}

// 删除单个子域名（使用单独的 DELETE API）
export function useDeleteSubdomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => SubdomainService.deleteSubdomain(id),
    onMutate: (id) => {
      toast.loading('正在删除子域名...', { id: `delete-subdomain-${id}` })
    },
    onSuccess: (response, id) => {
      toast.dismiss(`delete-subdomain-${id}`)
      
      // 显示删除成功信息
      const { subdomainName } = response
      toast.success(`子域名 "${subdomainName}" 已成功删除`)
      
      queryClient.invalidateQueries({ queryKey: ['subdomains'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: any, id) => {
      toast.dismiss(`delete-subdomain-${id}`)
      console.error('删除子域名失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      toast.error('删除子域名失败，请查看控制台日志')
    },
  })
}

// 批量删除子域名（使用统一的批量删除接口）
export function useBatchDeleteSubdomains() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: number[]) => SubdomainService.batchDeleteSubdomains(ids),
    onMutate: () => {
      toast.loading('正在批量删除子域名...', { id: 'batch-delete-subdomains' })
    },
    onSuccess: (response) => {
      toast.dismiss('batch-delete-subdomains')
      
      // 显示级联删除信息
      const cascadeInfo = Object.entries(response.cascadeDeleted || {})
        .filter(([key, count]) => key !== 'asset.Subdomain' && count > 0)
        .map(([key, count]) => {
          const modelName = key.split('.')[1]
          return `${modelName}: ${count}`
        })
        .join(', ')
      
      if (cascadeInfo) {
        toast.success(`成功删除 ${response.deletedCount} 个子域名（级联删除: ${cascadeInfo}）`)
      } else {
        toast.success(`成功删除 ${response.deletedCount} 个子域名`)
      }
      
      queryClient.invalidateQueries({ queryKey: ['subdomains'] })
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['scans'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: any) => {
      toast.dismiss('batch-delete-subdomains')
      console.error('批量删除子域名失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      toast.error('批量删除失败，请查看控制台日志')
    },
  })
}

// 更新子域名
export function useUpdateSubdomain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string } }) =>
      SubdomainService.updateSubdomain({ id, ...data }),
    onMutate: ({ id }) => {
      toast.loading('正在更新子域名...', { id: `update-subdomain-${id}` })
    },
    onSuccess: (_response, { id }) => {
      toast.dismiss(`update-subdomain-${id}`)
      toast.success('更新成功')
      queryClient.invalidateQueries({ queryKey: ['subdomains'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: any, { id }) => {
      toast.dismiss(`update-subdomain-${id}`)
      console.error('更新子域名失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      toast.error('更新子域名失败，请查看控制台日志')
    },
  })
}

// 获取所有子域名列表
export function useAllSubdomains(
  params: GetAllSubdomainsParams = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['subdomains', 'all', { page: params.page, pageSize: params.pageSize }],
    queryFn: () => SubdomainService.getAllSubdomains(params),
    select: (response) => ({
      domains: response.domains || [],
      pagination: {
        total: response.total || 0,
        page: response.page || 1,
        pageSize: response.pageSize || 10,
        totalPages: response.totalPages || 0,
      }
    }),
    enabled: options?.enabled !== undefined ? options.enabled : true,
  })
}

// 获取目标的子域名列表
export function useTargetSubdomains(
  targetId: number,
  params?: { page?: number; pageSize?: number; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['targets', targetId, 'subdomains', { page: params?.page, pageSize: params?.pageSize, search: params?.search }],
    queryFn: () => SubdomainService.getSubdomainsByTargetId(targetId, params),
    enabled: options?.enabled !== undefined ? options.enabled : !!targetId,
    placeholderData: keepPreviousData,
  })
}

// 获取扫描的子域名列表
export function useScanSubdomains(
  scanId: number,
  params?: { page?: number; pageSize?: number; search?: string },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['scans', scanId, 'subdomains', { page: params?.page, pageSize: params?.pageSize, search: params?.search }],
    queryFn: () => SubdomainService.getSubdomainsByScanId(scanId, params),
    enabled: options?.enabled !== undefined ? options.enabled : !!scanId,
    placeholderData: keepPreviousData,
  })
}
