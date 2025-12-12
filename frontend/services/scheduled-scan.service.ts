import { api } from '@/lib/api-client'
import type {
  GetScheduledScansResponse,
  ScheduledScan,
  CreateScheduledScanRequest,
  UpdateScheduledScanRequest
} from '@/types/scheduled-scan.types'

/**
 * 获取定时扫描列表
 */
export async function getScheduledScans(params?: { page?: number; pageSize?: number; search?: string }): Promise<GetScheduledScansResponse> {
  const res = await api.get<GetScheduledScansResponse>('/scheduled-scans/', { params })
  return res.data
}

/**
 * 获取定时扫描详情
 */
export async function getScheduledScan(id: number): Promise<ScheduledScan> {
  const res = await api.get<ScheduledScan>(`/scheduled-scans/${id}/`)
  return res.data
}

/**
 * 创建定时扫描
 */
export async function createScheduledScan(data: CreateScheduledScanRequest): Promise<{
  message: string
  scheduledScan: ScheduledScan
}> {
  const res = await api.post<{ message: string; scheduledScan: ScheduledScan }>('/scheduled-scans/', data)
  return res.data
}

/**
 * 更新定时扫描
 */
export async function updateScheduledScan(id: number, data: UpdateScheduledScanRequest): Promise<{
  message: string
  scheduledScan: ScheduledScan
}> {
  const res = await api.put<{ message: string; scheduledScan: ScheduledScan }>(`/scheduled-scans/${id}/`, data)
  return res.data
}

/**
 * 删除定时扫描
 */
export async function deleteScheduledScan(id: number): Promise<{ message: string; id: number }> {
  const res = await api.delete<{ message: string; id: number }>(`/scheduled-scans/${id}/`)
  return res.data
}

/**
 * 切换定时扫描启用状态
 */
export async function toggleScheduledScan(id: number, isEnabled: boolean): Promise<{
  message: string
  scheduledScan: ScheduledScan
}> {
  const res = await api.post<{ message: string; scheduledScan: ScheduledScan }>(
    `/scheduled-scans/${id}/toggle/`,
    { isEnabled }
  )
  return res.data
}

