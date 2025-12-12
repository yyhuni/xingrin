"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ToolService } from "@/services/tool.service"
import type { Tool, GetToolsParams, CreateToolRequest, UpdateToolRequest } from "@/types/tool.types"

// Query Keys
export const toolKeys = {
  all: ['tools'] as const,
  lists: () => [...toolKeys.all, 'list'] as const,
  list: (params: GetToolsParams) => [...toolKeys.lists(), params] as const,
}

// 获取工具列表
export function useTools(params: GetToolsParams = {}) {
  return useQuery({
    queryKey: toolKeys.list(params),
    queryFn: () => ToolService.getTools(params),
    select: (response) => {
      // RESTful 标准：直接返回数据
      return {
        tools: response.tools || [],
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

// 创建工具
export function useCreateTool() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateToolRequest) => ToolService.createTool(data),
    onMutate: async () => {
      toast.loading('正在创建工具...', { id: 'create-tool' })
    },
    onSuccess: (response) => {
      toast.dismiss('create-tool')
      
      // 打印后端响应
      console.log('创建工具成功')
      console.log('后端响应:', response)
      
      toast.success('创建成功')
      
      // 刷新工具列表和分类列表
      queryClient.invalidateQueries({ 
        queryKey: toolKeys.all,
        refetchType: 'active' 
      })
    },
    onError: (error: any) => {
      toast.dismiss('create-tool')
      
      console.error('创建工具失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      // 前端自己构造错误提示
      toast.error('创建工具失败，请查看控制台日志')
    },
  })
}

// 更新工具
export function useUpdateTool() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateToolRequest }) => 
      ToolService.updateTool(id, data),
    onMutate: async () => {
      toast.loading('正在更新工具...', { id: 'update-tool' })
    },
    onSuccess: (response) => {
      toast.dismiss('update-tool')
      
      console.log('更新工具成功')
      console.log('后端响应:', response)
      
      toast.success('更新成功')
      
      // 刷新工具列表
      queryClient.invalidateQueries({ 
        queryKey: toolKeys.all,
        refetchType: 'active' 
      })
    },
    onError: (error: any) => {
      toast.dismiss('update-tool')
      
      console.error('更新工具失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      toast.error('更新工具失败，请查看控制台日志')
    },
  })
}

// 删除工具
export function useDeleteTool() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => ToolService.deleteTool(id),
    onMutate: async () => {
      toast.loading('正在删除工具...', { id: 'delete-tool' })
    },
    onSuccess: (response) => {
      toast.dismiss('delete-tool')
      
      console.log('删除工具成功')
      
      toast.success('删除成功')
      
      // 刷新工具列表
      queryClient.invalidateQueries({ 
        queryKey: toolKeys.all,
        refetchType: 'active' 
      })
    },
    onError: (error: any) => {
      toast.dismiss('delete-tool')
      
      console.error('删除工具失败:', error)
      console.error('后端响应:', error?.response?.data || error)
      
      toast.error('删除工具失败，请查看控制台日志')
    },
  })
}
