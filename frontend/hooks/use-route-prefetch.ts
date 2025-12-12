import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * 路由预加载 Hook
 * 在页面加载完成后，后台预加载其他页面的 JS/CSS 资源
 * 不会发送 API 请求，只加载页面组件
 * @param currentPath 当前页面路径（可选），如果提供则会智能预加载相关动态路由
 */
export function useRoutePrefetch(currentPath?: string) {
  const router = useRouter()

  useEffect(() => {
    console.log('[START] 路由预加载 Hook 已挂载，开始预加载...')

    // 使用 requestIdleCallback 在浏览器空闲时预加载，不影响当前页面渲染
    const prefetchRoutes = () => {
      const routes = [
        // 仪表盘
        '/dashboard/',
        // 资产管理
        '/assets/organization/',
        '/assets/domain/',
        '/assets/endpoint/',
        '/assets/website/',
        // 扫描
        '/scan/tools/',
        '/scan/history/',
        // 目标
        '/targets/',
        // 漏洞
        '/vulnerabilities/',
        // 设置
        '/settings/workers/',
        '/settings/notification/',
      ]

      routes.forEach((route) => {
        console.log(`  -> 预加载: ${route}`)
        router.prefetch(route)
      })

      // 如果提供了当前路径，智能预加载相关动态路由
      if (currentPath) {
        // 如果是域名详情页（如 /assets/domain/146），预加载子路由
        const domainIdMatch = currentPath.match(/\/assets\/domain\/(\d+)/)
        if (domainIdMatch) {
          const domainId = domainIdMatch[1]
          router.prefetch(`/assets/domain/${domainId}/endpoints`)
          console.log(`  -> 智能预加载域名子路由: /assets/domain/${domainId}/endpoints`)
        }
      }

      console.log('[DONE] 所有路由预加载请求已发送')
    }

    // 使用 requestIdleCallback 在浏览器空闲时执行，如果不支持则立即执行
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(prefetchRoutes)
      return () => window.cancelIdleCallback(idleId)
    } else {
      prefetchRoutes()
      return
    }
  }, [router, currentPath])
}

/**
 * 智能路由预加载 Hook
 * 根据当前路径，预加载用户可能访问的下一个页面
 * @param currentPath 当前页面路径
 */
export function useSmartRoutePrefetch(currentPath: string) {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPath.includes('/assets/organization')) {
        // 在组织页面，预加载域名页面
        router.prefetch('/assets/domain')
      } else if (currentPath.includes('/assets/domain')) {
        // 在域名页面，预加载端点页面
        router.prefetch('/assets/endpoint')

        // 如果是域名详情页（如 /assets/domain/146），预加载子路由
        const domainIdMatch = currentPath.match(/\/assets\/domain\/(\d+)$/)
        if (domainIdMatch) {
          const domainId = domainIdMatch[1]
          router.prefetch(`/assets/domain/${domainId}/endpoints`)
          console.log(`  -> 预加载域名子路由: /assets/domain/${domainId}/endpoints`)
        }
      } else if (currentPath.includes('/assets/scan')) {
        // 在扫描页面，预加载资产页面
        router.prefetch('/assets/organization')
        router.prefetch('/assets/domain')
      } else if (currentPath === '/') {
        // 在首页，预加载主要页面
        router.prefetch('/dashboard')
        router.prefetch('/assets/organization')
      }
    }, 1500) // 1.5 秒后预加载

    return () => clearTimeout(timer)
  }, [currentPath, router])
}
