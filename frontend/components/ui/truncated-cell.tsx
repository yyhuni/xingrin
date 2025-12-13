"use client"

import React from "react"
import { MoreHorizontal } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CopyablePopoverContent } from "@/components/ui/copyable-popover-content"
import { cn } from "@/lib/utils"

/**
 * 预设的截断长度配置
 */
export const TRUNCATE_LENGTHS = {
  url: 35,
  title: 25,
  location: 20,
  webServer: 20,
  contentType: 20,
  bodyPreview: 25,
  subdomain: 35,
  ip: 35,
  host: 30,
  default: 30,
} as const

export type TruncateLengthKey = keyof typeof TRUNCATE_LENGTHS

interface TruncatedCellProps {
  /** 要显示的值 */
  value: string | null | undefined
  /** 最大显示长度，可以是数字或预设的 key */
  maxLength?: number | TruncateLengthKey
  /** 额外的 CSS 类名 */
  className?: string
  /** 是否使用等宽字体 */
  mono?: boolean
  /** 空值时显示的占位符 */
  placeholder?: string
  /** Popover 内容的额外类名 */
  popoverClassName?: string
  /** 容器的固定宽度 */
  width?: string
}

/**
 * 统一的截断单元格组件
 * 
 * 功能：
 * - 超过最大长度时自动截断并显示省略号
 * - 截断时显示展开图标，点击可查看完整内容
 * - 支持复制完整内容
 * 
 * @example
 * // 使用预设长度
 * <TruncatedCell value={url} maxLength="url" mono />
 * 
 * // 使用自定义长度
 * <TruncatedCell value={title} maxLength={30} />
 */
export function TruncatedCell({
  value,
  maxLength = "default",
  className,
  mono = false,
  placeholder = "-",
  popoverClassName,
  width,
}: TruncatedCellProps) {
  // 空值处理
  if (!value) {
    return <span className="text-muted-foreground text-sm">{placeholder}</span>
  }

  // 获取实际的最大长度
  const actualMaxLength = typeof maxLength === "number" 
    ? maxLength 
    : TRUNCATE_LENGTHS[maxLength]

  const isLong = value.length > actualMaxLength
  const displayText = isLong 
    ? value.substring(0, actualMaxLength) + "..." 
    : value

  const textClassName = cn(
    "text-sm",
    mono && "font-mono",
    className
  )

  // 不需要截断时直接返回
  if (!isLong) {
    return <span className={textClassName}>{value}</span>
  }

  // 需要截断时显示带 Popover 的版本
  return (
    <div className={cn("flex items-center gap-1", width && `w-[${width}] min-w-[${width}]`)}>
      <span className={cn(textClassName, "truncate")}>
        {displayText}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-3">
          <CopyablePopoverContent 
            value={value} 
            className={cn(mono && "font-mono text-xs", popoverClassName)} 
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/**
 * URL 专用的截断单元格
 * 预设了等宽字体和固定宽度
 */
export function TruncatedUrlCell({
  value,
  maxLength = "url",
  className,
  ...props
}: Omit<TruncatedCellProps, "mono">) {
  if (!value) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  const actualMaxLength = typeof maxLength === "number" 
    ? maxLength 
    : TRUNCATE_LENGTHS[maxLength]

  const isLong = value.length > actualMaxLength
  const displayText = isLong 
    ? value.substring(0, actualMaxLength) + "..." 
    : value

  return (
    <div className="flex items-center gap-1 w-[280px] min-w-[280px]">
      <span className={cn("text-sm font-mono truncate", className)}>
        {displayText}
      </span>
      {isLong && (
        <Popover>
          <PopoverTrigger asChild>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground flex-shrink-0 transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-3">
            <CopyablePopoverContent value={value} className="font-mono text-xs" />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
