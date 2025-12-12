/**
 * Worker 节点管理 API 服务
 */

import apiClient from '@/lib/api-client'
import type {
  WorkerNode,
  WorkersResponse,
  CreateWorkerRequest,
  UpdateWorkerRequest,
} from '@/types/worker.types'

const BASE_URL = '/workers'

export const workerService = {
  /**
   * 获取 Worker 列表
   */
  async getWorkers(page = 1, pageSize = 10): Promise<WorkersResponse> {
    const response = await apiClient.get<WorkersResponse>(
      `${BASE_URL}/?page=${page}&page_size=${pageSize}`
    )
    return response.data
  },

  /**
   * 获取单个 Worker 详情
   */
  async getWorker(id: number): Promise<WorkerNode> {
    const response = await apiClient.get<WorkerNode>(`${BASE_URL}/${id}/`)
    return response.data
  },

  /**
   * 创建 Worker 节点
   */
  async createWorker(data: CreateWorkerRequest): Promise<WorkerNode> {
    const response = await apiClient.post<WorkerNode>(`${BASE_URL}/`, {
      name: data.name,
      ip_address: data.ipAddress,
      ssh_port: data.sshPort ?? 22,
      username: data.username ?? 'root',
      password: data.password,
    })
    return response.data
  },

  /**
   * 更新 Worker 节点
   */
  async updateWorker(id: number, data: UpdateWorkerRequest): Promise<WorkerNode> {
    const response = await apiClient.patch<WorkerNode>(`${BASE_URL}/${id}/`, {
      name: data.name,
      ssh_port: data.sshPort,
      username: data.username,
      password: data.password,
    })
    return response.data
  },

  /**
   * 删除 Worker 节点
   */
  async deleteWorker(id: number): Promise<void> {
    await apiClient.delete(`${BASE_URL}/${id}/`)
  },

  /**
   * 部署 Worker 节点（占位实现，当前仅用于消除前端类型错误）
   */
  async deployWorker(id: number): Promise<never> {
    return Promise.reject(new Error(`Worker deploy is not implemented for id=${id}`))
  },

  /**
   * 重启 Worker
   */
  async restartWorker(id: number): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`${BASE_URL}/${id}/restart/`)
    return response.data
  },

  /**
   * 停止 Worker
   */
  async stopWorker(id: number): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(`${BASE_URL}/${id}/stop/`)
    return response.data
  },
}
