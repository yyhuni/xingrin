/**
 * Worker 节点相关类型定义
 */

// Worker 状态枚举（前后端统一）
export type WorkerStatus = 'pending' | 'deploying' | 'online' | 'offline'

// Worker 节点
export interface WorkerNode {
  id: number
  name: string
  ipAddress: string
  sshPort: number
  username: string
  status: WorkerStatus
  isLocal: boolean  // 是否为本地节点（Docker 容器内）
  createdAt: string
  updatedAt?: string
  info?: {
    cpuPercent?: number
    memoryPercent?: number
  }
}

// 创建 Worker 请求
export interface CreateWorkerRequest {
  name: string
  ipAddress: string
  sshPort?: number
  username?: string
  password: string
}

// 更新 Worker 请求
export interface UpdateWorkerRequest {
  name?: string
  sshPort?: number
  username?: string
  password?: string
}

// Worker 列表响应
export interface WorkersResponse {
  results: WorkerNode[]
  total: number
  page: number
  pageSize: number
}

