import { api } from "@/lib/api-client"
import type { Organization, OrganizationsResponse } from "@/types/organization.types"


export class OrganizationService {
  // ========== 组织基础操作 ==========

  /**
   * 获取组织列表
   * @param params - 查询参数对象
   * @param params.page - 当前页码，1-based
   * @param params.pageSize - 分页大小
   * @returns Promise<OrganizationsResponse<Organization>>
   * @description 后端固定按更新时间降序排列，不支持自定义排序
   */
  static async getOrganizations(params?: {
    page?: number
    pageSize?: number
    search?: string
  }): Promise<OrganizationsResponse<Organization>> {
    const response = await api.get<OrganizationsResponse<Organization>>(
      '/organizations/',
      { params }
    )
    return response.data
  }

  /**
   * 获取单个组织详情
   * @param id - 组织ID
   * @returns Promise<Organization>
   */
  static async getOrganizationById(id: string | number): Promise<Organization> {
    const response = await api.get<Organization>(`/organizations/${id}/`)
    return response.data
  }

  /**
   * 获取组织的目标列表
   * @param id - 组织ID
   * @param params - 查询参数
   * @returns Promise<any>
   */
  static async getOrganizationTargets(id: string | number, params?: {
    page?: number
    pageSize?: number
    search?: string
  }): Promise<any> {
    const response = await api.get<any>(
      `/organizations/${id}/targets/`,
      { params }
    )
    return response.data
  }

  /**
   * 创建新组织
   * @param data - 组织信息对象
   * @param data.name - 组织名称
   * @param data.description - 组织描述
   * @returns Promise<Organization> - 创建成功后的组织信息对象
   */
  static async createOrganization(data: {
    name: string
    description: string
  }): Promise<Organization> {
    const response = await api.post<Organization>('/organizations/', data)
    return response.data
  }

  /**
   * 更新组织信息
   * @param data - 组织信息对象
   * @param data.id - 组织ID，number或string类型
   * @param data.name - 组织名称
   * @param data.description - 组织描述
   * @returns Promise<Organization> - 更新成功后的组织信息对象
   */
  static async updateOrganization(data: {
    id: string | number
    name: string
    description: string
  }): Promise<Organization> {
    const response = await api.put<Organization>(`/organizations/${data.id}/`, {
      name: data.name,
      description: data.description
    })
    return response.data
  }
  /**
   * 删除组织（使用单独的 DELETE API）
   * 
   * @param id - 组织ID，number类型
   * @returns Promise<删除响应>
   */
  static async deleteOrganization(id: number): Promise<{
    message: string
    organizationId: number
    organizationName: string
    deletedCount: number
    deletedOrganizations: string[]
    detail: {
      phase1: string
      phase2: string
    }
  }> {
    const response = await api.delete<{
      message: string
      organizationId: number
      organizationName: string
      deletedCount: number
      deletedOrganizations: string[]
      detail: {
        phase1: string
        phase2: string
      }
    }>(`/organizations/${id}/`)
    return response.data
  }

  /**
   * 批量删除组织
   * @param organizationIds - 组织ID数组，number类型
   * @returns Promise<{ message: string; deletedOrganizationCount: number }>
   * 
   * 注意: 删除组织不会删除域名实体，只会解除关联关系
   */
  static async batchDeleteOrganizations(organizationIds: number[]): Promise<{
    message: string
    deletedOrganizationCount: number
  }> {
    const response = await api.post<{
      message: string
      deletedOrganizationCount: number
    }>('/organizations/batch_delete/', {
      organizationIds  // [OK] 使用驼峰命名，拦截器会自动转换为 organization_ids
    })
    return response.data
  }

  // ========== 组织与目标关联操作 ==========

  /**
   * 关联目标到组织（单个）
   * @param data - 关联请求对象
   * @param data.organizationId - 组织ID
   * @param data.targetId - 目标ID
   * @returns Promise<{ message: string }>
   */
  static async linkTargetToOrganization(data: {
    organizationId: number
    targetId: number
  }): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      `/organizations/${data.organizationId}/targets/`,
      {
        targetId: data.targetId  // 拦截器会转换为 target_id
      }
    )
    return response.data
  }

  /**
   * 从组织中移除目标（批量）
   * @param data - 移除请求对象
   * @param data.organizationId - 组织ID
   * @param data.targetIds - 目标ID数组
   * @returns Promise<{ unlinkedCount: number; message: string }>
   */
  static async unlinkTargetsFromOrganization(data: {
    organizationId: number
    targetIds: number[]
  }): Promise<{ unlinkedCount: number; message: string }> {
    const response = await api.post<{ unlinkedCount: number; message: string }>(
      `/organizations/${data.organizationId}/unlink_targets/`,
      {
        targetIds: data.targetIds  // 拦截器会转换为 target_ids
      }
    )
    return response.data
  }

}