/**
 * Target 类型定义
 */

/**
 * 目标类型
 */
export type TargetType = 'domain' | 'ip' | 'cidr'

/**
 * 目标基础信息（用于列表显示）
 */
export interface Target {
  id: number
  name: string
  type: TargetType  // 后端字段：type
  description?: string
  createdAt: string  // 后端字段：created_at，自动转换为 createdAt
  lastScannedAt?: string  // 后端字段：last_scanned_at，自动转换为 lastScannedAt
  // 关联数据（通过 serializer 添加）
  organizations?: Array<{
    id: number
    name: string
  }>
}

/**
 * 目标详情信息（包含统计数据）
 */
export interface TargetDetail extends Target {
  summary: {
    subdomains: number
    websites: number
    endpoints: number
    ips: number
    vulnerabilities: {
      total: number
      critical: number
      high: number
      medium: number
      low: number
    }
  }
}

/**
 * 目标列表响应类型
 */
export interface TargetsResponse {
  results: Target[]
  total: number        // 后端返回 total，不是 count
  page: number         // 当前页码
  pageSize: number     // 每页大小
  totalPages: number   // 总页数
  // 兼容字段（为了向后兼容）
  count?: number       // 可选，等同于 total
  next?: string | null
  previous?: string | null
}

/**
 * 创建目标的请求参数
 */
export interface CreateTargetRequest {
  name: string
  description?: string
}

/**
 * 更新目标的请求参数
 */
export interface UpdateTargetRequest {
  name?: string
  description?: string
}

/**
 * 批量删除目标的请求参数
 */
export interface BatchDeleteTargetsRequest {
  ids: number[]
}

/**
 * 批量删除目标的响应
 */
export interface BatchDeleteTargetsResponse {
  deletedCount: number
  failedIds?: number[]
}

/**
 * 批量创建目标的请求参数
 */
export interface BatchCreateTargetsRequest {
  targets: Array<{
    name: string
    description?: string
  }>
  organizationId?: number  // 可选：关联到指定组织
}

/**
 * 批量创建目标的响应
 */
export interface BatchCreateTargetsResponse {
  createdCount: number
  reusedCount: number
  failedCount: number
  failedTargets: Array<{
    name: string
    reason: string
  }>
  message: string
}

