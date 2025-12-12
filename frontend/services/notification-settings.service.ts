import { api } from '@/lib/api-client'
import type {
  GetNotificationSettingsResponse,
  UpdateNotificationSettingsRequest,
  UpdateNotificationSettingsResponse,
} from '@/types/notification-settings.types'

export class NotificationSettingsService {
  static async getSettings(): Promise<GetNotificationSettingsResponse> {
    const res = await api.get<GetNotificationSettingsResponse>('/settings/notifications/')
    return res.data
  }

  static async updateSettings(
    data: UpdateNotificationSettingsRequest
  ): Promise<UpdateNotificationSettingsResponse> {
    const res = await api.put<UpdateNotificationSettingsResponse>('/settings/notifications/', data)
    return res.data
  }
}
