import { api } from "@/lib/api-client"
import type {
  Command,
  GetCommandsRequest,
  GetCommandsResponse,
  CreateCommandRequest,
  UpdateCommandRequest,
  CommandResponseData,
  BatchDeleteCommandsResponseData,
} from "@/types/command.types"

/**
 * 命令服务
 */
export class CommandService {
  /**
   * 获取命令列表
   */
  static async getCommands(
    params: GetCommandsRequest = {}
  ): Promise<GetCommandsResponse> {
    const response = await api.get<GetCommandsResponse>(
      "/commands/",
      { params }
    )
    return response.data
  }

  /**
   * 获取单个命令
   */
  static async getCommandById(id: number): Promise<CommandResponseData> {
    const response = await api.get<CommandResponseData>(
      `/commands/${id}/`
    )
    return response.data
  }

  /**
   * 创建命令
   */
  static async createCommand(
    data: CreateCommandRequest
  ): Promise<CommandResponseData> {
    const response = await api.post<CommandResponseData>(
      "/commands/create/",
      data
    )
    return response.data
  }

  /**
   * 更新命令
   */
  static async updateCommand(
    id: number,
    data: UpdateCommandRequest
  ): Promise<CommandResponseData> {
    const response = await api.put<CommandResponseData>(
      `/commands/${id}/`,
      data
    )
    return response.data
  }

  /**
   * 删除命令
   */
  static async deleteCommand(
    id: number
  ): Promise<void> {
    await api.delete(
      `/commands/${id}/`
    )
  }

  /**
   * 批量删除命令
   */
  static async batchDeleteCommands(
    ids: number[]
  ): Promise<BatchDeleteCommandsResponseData> {
    const response = await api.post<BatchDeleteCommandsResponseData>(
      "/commands/batch-delete/",
      { ids }
    )
    return response.data
  }
}
