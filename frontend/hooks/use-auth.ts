/**
 * 认证相关 hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { login, logout, getMe, changePassword } from '@/services/auth.service'
import { getErrorMessage } from '@/lib/api-client'
import type { LoginRequest, ChangePasswordRequest } from '@/types/auth.types'

/**
 * 获取当前用户信息
 */
export function useAuth() {
  const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true'
  
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: skipAuth 
      ? () => Promise.resolve({ authenticated: true } as Awaited<ReturnType<typeof getMe>>)
      : getMe,
    staleTime: 1000 * 60 * 5, // 5 分钟内不重新请求
    retry: false,
  })
}

/**
 * 用户登录
 */
export function useLogin() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: (data: LoginRequest) => login(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('登录成功')
      router.push('/dashboard/')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * 用户登出
 */
export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('已登出')
      router.push('/login/')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * 修改密码
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => changePassword(data),
    onSuccess: () => {
      toast.success('密码修改成功')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })
}
