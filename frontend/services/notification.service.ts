/**
 * 通知服务
 * 处理所有与通知相关的 API 请求
 */

import api from '@/lib/api-client'
import type { ApiResponse } from '@/types/api-response.types'
import type {
  Notification,
  GetNotificationsRequest,
  GetNotificationsResponse,
} from '@/types/notification.types'

export class NotificationService {
  /**
   * 获取通知列表
   */
  static async getNotifications(
    params: GetNotificationsRequest = {}
  ): Promise<GetNotificationsResponse> {
    const response = await api.get<GetNotificationsResponse | ApiResponse<GetNotificationsResponse>>('/notifications/', {
      params,
    })
    const payload = response.data

    if (
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      (payload as ApiResponse<GetNotificationsResponse>).data
    ) {
      return (payload as ApiResponse<GetNotificationsResponse>).data as GetNotificationsResponse
    }

    return payload as GetNotificationsResponse
  }

  /**
   * 标记所有通知为已读
   */
  static async markAllAsRead(): Promise<ApiResponse<null>> {
    const response = await api.post<ApiResponse<null>>('/notifications/mark-all-as-read/')
    return response.data
  }

  /**
   * 获取未读通知数量
   */
  static async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    const response = await api.get<ApiResponse<{ count: number }>>('/notifications/unread-count/')
    return response.data
  }
}
