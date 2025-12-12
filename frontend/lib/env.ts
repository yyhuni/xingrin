/**
 * 环境变量与运行时配置工具
 */

const DEFAULT_DEV_BACKEND_URL = 'http://localhost:8888'

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * 获取后端基础地址（用于绕过 Next.js 代理，保证 SSE 等长连接可用）
 */
export function getBackendBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim()
  if (envUrl) {
    return stripTrailingSlash(envUrl)
  }

  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    // 本地开发时，默认后端运行在 8888 端口
    if (window.location.hostname === 'localhost' && window.location.port === '3000') {
      return stripTrailingSlash(DEFAULT_DEV_BACKEND_URL)
    }
    return stripTrailingSlash(origin)
  }

  return stripTrailingSlash(DEFAULT_DEV_BACKEND_URL)
}

/**
 * 拼接后端 API 地址（会自动处理多余斜杠）
 */
export function buildBackendUrl(path: string): string {
  const base = getBackendBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}
