import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { OrganizationService } from '@/services/organization.service'
import type { Organization, CreateOrganizationRequest, UpdateOrganizationRequest } from '@/types/organization.types'

// Query Keys - 统一管理查询键
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: (params?: any) => [...organizationKeys.lists(), params] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (id: number) => [...organizationKeys.details(), id] as const,
}

/**
 * 获取组织列表的 Hook
 * 
 * 功能：
 * - 自动管理加载状态
 * - 自动错误处理
 * - 支持分页
 * - 自动缓存和重新验证
 * - 支持条件查询（enabled 选项）
 */
// 后端固定按更新时间降序排列，不支持自定义排序
export function useOrganizations(
  params: {
    page?: number
    pageSize?: number
    search?: string
  } = {},
  options?: {
    enabled?: boolean
  }
) {
  return useQuery({
    queryKey: ['organizations', {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      search: params.search || undefined,
    }],
    queryFn: () => OrganizationService.getOrganizations(params || {}),
    select: (response) => {
      // 处理 DRF 分页响应格式
      const page = params.page || 1
      const pageSize = params.pageSize || 10
      const total = response.total || response.count || 0
      const totalPages = Math.ceil(total / pageSize)
      
      return {
        organizations: response.results || [],
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
        }
      }
    },
    enabled: options?.enabled !== undefined ? options.enabled : true,
    placeholderData: keepPreviousData,
  })
}

/**
 * 获取单个组织详情的 Hook
 */
export function useOrganization(id: number) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => OrganizationService.getOrganizationById(id),
    enabled: !!id, // 只有当 id 存在时才执行查询
  })
}

/**
 * 获取组织的目标列表 Hook
 */
export function useOrganizationTargets(
  id: number,
  params?: {
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    search?: string
  },
  options?: {
    enabled?: boolean
  }
) {
  return useQuery({
    queryKey: [...organizationKeys.detail(id), 'targets', params],
    queryFn: () => OrganizationService.getOrganizationTargets(id, params),
    enabled: options?.enabled !== undefined ? (options.enabled && !!id) : !!id,
    placeholderData: keepPreviousData,
  })
}

/**
 * 创建组织的 Mutation Hook
 * 
 * 功能：
 * - 自动管理提交状态
 * - 成功后自动刷新列表
 * - 自动显示成功/失败提示
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateOrganizationRequest) => 
      OrganizationService.createOrganization(data),
    onMutate: () => {
      // 显示创建开始的提示
      toast.loading('正在创建组织...', { id: 'create-organization' })
    },
    onSuccess: () => {
      // 关闭加载提示
      toast.dismiss('create-organization')
      
      // 刷新所有组织相关查询（通配符匹配）
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      
      // 显示成功提示
      toast.success('创建成功')
    },
    onError: (error: any) => {
      // 关闭加载提示
      toast.dismiss('create-organization')
      
      console.error('创建组织失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('创建组织失败，请查看控制台日志')
    },
  })
}

/**
 * 更新组织的 Mutation Hook
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateOrganizationRequest }) =>
      OrganizationService.updateOrganization({ id, ...data }),
    onMutate: ({ id, data }) => {
      // 显示更新开始的提示
      toast.loading('正在更新组织...', { id: `update-${id}` })
    },
    onSuccess: ({ id }) => {
      // 关闭加载提示
      toast.dismiss(`update-${id}`)
      
      // 刷新所有组织相关查询（通配符匹配）
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      
      // 显示成功提示
      toast.success('更新成功')
    },
    onError: (error: any, { id }) => {
      // 关闭加载提示
      toast.dismiss(`update-${id}`)
      
      console.error('更新组织失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('更新组织失败，请查看控制台日志')
    },
  })
}

/**
 * 删除组织的 Mutation Hook（乐观更新）
 */
export function useDeleteOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => OrganizationService.deleteOrganization(id),
    onMutate: async (deletedId) => {
      // 显示删除开始的提示
      toast.loading('正在删除组织...', { id: `delete-${deletedId}` })
      
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['organizations'] })

      // 获取当前数据作为备份
      const previousData = queryClient.getQueriesData({ queryKey: ['organizations'] })

      // 乐观更新：从所有列表查询中移除该组织
      queryClient.setQueriesData(
        { queryKey: ['organizations'] },
        (old: any) => {
          if (old?.organizations) {
            return {
              ...old,
              organizations: old.organizations.filter((org: Organization) => org.id !== deletedId)
            }
          }
          return old
        }
      )

      // 返回备份数据用于回滚
      return { previousData, deletedId }
    },
    onSuccess: (response, deletedId, context) => {
      // 关闭加载提示
      toast.dismiss(`delete-${deletedId}`)
      
      // 显示删除成功信息
      const { organizationName } = response
      toast.success(`组织 "${organizationName}" 已成功删除`)
    },
    onError: (error: any, deletedId, context) => {
      // 关闭加载提示
      toast.dismiss(`delete-${deletedId}`)
      
      // 回滚乐观更新
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      
      console.error('删除组织失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('删除组织失败，请查看控制台日志')
    },
    onSettled: () => {
      // 无论成功失败都刷新数据
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      // 刷新目标查询，因为删除组织会解除目标的关联关系，需要更新目标的 organizations 字段
      queryClient.invalidateQueries({ queryKey: ['targets'] })
    },
  })
}

/**
 * 批量删除组织的 Mutation Hook（乐观更新）
 */
export function useBatchDeleteOrganizations() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: number[]) => 
      OrganizationService.batchDeleteOrganizations(ids),
    onMutate: async (deletedIds) => {
      // 显示批量删除开始的提示
      toast.loading('正在批量删除组织...', { id: 'batch-delete' })
      
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: ['organizations'] })

      // 获取当前数据作为备份
      const previousData = queryClient.getQueriesData({ queryKey: ['organizations'] })

      // 乐观更新：从所有列表查询中移除这些组织
      queryClient.setQueriesData(
        { queryKey: ['organizations'] },
        (old: any) => {
          if (old?.organizations) {
            return {
              ...old,
              organizations: old.organizations.filter(
                (org: Organization) => !deletedIds.includes(org.id)
              )
            }
          }
          return old
        }
      )

      // 返回备份数据用于回滚
      return { previousData, deletedIds }
    },
    onSuccess: (response, deletedIds) => {
      // 关闭加载提示
      toast.dismiss('batch-delete')
      
      // 打印后端响应
      console.log('批量删除组织成功')
      console.log('后端响应:', response)
      
      // 显示删除成功信息
      const { deletedOrganizationCount } = response
      toast.success(`成功删除 ${deletedOrganizationCount} 个组织`)
    },
    onError: (error: any, deletedIds, context) => {
      // 关闭加载提示
      toast.dismiss('batch-delete')
      
      // 回滚乐观更新
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
      
      console.error('批量删除组织失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('批量删除失败，请查看控制台日志')
    },
    onSettled: () => {
      // 无论成功失败都刷新数据
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      // 刷新目标查询，因为删除组织会解除目标的关联关系，需要更新目标的 organizations 字段
      queryClient.invalidateQueries({ queryKey: ['targets'] })
    },
  })
}



/**
 * 解除组织与目标关联的 Mutation Hook（批量）
 */
export function useUnlinkTargetsFromOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { organizationId: number; targetIds: number[] }) => 
      OrganizationService.unlinkTargetsFromOrganization(data),
    onMutate: ({ organizationId, targetIds }) => {
      toast.loading('正在解除关联...', { id: `unlink-${organizationId}` })
    },
    onSuccess: (response, { organizationId }) => {
      toast.dismiss(`unlink-${organizationId}`)
      toast.success(response.message || '已成功解除关联')
      
      // 刷新所有目标和组织相关查询
      queryClient.invalidateQueries({ queryKey: ['targets'] })
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
    onError: (error: any, { organizationId }) => {
      toast.dismiss(`unlink-${organizationId}`)
      
      console.error('解除关联失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      const errorMessage = error?.response?.data?.error || '解除关联失败'
      toast.error(errorMessage)
    },
  })
}
