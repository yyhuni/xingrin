import { api } from "@/lib/api-client"
import type { Tool, GetToolsResponse, CreateToolRequest, UpdateToolRequest, GetToolsParams } from "@/types/tool.types"

export class ToolService {
  /**
   * 获取工具列表
   * @param params - 查询参数对象
   * @param params.page - 当前页码，1-based
   * @param params.pageSize - 分页大小
   * @returns Promise<GetToolsResponse>
   * @description 后端固定按更新时间降序排列，不支持自定义排序
   */
  static async getTools(params?: GetToolsParams): Promise<GetToolsResponse> {
    const response = await api.get<GetToolsResponse>(
      '/tools/',
      { params }
    )
    return response.data
  }

  /**
   * 创建新工具
   * @param data - 工具信息对象
   * @param data.name - 工具名称
   * @param data.repoUrl - 仓库地址
   * @param data.version - 版本号
   * @param data.description - 工具描述
   * @returns Promise<{ tool: Tool }>
   */
  static async createTool(data: CreateToolRequest): Promise<{ tool: Tool }> {
    const response = await api.post<{ tool: Tool }>('/tools/create/', data)
    return response.data
  }

  /**
   * 更新工具
   * @param id - 工具ID
   * @param data - 更新的工具信息（所有字段可选）
   * @returns Promise<{ tool: Tool }>
   */
  static async updateTool(id: number, data: UpdateToolRequest): Promise<{ tool: Tool }> {
    const response = await api.put<{ tool: Tool }>(`/tools/${id}/`, data)
    return response.data
  }

  /**
   * 删除工具
   * @param id - 工具ID
   * @returns Promise<void>
   */
  static async deleteTool(id: number): Promise<void> {
    await api.delete(`/tools/${id}/`)
  }
}
