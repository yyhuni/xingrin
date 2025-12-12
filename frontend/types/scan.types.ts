/**
 * 扫描任务状态枚举
 * 与后端 ScanStatus 保持一致
 */
export type ScanStatus = "cancelled" | "completed" | "failed" | "initiated" | "running"

/**
 * 扫描阶段（动态，来自 engine_config 的 key）
 */
export type ScanStage = string

/**
 * 阶段进度状态
 */
export type StageStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

/**
 * 单个阶段的进度信息
 */
export interface StageProgressItem {
  status: StageStatus
  order: number          // 执行顺序（从 0 开始）
  startedAt?: string     // ISO 时间字符串
  duration?: number      // 执行时长（秒）
  detail?: string        // 完成详情
  error?: string         // 错误信息
  reason?: string        // 跳过原因
}

/**
 * 各阶段进度字典（动态 key）
 */
export type StageProgress = Record<string, StageProgressItem>

export interface ScanRecord {
  id: number
  target?: number              // 目标ID（对应后端 target）
  targetName: string           // 目标名称（对应后端 targetName）
  summary: {
    subdomains: number
    websites: number
    directories: number
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
  engine?: number              // 引擎ID（对应后端 engine）
  engineName: string           // 引擎名称（对应后端 engineName）
  createdAt: string            // 创建时间（对应后端 createdAt）
  status: ScanStatus
  errorMessage?: string        // 错误信息（对应后端 errorMessage，失败时有值）
  progress: number             // 0-100
  currentStage?: ScanStage     // 当前扫描阶段（仅 running 状态有值）
  stageProgress?: StageProgress // 各阶段进度详情
}

export interface GetScansParams {
  page?: number
  pageSize?: number
  status?: ScanStatus
  search?: string
}

export interface GetScansResponse {
  results: ScanRecord[]        // 对应后端 results 字段
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 发起扫描请求参数（用于已存在的目标/组织）
 */
export interface InitiateScanRequest {
  organizationId?: number  // 组织ID（二选一）
  targetId?: number        // 目标ID（二选一）
  engineId: number         // 扫描引擎ID（必填）
}

/**
 * 快速扫描请求参数（自动创建目标并扫描）
 */
export interface QuickScanRequest {
  targets: { name: string }[]  // 目标列表
  engineId: number             // 扫描引擎ID（必填）
}

/**
 * 快速扫描响应
 */
export interface QuickScanResponse {
  message: string
  targetStats: {
    created: number
    failed: number
  }
  scans: ScanTask[]
}

/**
 * 单个扫描任务信息
 */
export interface ScanTask {
  id: number
  target: number           // 目标ID
  engine: number           // 引擎ID
  status: ScanStatus
  createdAt: string
  updatedAt: string
}

/**
 * 发起扫描响应
 */
export interface InitiateScanResponse {
  message: string          // 成功消息
  count: number            // 创建的扫描任务数量
  scans: ScanTask[]        // 扫描任务列表
}
