/**
 * 通知相关的 React Query hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotificationService } from '@/services/notification.service'
import type {
  GetNotificationsRequest,
} from '@/types/notification.types'
import { toast } from 'sonner'

/**
 * 获取通知列表
 */
export function useNotifications(params?: GetNotificationsRequest) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => NotificationService.getNotifications(params),
  })
}

/**
 * 获取未读通知数量
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => NotificationService.getUnreadCount(),
    refetchInterval: 30000, // 每 30 秒自动刷新
  })
}

/**
 * 标记所有通知为已读
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => NotificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error: any) => {
      console.error('标记全部已读失败:', error)
    },
  })
}

