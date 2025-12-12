/**
 * Targets Hooks - 目标管理相关 hooks
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getTargets,
  getTargetById,
  createTarget,
  updateTarget,
  deleteTarget,
  batchDeleteTargets,
  batchCreateTargets,
  getTargetOrganizations,
  linkTargetOrganizations,
  unlinkTargetOrganizations,
  getTargetEndpoints,
} from '@/services/target.service'
import type {
  CreateTargetRequest,
  UpdateTargetRequest,
  BatchDeleteTargetsRequest,
  BatchCreateTargetsRequest,
} from '@/types/target.types'

/**
 * 获取所有目标列表
 * 支持两种调用方式：
 * 1. useTargets(page, pageSize, organizationId) - 直接传参数
 * 2. useTargets({ page, pageSize, organizationId }) - 传对象（已废弃，为了兼容性保留）
 */
export function useTargets(
  pageOrParams: number | { page?: number; pageSize?: number; organizationId?: number; search?: string } = 1,
  pageSize = 10,
  organizationId?: number,
  search?: string
) {
  // 处理参数：支持对象参数或独立参数
  let actualPage: number
  let actualPageSize: number
  let actualOrgId: number | undefined
  let actualSearch: string | undefined

  if (typeof pageOrParams === 'object') {
    // 对象参数方式（兼容旧代码）
    actualPage = pageOrParams.page || 1
    actualPageSize = pageOrParams.pageSize || 10
    actualOrgId = pageOrParams.organizationId
    actualSearch = pageOrParams.search
  } else {
    // 独立参数方式
    actualPage = pageOrParams
    actualPageSize = pageSize
    actualOrgId = organizationId
    actualSearch = search
  }

  return useQuery({
    queryKey: ['targets', { page: actualPage, pageSize: actualPageSize, organizationId: actualOrgId, search: actualSearch }],
    queryFn: () => getTargets(actualPage, actualPageSize, actualSearch),
    select: (response) => {
      // 如果指定了 organizationId，过滤结果
      if (actualOrgId) {
        const filteredResults = response.results.filter(target => 
          target.organizations?.some(org => org.id === actualOrgId)
        )
        return {
          ...response,
          results: filteredResults,
          total: filteredResults.length,
          // 为兼容性添加额外字段
          count: filteredResults.length,  // 兼容字段
          targets: filteredResults,
          page: actualPage,
          pageSize: actualPageSize,
          totalPages: Math.ceil(filteredResults.length / actualPageSize),
        }
      }
      
      // 否则直接返回原始响应，并添加兼容字段
      return {
        ...response,
        targets: response.results,
        // 后端返回 total，不是 count
        count: response.total,  // 兼容字段，使用 total 值
        // 保持原有字段
        total: response.total,
        page: response.page,
        pageSize: response.pageSize,
        totalPages: response.totalPages,
      }
    },
    placeholderData: keepPreviousData,
  })
}

/**
 * 获取单个目标详情
 */
export function useTarget(id: number) {
  return useQuery({
    queryKey: ['targets', id],
    queryFn: () => getTargetById(id),
    enabled: !!id,
  })
}

/**
 * 创建目标
 */
export function useCreateTarget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateTargetRequest) => createTarget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      toast.success('目标创建成功')
    },
    onError: (error: Error) => {
      toast.error(`创建失败: ${error.message}`)
    },
  })
}

/**
 * 更新目标
 */
export function useUpdateTarget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTargetRequest }) =>
      updateTarget(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['targets', variables.id] })
      toast.success('目标更新成功')
    },
    onError: (error: Error) => {
      toast.error(`更新失败: ${error.message}`)
    },
  })
}

/**
 * 删除目标（使用单独的 DELETE API）
 */
export function useDeleteTarget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteTarget(id),
    onMutate: (id) => {
      toast.loading('正在删除目标...', { id: `delete-target-${id}` })
    },
    onSuccess: (response, id) => {
      toast.dismiss(`delete-target-${id}`)
      
      // 显示删除信息（单个删除 API 返回两阶段信息）
      const { targetName, detail } = response
      toast.success(`目标 "${targetName}" 已成功删除`, {
        description: `${detail.phase1}；${detail.phase2}`,
        duration: 4000
      })
      
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: Error, id) => {
      toast.dismiss(`delete-target-${id}`)
      toast.error(`删除失败: ${error.message}`)
    },
  })
}

/**
 * 批量删除目标
 */
export function useBatchDeleteTargets() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BatchDeleteTargetsRequest) => batchDeleteTargets(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      toast.success(`成功删除 ${response.deletedCount} 个目标`)
    },
    onError: (error: Error) => {
      toast.error(`批量删除失败: ${error.message}`)
    },
  })
}

/**
 * 批量创建目标
 */
export function useBatchCreateTargets() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BatchCreateTargetsRequest) => batchCreateTargets(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success(response.message)
    },
    onError: (error: Error) => {
      toast.error(`批量创建失败: ${error.message}`)
    },
  })
}

/**
 * 获取目标的组织列表
 */
export function useTargetOrganizations(targetId: number, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: ['targets', targetId, 'organizations', page, pageSize],
    queryFn: () => getTargetOrganizations(targetId, page, pageSize),
    enabled: !!targetId,
  })
}

/**
 * 关联目标与组织
 */
export function useLinkTargetOrganizations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ targetId, organizationIds }: { targetId: number; organizationIds: number[] }) =>
      linkTargetOrganizations(targetId, organizationIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['targets', variables.targetId, 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['targets', variables.targetId] })
      toast.success('组织关联成功')
    },
    onError: (error: Error) => {
      toast.error(`关联失败: ${error.message}`)
    },
  })
}

/**
 * 取消目标与组织的关联
 */
export function useUnlinkTargetOrganizations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ targetId, organizationIds }: { targetId: number; organizationIds: number[] }) =>
      unlinkTargetOrganizations(targetId, organizationIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['targets', variables.targetId, 'organizations'] })
      queryClient.invalidateQueries({ queryKey: ['targets', variables.targetId] })
      toast.success('取消关联成功')
    },
    onError: (error: Error) => {
      toast.error(`取消关联失败: ${error.message}`)
    },
  })
}

/**
 * 获取目标的端点列表
 */
export function useTargetEndpoints(
  targetId: number,
  params?: {
    page?: number
    pageSize?: number
    search?: string
  },
  options?: {
    enabled?: boolean
  }
) {
  return useQuery({
    queryKey: ['targets', 'detail', targetId, 'endpoints', {
      page: params?.page,
      pageSize: params?.pageSize,
      search: params?.search,
    }],
    queryFn: () => getTargetEndpoints(targetId, params?.page || 1, params?.pageSize || 10, params?.search),
    enabled: options?.enabled !== undefined ? options.enabled : !!targetId,
    select: (response: any) => {
      // RESTful 标准：直接返回数据
      return {
        endpoints: response.endpoints || [],
        pagination: {
          total: response.total || 0,
          page: response.page || 1,
          pageSize: response.pageSize || 10,
          totalPages: response.totalPages || 0,
        }
      }
    },
  })
}

