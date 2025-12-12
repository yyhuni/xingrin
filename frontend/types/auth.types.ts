/**
 * 认证相关类型定义
 */

// 用户信息
export interface User {
  id: number
  username: string
  isStaff: boolean
  isSuperuser: boolean
}

// 登录请求
export interface LoginRequest {
  username: string
  password: string
}

// 登录响应
export interface LoginResponse {
  message: string
  user: User
}

// 获取当前用户响应
export interface MeResponse {
  authenticated: boolean
  user: User | null
}

// 登出响应
export interface LogoutResponse {
  message: string
}

// 修改密码请求
export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

// 修改密码响应
export interface ChangePasswordResponse {
  message: string
}
