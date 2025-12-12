"use client"

import * as React from "react"
import { flushSync } from "react-dom"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

/**
 * 主题切换组件 - 滑动开关样式 + 圆形扩展动画
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isToggled, setIsToggled] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (mounted) {
      setIsToggled(resolvedTheme === "dark")
    }
  }, [resolvedTheme, mounted])

  const handleToggle = async () => {
    const newIsDark = !isToggled
    const newTheme = newIsDark ? "dark" : "light"

    // 不支持 View Transitions 或用户偏好减少动画，直接切换
    if (
      !buttonRef.current ||
      !('startViewTransition' in document) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsToggled(newIsDark)
      setTheme(newTheme)
      return
    }

    // 1. 先让滑块滑动（不触发主题切换）
    setIsToggled(newIsDark)

    // 2. 等待滑块动画完成（100ms）
    await new Promise(r => setTimeout(r, 100))

    // 获取按钮位置
    const { top, left, width, height } = buttonRef.current.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const right = window.innerWidth - left
    const bottom = window.innerHeight - top
    const maxRadius = Math.hypot(Math.max(left, right), Math.max(top, bottom))

    // 禁用默认的 View Transition 动画
    const style = document.createElement('style')
    style.textContent = `
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation: none;
        mix-blend-mode: normal;
      }
    `
    document.head.appendChild(style)

    // 3. 滑块滑完后，启动 View Transition 切换主题
    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        setTheme(newTheme)
      })
    })

    await transition.ready

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 500,
        easing: 'ease-out',
        pseudoElement: '::view-transition-new(root)',
      }
    )

    transition.finished.then(() => {
      style.remove()
    })
  }

  if (!mounted) {
    return (
      <div className="w-11 h-6 rounded-full bg-gray-200 dark:bg-primary" />
    )
  }

  return (
    <button
      ref={buttonRef}
      onClick={handleToggle}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isToggled ? "bg-primary" : "bg-gray-200"
      )}
      aria-label={isToggled ? "切换到亮色模式" : "切换到暗色模式"}
    >
      <div
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md flex items-center justify-center",
          "transition-all ease-in-out",
          isToggled ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-white"
        )}
        style={{ transitionDuration: "100ms" }}
      >
        <Sun 
          className={cn(
            "h-3 w-3 absolute transition-all duration-200 text-primary",
            isToggled ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
          )} 
        />
        <Moon 
          className={cn(
            "h-3 w-3 absolute transition-all duration-200 text-primary",
            isToggled ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
          )} 
        />
      </div>
    </button>
  )
}
