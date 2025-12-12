import type React from "react"
// 导入 Next.js 的元数据类型定义
import type { Metadata } from "next"

// 导入全局样式文件
import "./globals.css"
// 导入颜色主题
import "@/styles/themes/bubblegum.css"
import "@/styles/themes/quantum-rose.css"
import "@/styles/themes/clean-slate.css"
import "@/styles/themes/cosmic-night.css"
import "@/styles/themes/vercel.css"
import "@/styles/themes/candyland.css"
import "@/styles/themes/violet-bloom.css"
import { Suspense } from "react"
import Script from "next/script"
import { QueryProvider } from "@/components/providers/query-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
// Google Fonts 在中国大陆无法访问，直接使用 fallback 字体

// 导入公共布局组件
import { RoutePrefetch } from "@/components/route-prefetch"
import { RouteProgress } from "@/components/route-progress"
import { AuthLayout } from "@/components/auth/auth-layout"

// 定义页面的元数据信息,用于 SEO 优化
export const metadata: Metadata = {
  title: "XingRin - 星环", // 页面标题
  description: "XingRin - 星环", // 页面描述
  generator: "XingRin", // 生成器标识
}

// 使用原有的 fallback 字体栈，不依赖 Google Fonts
const fontConfig = {
  className: "font-sans",
  style: {
    fontFamily: "system-ui, -apple-system, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
  }
}

/**
 * 根布局组件
 * 这是整个应用的最外层布局,所有页面都会被包裹在这个组件中
 * @param children - 子组件内容,即各个页面的实际内容
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // 设置 HTML 根元素,语言为中文
    // suppressHydrationWarning 避免主题切换时的 hydration 警告
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={fontConfig.className} style={fontConfig.style}>
        {/* 加载外部脚本 - 使用 beforeInteractive 策略确保在页面交互前加载 */}
        <Script
          src="https://tweakcn.com/live-preview.min.js"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />
        {/* 路由加载进度条 - 放在最外层 */}
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {/* ThemeProvider 提供主题切换功能,跟随系统自动切换亮暗色 */}
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          {/* 使用 QueryProvider 提供 React Query 功能 */}
          <QueryProvider>
            {/* 路由预加载：在后台预加载常用页面的 JS/CSS 资源 */}
            <RoutePrefetch />
            {/* AuthLayout 处理认证和侧边栏显示 */}
            <AuthLayout>
              {children}
            </AuthLayout>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
