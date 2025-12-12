/**
 * 定时扫描类型定义
 */

// 定时扫描状态
export type ScheduledScanStatus = "active" | "paused" | "expired"

// 扫描模式
export type ScanMode = 'organization' | 'target'

// 定时扫描接口
export interface ScheduledScan {
  id: number
  name: string
  engine: number // 关联的扫描引擎ID
  engineName: string // 关联的扫描引擎名称
  organizationId: number | null // 组织 ID（组织扫描模式）
  organizationName: string | null // 组织名称
  targetId: number | null // 目标 ID（目标扫描模式）
  targetName: string | null // 目标名称（目标扫描模式）
  scanMode: ScanMode // 扫描模式
  cronExpression: string // Cron 表达式
  isEnabled: boolean // 是否启用
  nextRunTime?: string // 下次执行时间
  lastRunTime?: string // 上次执行时间
  runCount: number // 已执行次数
  createdAt: string
  updatedAt: string
}

// 创建定时扫描请求（organizationId 和 targetId 互斥）
export interface CreateScheduledScanRequest {
  name: string
  engineId: number
  organizationId?: number // 组织扫描模式
  targetId?: number // 目标扫描模式
  cronExpression: string // Cron 表达式，格式：分 时 日 月 周
  isEnabled?: boolean
}

// 更新定时扫描请求（organizationId 和 targetId 互斥）
export interface UpdateScheduledScanRequest {
  name?: string
  engineId?: number
  organizationId?: number // 组织扫描模式（设置后清空 targetId）
  targetId?: number // 目标扫描模式（设置后清空 organizationId）
  cronExpression?: string
  isEnabled?: boolean
}

// API 响应
export interface GetScheduledScansResponse {
  results: ScheduledScan[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
