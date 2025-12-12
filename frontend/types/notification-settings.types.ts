export interface DiscordSettings {
  enabled: boolean
  webhookUrl: string
}

/** 通知分类 - 与后端 NotificationCategory 对应 */
export type NotificationCategory = 'scan' | 'vulnerability' | 'asset' | 'system'

/** 按分类的通知开关 */
export interface NotificationCategories {
  scan: boolean        // 扫描任务
  vulnerability: boolean // 漏洞发现
  asset: boolean       // 资产发现
  system: boolean      // 系统消息
}

export interface NotificationSettings {
  discord: DiscordSettings
  categories: NotificationCategories
}

export type GetNotificationSettingsResponse = NotificationSettings

export type UpdateNotificationSettingsRequest = NotificationSettings

export interface UpdateNotificationSettingsResponse {
  message: string
  discord: DiscordSettings
  categories: NotificationCategories
}
