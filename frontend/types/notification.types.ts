/**
 * 通知类型定义
 */

// 通知类型枚举（与后端 NotificationCategory 对应）
export type NotificationType = "vulnerability" | "scan" | "asset" | "system"

// 严重等级（与后端 NotificationLevel 对应）
export type NotificationSeverity = "low" | "medium" | "high" | "critical"

// 后端通知级别（与后端保持一致）
export type BackendNotificationLevel = NotificationSeverity

// 后端通知数据格式
export interface BackendNotification {
  id: number
  category?: NotificationType
  title: string
  message: string
  level: BackendNotificationLevel
  created_at?: string
  createdAt?: string
  read_at?: string | null
  readAt?: string | null
  is_read?: boolean
  isRead?: boolean
}

// 通知接口
export interface Notification {
  id: number
  type: NotificationType
  title: string
  description: string
  detail?: string
  time: string
  unread: boolean
  severity?: NotificationSeverity
  createdAt?: string
}

// 获取通知列表请求参数
export interface GetNotificationsRequest {
  page?: number
  pageSize?: number
  type?: NotificationType
  unread?: boolean
}

// 获取通知列表响应
export interface GetNotificationsResponse {
  results: BackendNotification[]
  total: number
  page: number
  pageSize: number      // 后端返回 camelCase 格式
  totalPages: number    // 后端返回 camelCase 格式
  // 兼容字段（向后兼容）
  page_size?: number
  total_pages?: number
}
