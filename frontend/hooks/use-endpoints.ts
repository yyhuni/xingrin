"use client"

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { toast } from "sonner"
import { EndpointService } from "@/services/endpoint.service"
import type { 
  Endpoint, 
  CreateEndpointRequest,
  UpdateEndpointRequest,
  GetEndpointsRequest,
  GetEndpointsResponse,
  BatchDeleteEndpointsRequest,
  BatchDeleteEndpointsResponse
} from "@/types/endpoint.types"

// Query Keys
export const endpointKeys = {
  all: ['endpoints'] as const,
  lists: () => [...endpointKeys.all, 'list'] as const,
  list: (params: GetEndpointsRequest) => 
    [...endpointKeys.lists(), params] as const,
  details: () => [...endpointKeys.all, 'detail'] as const,
  detail: (id: number) => [...endpointKeys.details(), id] as const,
  byTarget: (targetId: number, params: GetEndpointsRequest) => 
    [...endpointKeys.all, 'target', targetId, params] as const,
  bySubdomain: (subdomainId: number, params: GetEndpointsRequest) => 
    [...endpointKeys.all, 'subdomain', subdomainId, params] as const,
  byScan: (scanId: number, params: GetEndpointsRequest) =>
    [...endpointKeys.all, 'scan', scanId, params] as const,
}

// 获取单个 Endpoint 详情
export function useEndpoint(id: number) {
  return useQuery({
    queryKey: endpointKeys.detail(id),
    queryFn: () => EndpointService.getEndpointById(id),
    select: (response) => {
      // RESTful 标准：直接返回数据
      return response as Endpoint
    },
    enabled: !!id,
  })
}

// 获取 Endpoint 列表
export function useEndpoints(params?: GetEndpointsRequest) {
  const defaultParams: GetEndpointsRequest = {
    page: 1,
    pageSize: 10,
    ...params
  }
  
  return useQuery({
    queryKey: endpointKeys.list(defaultParams),
    queryFn: () => EndpointService.getEndpoints(defaultParams),
    select: (response) => {
      // RESTful 标准：直接返回数据
      return response as GetEndpointsResponse
    },
  })
}

// 根据目标ID获取 Endpoint 列表（使用专用路由）
export function useEndpointsByTarget(targetId: number, params?: Omit<GetEndpointsRequest, 'targetId'>) {
  const defaultParams: GetEndpointsRequest = {
    page: 1,
    pageSize: 10,
    ...params
  }
  
  return useQuery({
    queryKey: endpointKeys.byTarget(targetId, defaultParams),
    queryFn: () => EndpointService.getEndpointsByTargetId(targetId, defaultParams),
    select: (response) => {
      // RESTful 标准：直接返回数据
      return response as GetEndpointsResponse
    },
    enabled: !!targetId,
    placeholderData: keepPreviousData,
  })
}

// 根据扫描ID获取 Endpoint 列表（历史快照）
export function useScanEndpoints(scanId: number, params?: Omit<GetEndpointsRequest, 'targetId'>, options?: { enabled?: boolean }) {
  const defaultParams: GetEndpointsRequest = {
    page: 1,
    pageSize: 10,
    ...params,
  }

  return useQuery({
    queryKey: endpointKeys.byScan(scanId, defaultParams),
    queryFn: () => EndpointService.getEndpointsByScanId(scanId, defaultParams),
    enabled: options?.enabled !== undefined ? options.enabled : !!scanId,
    select: (response: any) => {
      // 后端使用通用分页格式：results/total/page/pageSize/totalPages
      return {
        endpoints: response.results || [],
        pagination: {
          total: response.total || 0,
          page: response.page || 1,
          pageSize: response.pageSize || response.page_size || defaultParams.pageSize || 10,
          totalPages: response.totalPages || response.total_pages || 0,
        },
      }
    },
    placeholderData: keepPreviousData,
  })
}

// 创建 Endpoint（完全自动化）
export function useCreateEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      endpoints: Array<CreateEndpointRequest>
    }) => EndpointService.createEndpoints(data),
    onMutate: async () => {
      toast.loading('正在创建端点...', { id: 'create-endpoint' })
    },
    onSuccess: (response) => {
      // 关闭加载提示
      toast.dismiss('create-endpoint')
      
      const { createdCount, existedCount } = response
      
      // 打印后端响应
      console.log('创建端点成功')
      console.log('后端响应:', response)
      
      // 前端自己构造成功提示消息
      if (existedCount > 0) {
        toast.warning(
          `成功创建 ${createdCount} 个端点（${existedCount} 个已存在）`
        )
      } else {
        toast.success(`成功创建 ${createdCount} 个端点`)
      }
      
      // 刷新所有端点相关查询（通配符匹配）
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
    },
    onError: (error: any) => {
      // 关闭加载提示
      toast.dismiss('create-endpoint')
      
      console.error('创建端点失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('创建端点失败，请查看控制台日志')
    },
  })
}

// 删除单个 Endpoint
export function useDeleteEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => EndpointService.deleteEndpoint(id),
    onMutate: (id) => {
      toast.loading('正在删除端点...', { id: `delete-endpoint-${id}` })
    },
    onSuccess: (response, id) => {
      toast.dismiss(`delete-endpoint-${id}`)
      
      // 打印后端响应
      console.log('删除端点成功')
      
      toast.success('删除成功')
      
      // 刷新所有端点相关查询（通配符匹配）
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
    },
    onError: (error: any, id) => {
      toast.dismiss(`delete-endpoint-${id}`)
      
      console.error('删除端点失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('删除端点失败，请查看控制台日志')
    },
  })
}

// 批量删除 Endpoint
export function useBatchDeleteEndpoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BatchDeleteEndpointsRequest) => EndpointService.batchDeleteEndpoints(data),
    onMutate: () => {
      toast.loading('正在批量删除端点...', { id: 'batch-delete-endpoints' })
    },
    onSuccess: (response) => {
      toast.dismiss('batch-delete-endpoints')
      
      // 打印后端响应
      console.log('批量删除端点成功')
      console.log('后端响应:', response)
      
      const { deletedCount } = response
      toast.success(`成功删除 ${deletedCount} 个端点`)
      
      // 刷新所有端点相关查询（通配符匹配）
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
    },
    onError: (error: any) => {
      toast.dismiss('batch-delete-endpoints')
      
      console.error('批量删除端点失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('批量删除失败，请查看控制台日志')
    },
  })
}
