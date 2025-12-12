import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化日期时间
 * @param date 日期字符串或 Date 对象
 * @returns 格式化后的日期时间字符串
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-"
  
  try {
    const d = typeof date === "string" ? new Date(date) : date
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d)
  } catch (error) {
    return "-"
  }
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-"
  if (bytes === 0) return "0 B"
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  const val = bytes / Math.pow(k, i)
  return `${parseFloat(val.toFixed(dm))} ${sizes[i]}`
}
