"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { LoadingState } from "@/components/loading-spinner"
import { Suspense } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"

// 不需要登录的公开路由
const PUBLIC_ROUTES = ["/login"]

interface AuthLayoutProps {
  children: React.ReactNode
}

/**
 * 认证布局组件
 * 根据登录状态和路由决定是否显示侧边栏
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: auth, isLoading } = useAuth()

  // 检查是否是公开路由（登录页）
  const isPublicRoute = PUBLIC_ROUTES.some((route) => 
    pathname.startsWith(route)
  )

  // 未登录跳转登录页（useEffect 必须在所有条件返回之前）
  React.useEffect(() => {
    if (!isLoading && !auth?.authenticated && !isPublicRoute) {
      router.push("/login/")
    }
  }, [auth, isLoading, isPublicRoute, router])

  // 如果是登录页，直接渲染内容（不带侧边栏）
  if (isPublicRoute) {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  // 加载中或未登录
  if (isLoading || !auth?.authenticated) {
    return <LoadingState message="loading..." />
  }

  // 已登录显示完整布局（带侧边栏）
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 70)",
          "--header-height": "calc(var(--spacing) * 11)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="flex min-h-0 flex-col h-svh">
        <SiteHeader />
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          <div className="@container/main flex-1 min-h-0 flex flex-col gap-2">
            <Suspense fallback={<LoadingState message="页面加载中..." />}>
              {children}
            </Suspense>
            <Toaster />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
