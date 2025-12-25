/**
 * Nuclei 模板仓库 API
 */

import { api } from "@/lib/api-client"

const BASE_URL = "/nuclei/repos/"

export interface NucleiRepoResponse {
  id: number
  name: string
  repoUrl: string
  localPath: string
  commitHash: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRepoPayload {
  name: string
  repoUrl: string
}

export interface UpdateRepoPayload {
  repoUrl?: string
}

export interface TemplateTreeResponse {
  roots: Array<{
    type: "folder" | "file"
    name: string
    path: string
    children?: Array<{
      type: "folder" | "file"
      name: string
      path: string
      children?: unknown[]
    }>
  }>
}

export interface TemplateContentResponse {
  path: string
  name: string
  content: string
}

/** 分页响应格式 */
interface PaginatedResponse<T> {
  results: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const nucleiRepoApi = {
  /** 获取仓库列表 */
  listRepos: async (): Promise<NucleiRepoResponse[]> => {
    // 仓库数量通常不多，获取全部
    const response = await api.get<PaginatedResponse<NucleiRepoResponse>>(BASE_URL, {
      params: { pageSize: 1000 }
    })
    // 后端返回分页格式，取 results 数组
    return response.data.results
  },

  /** 获取单个仓库 */
  getRepo: async (repoId: number): Promise<NucleiRepoResponse> => {
    const response = await api.get<NucleiRepoResponse>(`${BASE_URL}${repoId}/`)
    return response.data
  },

  /** 创建仓库 */
  createRepo: async (payload: CreateRepoPayload): Promise<NucleiRepoResponse> => {
    const response = await api.post<NucleiRepoResponse>(BASE_URL, payload)
    return response.data
  },

  /** 更新仓库（部分更新） */
  updateRepo: async (repoId: number, payload: UpdateRepoPayload): Promise<NucleiRepoResponse> => {
    const response = await api.patch<NucleiRepoResponse>(`${BASE_URL}${repoId}/`, payload)
    return response.data
  },

  /** 删除仓库 */
  deleteRepo: async (repoId: number): Promise<void> => {
    await api.delete(`${BASE_URL}${repoId}/`)
  },

  /** 刷新仓库（Git clone/pull） */
  refreshRepo: async (repoId: number): Promise<{ message: string; result: unknown }> => {
    const response = await api.post<{ message: string; result: unknown }>(
      `${BASE_URL}${repoId}/refresh/`
    )
    return response.data
  },

  /** 获取模板目录树 */
  getTemplateTree: async (repoId: number): Promise<TemplateTreeResponse> => {
    const response = await api.get<TemplateTreeResponse>(
      `${BASE_URL}${repoId}/templates/tree/`
    )
    return response.data
  },

  /** 获取模板内容 */
  getTemplateContent: async (repoId: number, path: string): Promise<TemplateContentResponse> => {
    const response = await api.get<TemplateContentResponse>(
      `${BASE_URL}${repoId}/templates/content/`,
      { params: { path } }
    )
    return response.data
  },
}
