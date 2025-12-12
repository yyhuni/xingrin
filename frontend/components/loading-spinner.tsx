"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * 统一的加载动画组件
 * 
 * 特性：
 * - 三种尺寸：sm(16px), md(24px), lg(32px)
 * - 支持自定义样式
 * - 使用 Tailwind CSS 动画
 */
export function LoadingSpinner({ size = "sm", className }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: "size-4",
    md: "size-6", 
    lg: "size-8"
  }

  return <Spinner className={cn(sizeMap[size], className)} />
}

interface LoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * 带文字的加载状态组件
 * 
 * 用于页面级别的加载状态显示
 */
export function LoadingState({ 
  message = "加载中...", 
  size = "md", 
  className 
}: LoadingStateProps) {
  const sizeMap = {
    sm: "size-4",
    md: "size-6", 
    lg: "size-8"
  }

  return (
    <div className={cn("flex items-center justify-center min-h-[200px] h-screen w-full", className)}>
      <div className="flex flex-col items-center space-y-4">
        <Spinner className={sizeMap[size]} />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}


interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: React.ReactNode
}

/**
 * 加载遮罩组件
 * 
 * 在现有内容上显示加载遮罩
 */
export function LoadingOverlay({ 
  isLoading, 
  message = "加载中...", 
  children 
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center space-y-2">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      )}
    </div>
  )
}
