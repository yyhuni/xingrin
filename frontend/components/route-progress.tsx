"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * 路由加载进度条组件
 * 
 * 监听 Next.js App Router 的路由变化，显示顶部进度条动画
 */
export function RouteProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const isFirstRender = useRef(true)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const startProgress = useCallback(() => {
    setIsVisible(true)
    setProgress(0)
    
    // 使用 interval 平滑递增
    let currentProgress = 0
    intervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 10 + 5 // 每次增加 5-15%
      if (currentProgress >= 90) {
        currentProgress = 90 // 最多到 90%，等待完成
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
      setProgress(currentProgress)
    }, 100)
  }, [])

  const completeProgress = useCallback(() => {
    // 清除进行中的 interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    setProgress(100)
    // 完成后短暂显示 100%，然后隐藏
    setTimeout(() => {
      setIsVisible(false)
      setProgress(0)
    }, 300)
  }, [])

  useEffect(() => {
    // 跳过首次渲染
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    // 路由变化时触发进度条
    startProgress()
    
    // 页面加载完成后结束进度条
    const timer = setTimeout(() => completeProgress(), 300)
    
    return () => {
      clearTimeout(timer)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [pathname, searchParams, startProgress, completeProgress])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[99999] h-[3px]",
        "pointer-events-none"
      )}
    >
      {/* 进度条背景 */}
      <div className="absolute inset-0 bg-primary/10" />
      
      {/* 进度条 */}
      <div
        className={cn(
          "h-full bg-primary transition-all duration-200 ease-out",
          "shadow-[0_0_10px_rgba(99,102,241,0.5)]"
        )}
        style={{ width: `${progress}%` }}
      />
      
      {/* 发光效果 */}
      <div
        className={cn(
          "absolute top-0 right-0 h-full w-24",
          "bg-gradient-to-r from-transparent to-primary/50",
          "opacity-50 blur-sm",
          "transition-all duration-200"
        )}
        style={{ 
          transform: `translateX(${progress < 100 ? '0' : '100%'})`,
          left: `${Math.max(0, progress - 10)}%`
        }}
      />
    </div>
  )
}
