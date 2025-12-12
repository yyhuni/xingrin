'use client'

import { useRoutePrefetch } from '@/hooks/use-route-prefetch'

/**
 * 路由预加载组件
 * 在应用启动后自动预加载常用页面的 JS/CSS 资源
 * 这是一个不可见的组件，只用于执行预加载逻辑
 */
export function RoutePrefetch() {
  useRoutePrefetch()
  return null
}
