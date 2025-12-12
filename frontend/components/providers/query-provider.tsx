"use client"

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据立即过期，切换页面时重新请求
      staleTime: 0,
      // 缓存时间（5分钟）- 保留短期缓存用于快速返回
      gcTime: 5 * 60 * 1000,
      // 重试配置
      retry: (failureCount, error: unknown) => {
        // 4xx 错误不重试
        const err = error as { response?: { status?: number } }
        if (err?.response?.status && err.response.status >= 400 && err.response.status < 500) {
          return false
        }
        // 最多重试 3 次
        return failureCount < 3
      },
      // 重试延迟（指数退避）
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // 窗口重新获得焦点时自动刷新 - 用户切回来能看到最新数据
      refetchOnWindowFocus: true,
      // 网络重连时不自动刷新 - 避免网络波动导致的大量请求
      refetchOnReconnect: false,
    },
    mutations: {
      // 变更操作重试配置
      retry: (failureCount, error: unknown) => {
        // 4xx 错误不重试
        const err = error as { response?: { status?: number } }
        if (err?.response?.status && err.response.status >= 400 && err.response.status < 500) {
          return false
        }
        // 最多重试 2 次
        return failureCount < 2
      },
    },
  },
})

interface QueryProviderProps {
  children: React.ReactNode
}

/**
 * React Query Provider 组件
 * 
 * 功能：
 * 1. 提供全局的 QueryClient 实例
 * 2. 配置默认的查询和变更选项
 * 3. 开发环境下启用 DevTools
 */
export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 只在开发环境显示 DevTools */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  )
}
