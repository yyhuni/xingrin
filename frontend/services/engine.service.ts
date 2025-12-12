import apiClient from '@/lib/api-client'
import type { ScanEngine } from '@/types/engine.types'

/**
 * 引擎 API 服务
 */

/**
 * 获取引擎列表
 */
export async function getEngines(): Promise<ScanEngine[]> {
  const response = await apiClient.get('/engines/')
  // 后端返回分页数据: { results: [...], total, page, pageSize, totalPages }
  // 这里暂时返回 results 数组
  return response.data.results || response.data
}

/**
 * 获取引擎详情
 */
export async function getEngine(id: number): Promise<ScanEngine> {
  const response = await apiClient.get(`/engines/${id}/`)
  return response.data
}

/**
 * 创建引擎
 */
export async function createEngine(data: {
  name: string
  configuration: string
}): Promise<ScanEngine> {
  const response = await apiClient.post('/engines/', data)
  return response.data
}

/**
 * 更新引擎
 */
export async function updateEngine(
  id: number,
  data: Partial<{
    name: string
    configuration: string
  }>
): Promise<ScanEngine> {
  const response = await apiClient.patch(`/engines/${id}/`, data)
  return response.data
}

/**
 * 删除引擎
 */
export async function deleteEngine(id: number): Promise<void> {
  await apiClient.delete(`/engines/${id}/`)
}

