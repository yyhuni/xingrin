/**
 * 统一的错误处理工具
 * 
 * 根据项目规则24：
 * - 成功提示：前端自己构造
 * - 错误提示：前端自己构造，提供更具体的错误原因
 * - 控制台日志：打印完整的后端响应体
 */

import { toast } from "sonner"

/**
 * API 错误信息接口
 */
export interface ApiError {
  response?: {
    data?: unknown
  }
  message?: string
}

/**
 * 处理 mutation 错误（通用）
 * @param error 错误对象
 * @param userMessage 前端自定义的用户友好错误消息
 * @param toastId 可选的 toast ID（用于关闭加载提示）
 */
export function handleMutationError(
  error: unknown,
  userMessage: string,
  toastId?: string
) {
  // 关闭加载提示（如果有）
  if (toastId) {
    toast.dismiss(toastId)
  }

  // 控制台打印详细错误信息
    console.error('操作失败:', error)
    console.error('后端响应:', (error as ApiError)?.response?.data || error)

  // 显示前端自定义的用户友好错误消息
  toast.error(userMessage)
}

/**
 * 处理 query 错误（通用）
 * @param error 错误对象
 * @param userMessage 前端自定义的用户友好错误消息
 */
export function handleQueryError(error: unknown, userMessage: string) {
  // 控制台打印详细错误信息
    console.error('查询失败:', error)
    console.error('后端响应:', (error as ApiError)?.response?.data || error)

  // 显示前端自定义的用户友好错误消息
  toast.error(userMessage)
}

/**
 * 处理成功响应（通用）
 * @param response 后端响应
 * @param successMessage 前端自定义的成功消息
 * @param toastId 可选的 toast ID（用于关闭加载提示）
 */
export function handleSuccess(
  response: unknown,
  successMessage: string,
  toastId?: string
) {
  // 关闭加载提示（如果有）
  if (toastId) {
    toast.dismiss(toastId)
  }

  // 控制台打印成功信息
    console.log('操作成功')
    console.log('后端响应:', response)

  // 显示前端自定义的成功消息
  toast.success(successMessage)
}

/**
 * 处理警告响应（部分成功场景）
 * @param response 后端响应
 * @param warningMessage 前端自定义的警告消息
 * @param toastId 可选的 toast ID（用于关闭加载提示）
 */
export function handleWarning(
  response: unknown,
  warningMessage: string,
  toastId?: string
) {
  // 关闭加载提示（如果有）
  if (toastId) {
    toast.dismiss(toastId)
  }

  // 控制台打印信息（仅在开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.log('操作部分成功')
    console.log('后端响应:', response)
  }

  // 显示前端自定义的警告消息
  toast.warning(warningMessage)
}

/**
 * 检查响应是否成功
 * @param response API 响应
 * @returns 是否成功
 */
export function isSuccessResponse(response: unknown): boolean {
  return (response as { state?: string })?.state === 'success'
}

/**
 * 从响应中提取数据
 * @param response API 响应
 * @param defaultValue 默认值
 * @returns 响应数据
 */
export function extractData<T>(response: unknown, defaultValue: T): T {
  if (isSuccessResponse(response) && (response as { data?: T }).data) {
    return (response as { data: T }).data
  }
  return defaultValue
}
