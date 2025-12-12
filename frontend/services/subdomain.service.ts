import { api } from "@/lib/api-client"
import type { Subdomain, GetSubdomainsParams, GetSubdomainsResponse, GetAllSubdomainsParams, GetAllSubdomainsResponse, GetSubdomainByIDResponse, BatchCreateSubdomainsResponse } from "@/types/subdomain.types"

export class SubdomainService {
  // ========== 子域名基础操作 ==========

  /**
   * 批量创建子域名（绑定到资产）
   */
  static async createSubdomains(data: {
    domains: Array<{
      name: string
    }>
    assetId: number
  }): Promise<BatchCreateSubdomainsResponse> {
    const response = await api.post<BatchCreateSubdomainsResponse>('/domains/create/', {
      domains: data.domains,
      assetId: data.assetId  // [OK] 驼峰，拦截器转换为 asset_id
    })
    return response.data
  }

  /**
   * 获取单个子域名详情
   */
  static async getSubdomainById(id: string | number): Promise<GetSubdomainByIDResponse> {
    const response = await api.get<GetSubdomainByIDResponse>(`/domains/${id}/`)
    return response.data
  }

  /**
   * 更新子域名信息（PATCH）
   */
  static async updateSubdomain(data: {
    id: number
    name?: string
    description?: string
  }): Promise<Subdomain> {
    const requestBody: any = {}
    if (data.name !== undefined) requestBody.name = data.name
    if (data.description !== undefined) requestBody.description = data.description
    const response = await api.patch<Subdomain>(`/domains/${data.id}/`, requestBody)
    return response.data
  }

  /** 批量删除子域名（支持单个或多个，使用统一接口） */
  static async bulkDeleteSubdomains(
    ids: number[]
  ): Promise<{
    message: string
    deletedCount: number
    requestedIds: number[]
    cascadeDeleted: Record<string, number>
  }> {
    const response = await api.post<{
      message: string
      deletedCount: number
      requestedIds: number[]
      cascadeDeleted: Record<string, number>
    }>(
      `/assets/subdomains/bulk-delete/`,
      { ids }
    )
    return response.data
  }

  /** 删除单个子域名（使用单独的 DELETE API） */
  static async deleteSubdomain(id: number): Promise<{
    message: string
    subdomainId: number
    subdomainName: string
    deletedCount: number
    deletedSubdomains: string[]
    detail: {
      phase1: string
      phase2: string
    }
  }> {
    const response = await api.delete<{
      message: string
      subdomainId: number
      subdomainName: string
      deletedCount: number
      deletedSubdomains: string[]
      detail: {
        phase1: string
        phase2: string
      }
    }>(`/assets/subdomains/${id}/`)
    return response.data
  }

  /** 批量删除子域名（别名，兼容旧代码） */
  static async batchDeleteSubdomains(ids: number[]): Promise<{
    message: string
    deletedCount: number
    requestedIds: number[]
    cascadeDeleted: Record<string, number>
  }> {
    return this.bulkDeleteSubdomains(ids)
  }

  /** 批量从组织中移除子域名 */
  static async batchDeleteSubdomainsFromOrganization(data: {
    organizationId: number
    domainIds: number[]
  }): Promise<{
    message: string
    successCount: number
    failedCount: number
  }> {
    const response = await api.post<any>(
      `/organizations/${data.organizationId}/domains/batch-remove/`,
      {
        domainIds: data.domainIds, // 拦截器转换为 domain_ids
      }
    )
    return response.data
  }

  /** 获取组织的子域名列表（服务端分页） */
  static async getSubdomainsByOrgId(
    organizationId: number,
    params?: {
      page?: number
      pageSize?: number
    }
  ): Promise<GetSubdomainsResponse> {
    const response = await api.get<GetSubdomainsResponse>(
      `/organizations/${organizationId}/domains/`,
      {
        params: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 10,
        }
      }
    )
    return response.data
  }

  /** 获取所有子域名列表（服务端分页） */
  static async getAllSubdomains(params?: GetAllSubdomainsParams): Promise<GetAllSubdomainsResponse> {
    const response = await api.get<GetAllSubdomainsResponse>('/domains/', {
      params: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
      }
    })
    return response.data
  }

  /** 获取目标的子域名列表（支持分页和搜索） */
  static async getSubdomainsByTargetId(
    targetId: number,
    params?: {
      page?: number
      pageSize?: number
      search?: string
    }
  ): Promise<any> {
    const response = await api.get(`/targets/${targetId}/subdomains/`, {
      params: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        ...(params?.search && { search: params.search }),
      }
    })
    return response.data
  }

  /** 获取扫描的子域名列表（支持分页） */
  static async getSubdomainsByScanId(
    scanId: number,
    params?: {
      page?: number
      pageSize?: number
      search?: string
    }
  ): Promise<{
    results: Array<{
      id: number
      name: string
      createdAt: string  // 后端自动转换为 camelCase
      cname: string[]
      isCdn: boolean     // 后端自动转换为 camelCase
      cdnName: string    // 后端自动转换为 camelCase
      ports: Array<{
        number: number
        serviceName: string
        description: string
        isUncommon: boolean
      }>
      ipAddresses: string[]  // IP地址列表
    }>
    total: number
    page: number
    pageSize: number     // 后端自动转换为 camelCase
    totalPages: number   // 后端自动转换为 camelCase
  }> {
    const response = await api.get(`/scans/${scanId}/subdomains/`, {
      params: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        ...(params?.search && { search: params.search }),
      }
    })
    return response.data as any
  }

  /** 按目标导出所有子域名名称（文本文件，一行一个） */
  static async exportSubdomainsByTargetId(targetId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/targets/${targetId}/subdomains/export/`, {
      responseType: 'blob',
    })
    return response.data
  }

  /** 按扫描任务导出所有子域名名称（文本文件，一行一个） */
  static async exportSubdomainsByScanId(scanId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/scans/${scanId}/subdomains/export/`, {
      responseType: 'blob',
    })
    return response.data
  }
}
