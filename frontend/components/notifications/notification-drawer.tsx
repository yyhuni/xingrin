"use client"

import * as React from "react"
import { Bell, AlertTriangle, Activity, Info, Server, BellOff, Wifi, WifiOff, CheckCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { transformBackendNotification, useNotificationSSE } from "@/hooks/use-notification-sse"
import { useMarkAllAsRead, useNotifications } from "@/hooks/use-notifications"
import type { Notification, NotificationType, NotificationSeverity } from "@/types/notification.types"

/**
 * 通知抽屉组件
 * 从右侧滑出的侧边面板，显示详细的通知信息
 */
// 筛选标签配置
const filterTabs: { value: NotificationType | 'all'; label: string; icon?: React.ReactNode }[] = [
  { value: 'all', label: '全部' },
  { value: 'scan', label: '扫描', icon: <Activity className="h-3 w-3" /> },
  { value: 'vulnerability', label: '漏洞', icon: <AlertTriangle className="h-3 w-3" /> },
  { value: 'asset', label: '资产', icon: <Server className="h-3 w-3" /> },
  { value: 'system', label: '系统', icon: <Info className="h-3 w-3" /> },
]

// 分类标题映射
const categoryTitleMap: Record<NotificationType, string> = {
  scan: '扫描任务',
  vulnerability: '漏洞发现',
  asset: '资产发现',
  system: '系统消息',
}

/** 连接状态指示器 */
function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          isConnected ? "bg-emerald-500" : "bg-gray-400"
        )} />
      </span>
      <span className="text-xs text-muted-foreground">
        {isConnected ? "实时" : "离线"}
      </span>
    </div>
  )
}

/** 通知骨架屏 */
function NotificationSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border p-3">
          <div className="flex items-start gap-2.5">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 时间分组辅助函数 */
function getTimeGroup(dateStr?: string): 'today' | 'yesterday' | 'earlier' {
  if (!dateStr) return 'earlier'
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  
  if (date >= today) return 'today'
  if (date >= yesterday) return 'yesterday'
  return 'earlier'
}

const timeGroupLabels = {
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
}

export function NotificationDrawer() {
  const [open, setOpen] = React.useState(false)
  const [activeFilter, setActiveFilter] = React.useState<NotificationType | 'all'>('all')
  const queryParams = React.useMemo(() => ({ pageSize: 100 }), [])
  const { data: notificationResponse, isLoading: isHistoryLoading } = useNotifications(queryParams)
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsRead()

  // SSE 实时通知
  const { notifications: sseNotifications, isConnected } = useNotificationSSE()

  const [historyNotifications, setHistoryNotifications] = React.useState<Notification[]>([])

  React.useEffect(() => {
    if (!notificationResponse?.results) return
    const backendNotifications = notificationResponse.results ?? []
    setHistoryNotifications(backendNotifications.map(transformBackendNotification))
  }, [notificationResponse])

  // 合并 SSE 和 API 通知，SSE 优先
  const allNotifications = React.useMemo(() => {
    const seen = new Set<number>()
    const merged: Notification[] = []

    for (const notification of sseNotifications) {
      if (!seen.has(notification.id)) {
        merged.push(notification)
        seen.add(notification.id)
      }
    }

    for (const notification of historyNotifications) {
      if (!seen.has(notification.id)) {
        merged.push(notification)
        seen.add(notification.id)
      }
    }

    return merged.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bTime - aTime
    })
  }, [historyNotifications, sseNotifications])

  // 未读通知数量
  const unreadCount = allNotifications.filter(n => n.unread).length

  const unreadByType = React.useMemo<Record<NotificationType | 'all', number>>(() => {
    const counts: Record<NotificationType | 'all', number> = {
      all: 0,
      scan: 0,
      vulnerability: 0,
      asset: 0,
      system: 0,
    }

    allNotifications.forEach(notification => {
      if (!notification.unread) return
      counts.all += 1
      if (counts[notification.type] !== undefined) {
        counts[notification.type] += 1
      }
    })

    return counts
  }, [allNotifications])

  // 筛选后的通知列表
  const filteredNotifications = React.useMemo(() => {
    if (activeFilter === 'all') return allNotifications
    return allNotifications.filter(n => n.type === activeFilter)
  }, [allNotifications, activeFilter])

  // 获取通知图标
  const severityIconClassMap: Record<NotificationSeverity, string> = {
    critical: "text-purple-500",
    high: "text-red-500",
    medium: "text-amber-500",
    low: "text-gray-500",
  }

  const getNotificationIcon = (type: NotificationType, severity?: NotificationSeverity) => {
    const severityClass = severity ? severityIconClassMap[severity] : "text-gray-500"

    if (type === "vulnerability") {
      return <AlertTriangle className={cn("h-5 w-5", severityClass)} />
    }
    if (type === "scan") {
      return <Activity className={cn("h-5 w-5", severityClass)} />
    }
    if (type === "asset") {
      return <Server className={cn("h-5 w-5", severityClass)} />
    }
    return <Info className={cn("h-5 w-5", severityClass)} />
  }

  const severityCardClassMap: Record<NotificationSeverity, string> = {
    critical: "border-purple-300 bg-purple-50 hover:bg-purple-100 dark:border-purple-500/60 dark:bg-purple-500/10 dark:hover:bg-purple-500/20",
    high: "border-red-300 bg-red-50 hover:bg-red-100 dark:border-red-500/60 dark:bg-red-500/10 dark:hover:bg-red-500/20",
    medium: "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/60 dark:bg-amber-500/10 dark:hover:bg-amber-500/20",
    low: "border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-500/60 dark:bg-gray-500/10 dark:hover:bg-gray-500/20",
  }

  const getNotificationCardClasses = (severity?: NotificationSeverity) => {
    if (!severity) {
      return "border-border bg-card hover:bg-accent/50"
    }
    return cn("border-border", severityCardClassMap[severity] ?? "")
  }

  const handleMarkAll = React.useCallback(() => {
    if (allNotifications.length === 0 || isMarkingAll) return
    markAllAsRead(undefined, {
      onSuccess: () => {
        setHistoryNotifications(prev => prev.map(notification => ({ ...notification, unread: false })))
      },
    })
  }, [allNotifications.length, isMarkingAll, markAllAsRead])

  // 按时间分组通知
  const groupedNotifications = React.useMemo(() => {
    const groups: Record<'today' | 'yesterday' | 'earlier', Notification[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    }
    
    filteredNotifications.forEach(notification => {
      const group = getTimeGroup(notification.createdAt)
      groups[group].push(notification)
    })
    
    return groups
  }, [filteredNotifications])

  // 渲染单个通知卡片
  const renderNotificationCard = (notification: Notification) => (
    <div
      key={notification.id}
      className={cn(
        "group relative rounded-lg border p-3 transition-all duration-200 overflow-hidden",
        "hover:shadow-sm hover:scale-[1.01]",
        getNotificationCardClasses(notification.severity)
      )}
    >
      {notification.unread && (
        <span className="absolute right-2 bottom-2 h-2 w-2 rounded-full bg-primary" aria-hidden />
      )}
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 p-1.5 rounded-full shrink-0",
          notification.severity === 'critical' && "bg-purple-100 dark:bg-purple-500/20",
          notification.severity === 'high' && "bg-red-100 dark:bg-red-500/20",
          notification.severity === 'medium' && "bg-amber-100 dark:bg-amber-500/20",
          (!notification.severity || notification.severity === 'low') && "bg-muted"
        )}>
          {getNotificationIcon(notification.type, notification.severity)}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* 分类标题 + 时间 */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {categoryTitleMap[notification.type]}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {notification.time}
            </span>
          </div>
          {/* 通知标题 */}
          <p className="text-sm font-semibold leading-snug truncate">
            {notification.title}
          </p>
          {/* 通知描述 - 支持换行显示 */}
          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line break-all line-clamp-4">
            {notification.description}
          </p>
        </div>
      </div>
    </div>
  )

  // 渲染通知列表（带时间分组）
  const renderNotificationList = () => {
    const hasAny = filteredNotifications.length > 0
    
    if (!hasAny) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <BellOff className="h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">暂无通知</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {(['today', 'yesterday', 'earlier'] as const).map(group => {
          const items = groupedNotifications[group]
          if (items.length === 0) return null
          
          return (
            <div key={group}>
              <h3 className="sticky top-0 z-10 text-xs font-medium text-muted-foreground mb-2 px-1 py-1 backdrop-blur bg-background/90">
                {timeGroupLabels[group]}
              </h3>
              <div className="space-y-2">
                {items.map(renderNotificationCard)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <>
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive animate-ping opacity-75" />
              <Badge 
                variant="destructive" 
                className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full p-0 text-[10px] flex items-center justify-center"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            </>
          )}
          <span className="sr-only">通知</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[440px] p-0 flex flex-col gap-0">
        <SheetHeader className="border-b px-4 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-sm font-semibold">通知</SheetTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAll}
                disabled={isMarkingAll || allNotifications.length === 0}
                className="text-xs text-primary hover:text-primary/80 hover:underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline transition-colors"
                title="全部标记为已读"
              >
                {isMarkingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "全部已读"}
              </button>
            </div>
          </div>
        </SheetHeader>

        {/* 分类筛选标签 */}
        <div className="flex gap-1 px-3 py-1.5 border-b overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                activeFilter === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
              {unreadByType[tab.value] > 0 && (
                <span
                  className={cn(
                    "ml-1 h-1.5 w-1.5 rounded-full",
                    activeFilter === tab.value ? "bg-primary-foreground" : "bg-primary"
                  )}
                />
              )}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3">
            {isHistoryLoading && allNotifications.length === 0 ? (
              <NotificationSkeleton />
            ) : (
              renderNotificationList()
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
