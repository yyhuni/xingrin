/**
 * 认证服务
 */
import { api } from '@/lib/api-client'
import type { 
  LoginRequest, 
  LoginResponse, 
  MeResponse, 
  LogoutResponse,
  ChangePasswordRequest,
  ChangePasswordResponse
} from '@/types/auth.types'

/**
 * 用户登录
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login/', data)
  return res.data
}

/**
 * 用户登出
 */
export async function logout(): Promise<LogoutResponse> {
  const res = await api.post<LogoutResponse>('/auth/logout/')
  return res.data
}

/**
 * 获取当前用户信息
 */
export async function getMe(): Promise<MeResponse> {
  const res = await api.get<MeResponse>('/auth/me/')
  return res.data
}

/**
 * 修改密码
 */
export async function changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  const res = await api.post<ChangePasswordResponse>('/auth/change-password/', data)
  return res.data
}
