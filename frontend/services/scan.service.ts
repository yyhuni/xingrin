import { api } from '@/lib/api-client'
import type { 
  GetScansParams, 
  GetScansResponse,
  InitiateScanRequest,
  InitiateScanResponse,
  QuickScanRequest,
  QuickScanResponse,
  ScanRecord
} from '@/types/scan.types'

/**
 * 获取扫描列表
 */
export async function getScans(params?: GetScansParams): Promise<GetScansResponse> {
  const res = await api.get<GetScansResponse>('/scans/', { params })
  return res.data
}

/**
 * 获取单个扫描详情
 * @param id - 扫描ID
 * @returns 扫描详情
 */
export async function getScan(id: number): Promise<ScanRecord> {
  const res = await api.get<ScanRecord>(`/scans/${id}/`)
  return res.data
}

/**
 * 发起扫描任务（针对已存在的目标/组织）
 * @param data - 扫描请求参数
 * @returns 扫描任务信息
 */
export async function initiateScan(data: InitiateScanRequest): Promise<InitiateScanResponse> {
  const res = await api.post<InitiateScanResponse>('/scans/initiate/', data)
  return res.data
}

/**
 * 快速扫描（自动创建目标并立即扫描）
 * @param data - 快速扫描请求参数
 * @returns 扫描任务信息
 */
export async function quickScan(data: QuickScanRequest): Promise<QuickScanResponse> {
  const res = await api.post<QuickScanResponse>('/scans/quick/', data)
  return res.data
}

/**
 * 删除单个扫描记录
 * @param id - 扫描ID
 */
export async function deleteScan(id: number): Promise<void> {
  await api.delete(`/scans/${id}/`)
}

/**
 * 批量删除扫描记录
 * @param ids - 扫描ID数组
 * @returns 删除结果
 */
export async function bulkDeleteScans(ids: number[]): Promise<{ message: string; deletedCount: number }> {
  const res = await api.post<{ message: string; deletedCount: number }>('/scans/bulk-delete/', { ids })
  return res.data
}

/**
 * 停止扫描任务
 * @param id - 扫描ID
 * @returns 操作结果
 */
export async function stopScan(id: number): Promise<{ message: string; revokedTaskCount: number }> {
  const res = await api.post<{ message: string; revokedTaskCount: number }>(`/scans/${id}/stop/`)
  return res.data
}

/**
 * 扫描统计数据类型
 */
export interface ScanStatistics {
  total: number
  running: number
  completed: number
  failed: number
  totalVulns: number
  totalSubdomains: number
  totalEndpoints: number
  totalWebsites: number
  totalAssets: number
}

/**
 * 获取扫描统计数据
 * @returns 统计数据
 */
export async function getScanStatistics(): Promise<ScanStatistics> {
  const res = await api.get<ScanStatistics>('/scans/statistics/')
  return res.data
}
