import { api } from "@/lib/api-client"
import type { 
  Endpoint, 
  CreateEndpointRequest, 
  UpdateEndpointRequest,
  GetEndpointsRequest,
  GetEndpointsResponse,
  BatchDeleteEndpointsRequest,
  BatchDeleteEndpointsResponse
} from "@/types/endpoint.types"

export class EndpointService {

  /**
   * 获取单个 Endpoint 详情
   * @param id - Endpoint ID
   * @returns Promise<Endpoint>
   */
  static async getEndpointById(id: number): Promise<Endpoint> {
    const response = await api.get<Endpoint>(`/endpoints/${id}/`)
    return response.data
  }

  /**
   * 获取 Endpoint 列表
   * @param params - 查询参数
   * @returns Promise<GetEndpointsResponse>
   */
  static async getEndpoints(params: GetEndpointsRequest): Promise<GetEndpointsResponse> {
    // api-client.ts 会自动将 params 对象的驼峰转换为下划线
    const response = await api.get<GetEndpointsResponse>('/endpoints/', {
      params
    })
    return response.data
  }

  /**
   * 根据目标ID获取 Endpoint 列表（专用路由）
   * @param targetId - 目标ID
   * @param params - 其他查询参数
   * @returns Promise<GetEndpointsResponse>
   */
  static async getEndpointsByTargetId(targetId: number, params: GetEndpointsRequest): Promise<GetEndpointsResponse> {
    // api-client.ts 会自动将 params 对象的驼峰转换为下划线
    const response = await api.get<GetEndpointsResponse>(`/targets/${targetId}/endpoints/`, {
      params
    })
    return response.data
  }

  /**
   * 根据扫描ID获取 Endpoint 列表（历史快照）
   * @param scanId - 扫描任务 ID
   * @param params - 分页等查询参数
   */
  static async getEndpointsByScanId(
    scanId: number,
    params: GetEndpointsRequest,
  ): Promise<any> {
    const response = await api.get(`/scans/${scanId}/endpoints/`, {
      params,
    })
    return response.data
  }

  /**
   * 批量创建 Endpoint
   * @param data - 创建请求对象
   * @param data.endpoints - Endpoint 数据数组
   * @returns Promise<CreateEndpointsResponse>
   */
  static async createEndpoints(data: { endpoints: Array<CreateEndpointRequest> }): Promise<any> {
    // api-client.ts 会自动将请求体的驼峰转换为下划线
    const response = await api.post('/endpoints/create/', data)
    return response.data
  }

  /**
   * 删除 Endpoint
   * @param id - Endpoint ID
   * @returns Promise<void>
   */
  static async deleteEndpoint(id: number): Promise<void> {
    await api.delete(`/endpoints/${id}/`)
  }

  /**
   * 批量删除 Endpoint
   * @param data - 批量删除请求对象
   * @param data.endpointIds - Endpoint ID 列表
   * @returns Promise<BatchDeleteEndpointsResponse>
   */
  static async batchDeleteEndpoints(data: BatchDeleteEndpointsRequest): Promise<BatchDeleteEndpointsResponse> {
    // api-client.ts 会自动将请求体的驼峰转换为下划线
    const response = await api.post<BatchDeleteEndpointsResponse>('/endpoints/batch-delete/', data)
    return response.data
  }

  /** 按目标导出所有端点 URL（文本文件，一行一个） */
  static async exportEndpointsByTargetId(targetId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/targets/${targetId}/endpoints/export/`, {
      responseType: 'blob',
    })
    return response.data
  }

  /** 按扫描任务导出所有端点 URL（文本文件，一行一个） */
  static async exportEndpointsByScanId(scanId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/scans/${scanId}/endpoints/export/`, {
      responseType: 'blob',
    })
    return response.data
  }

}
