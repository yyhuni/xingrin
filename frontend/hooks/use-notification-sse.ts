/**
 * WebSocket 实时通知 Hook
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BackendNotification, Notification, BackendNotificationLevel, NotificationSeverity } from '@/types/notification.types'
import { getBackendBaseUrl } from '@/lib/env'

const severityMap: Record<BackendNotificationLevel, NotificationSeverity> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

const inferNotificationType = (message: string, category?: string) => {
  // 优先使用后端返回的 category
  if (category === 'scan' || category === 'vulnerability' || category === 'asset' || category === 'system') {
    return category
  }
  // 后备：通过消息内容推断
  if (message?.includes('扫描') || message?.includes('任务')) {
    return 'scan' as const
  }
  if (message?.includes('漏洞')) {
    return 'vulnerability' as const
  }
  return 'system' as const
}

const formatTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  return date.toLocaleDateString()
}

export const transformBackendNotification = (backendNotification: BackendNotification): Notification => {
  const createdAtRaw = backendNotification.createdAt ?? backendNotification.created_at
  const createdDate = createdAtRaw ? new Date(createdAtRaw) : new Date()
  const isRead = backendNotification.isRead ?? backendNotification.is_read
  const notification: Notification = {
    id: backendNotification.id,
    type: inferNotificationType(backendNotification.message, backendNotification.category),
    title: backendNotification.title,
    description: backendNotification.message,
    time: formatTimeAgo(createdDate),
    unread: isRead === true ? false : true,
    severity: severityMap[backendNotification.level] ?? undefined,
    createdAt: createdDate.toISOString(),
  }
  return notification
}

export function useNotificationSSE() {
  const [isConnected, setIsConnected] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const queryClient = useQueryClient()
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectingRef = useRef(false)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 10
  const baseReconnectDelay = 1000 // 1秒

  const markNotificationsAsRead = useCallback((ids?: number[]) => {
    setNotifications(prev => prev.map(notification => {
      if (!ids || ids.includes(notification.id)) {
        return { ...notification, unread: false }
      }
      return notification
    }))
  }, [])

  // 启动心跳
  const startHeartbeat = useCallback(() => {
    // 清除旧的心跳定时器
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
    }

    // 每 30 秒发送一次心跳
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[HEARTBEAT] 发送心跳 ping')
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // 30秒
  }, [])

  // 停止心跳
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
  }, [])

  // 计算重连延迟（指数退避）
  const getReconnectDelay = useCallback(() => {
    const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts.current), 30000)
    return delay
  }, [])

  // 连接 WebSocket
  const connect = useCallback(() => {
    // 防止重复连接
    if (isConnectingRef.current) {
      console.log('[SKIP] 已在连接中，跳过')
      return
    }

    // 如果已经连接，跳过
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[SKIP] 已连接，跳过')
      return
    }

    isConnectingRef.current = true

    // 关闭旧连接
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close()
    }

    // 清除重连定时器
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    try {
      // 构造 WebSocket URL
      const backendUrl = getBackendBaseUrl()
      const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws'
      const wsHost = backendUrl.replace(/^https?:\/\//, '')
      const wsUrl = `${wsProtocol}://${wsHost}/ws/notifications/`

      console.log('[CONNECTING] 正在连接 WebSocket:', wsUrl, `(尝试 ${reconnectAttempts.current + 1})`)

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[SUCCESS] WebSocket 连接已建立')
        setIsConnected(true)
        isConnectingRef.current = false
        reconnectAttempts.current = 0 // 重置重连计数
        // 启动心跳
        startHeartbeat()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('[MESSAGE] WebSocket 消息接收:', data)

          if (data.type === 'connected') {
            console.log('[SUCCESS] WebSocket 连接成功')
            return
          }

          if (data.type === 'pong') {
            // 心跳响应
            console.log('[HEARTBEAT] 心跳响应')
            return
          }

          if (data.type === 'error') {
            console.error('[ERROR] WebSocket 错误:', data.message)
            toast.error(`通知连接错误: ${data.message}`)
            return
          }

          // 处理通知消息
          if (data.type === 'notification') {
            console.log('[NOTIFICATION] 处理通知消息 (type=notification)')
            // 移除 type 字段，获取实际的通知数据
            const { type, ...payload } = data as any

            if (payload.id && payload.title && payload.message) {
              console.log('[TRANSFORM] 转换通知:', payload)
              const notification = transformBackendNotification(payload as BackendNotification)
              console.log('[UPDATE] 更新通知列表，新通知:', notification)
              setNotifications(prev => {
                const updated = [notification, ...prev.slice(0, 49)]
                console.log('[STATS] 通知列表已更新，总数:', updated.length)
                return updated
              })

              queryClient.invalidateQueries({ queryKey: ['notifications'] })
            } else {
              console.warn('[WARN] 通知数据不完整:', payload)
            }
            return
          }

          // 备用处理：直接检查通知字段
          if (data.id && data.title && data.message) {
            console.log('[NOTIFICATION] 处理通知消息 (直接字段)')
            const notification = transformBackendNotification(data as BackendNotification)

            // 添加到通知列表
            console.log('[UPDATE] 更新通知列表，新通知:', notification)
            setNotifications(prev => {
              const updated = [notification, ...prev.slice(0, 49)]
              console.log('[STATS] 通知列表已更新，总数:', updated.length)
              return updated
            })

            // 刷新通知查询
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
          }
        } catch (error) {
          console.error('[ERROR] 解析 WebSocket 消息失败:', error, '原始数据:', event.data)
        }
      }

      ws.onerror = () => {
        // WebSocket onerror 接收的是 Event 对象，不是 Error
        // 实际的错误信息通常不可用，只能记录连接状态
        console.warn('[WARN] WebSocket 连接错误，将自动重连')
        setIsConnected(false)
        isConnectingRef.current = false
      }

      ws.onclose = (event) => {
        console.log('[CLOSED] WebSocket 连接已关闭:', event.code, event.reason)
        setIsConnected(false)
        isConnectingRef.current = false
        // 停止心跳
        stopHeartbeat()

        // 自动重连（非正常关闭时）
        if (event.code !== 1000) { // 1000 = 正常关闭
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = getReconnectDelay()
            reconnectAttempts.current++
            console.log(`[RECONNECT] ${delay / 1000}秒后尝试重连... (第 ${reconnectAttempts.current} 次)`)
            reconnectTimerRef.current = setTimeout(() => {
              connect()
            }, delay)
          } else {
            console.error('[ERROR] 已达到最大重连次数，停止重连')
          }
        }
      }
    } catch (error) {
      console.error('[ERROR] 创建 WebSocket 失败:', error instanceof Error ? error.message : String(error))
      setIsConnected(false)
      isConnectingRef.current = false
    }
  }, [queryClient, startHeartbeat, stopHeartbeat, getReconnectDelay])

  // 断开连接
  const disconnect = useCallback(() => {
    // 停止心跳
    stopHeartbeat()

    // 清除重连定时器
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    // 重置重连计数
    reconnectAttempts.current = 0
    isConnectingRef.current = false

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect') // 1000 = 正常关闭
      wsRef.current = null
    }
    setIsConnected(false)
  }, [stopHeartbeat])

  // 清空通知
  const clearNotifications = () => {
    setNotifications([])
  }

  // 组件挂载时连接，卸载时断开
  // 注意：不依赖 connect/disconnect 避免无限循环
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isConnected,
    notifications,
    connect,
    disconnect,
    clearNotifications,
    markNotificationsAsRead,
  }
}
