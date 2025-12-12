import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "登录 - XingRin - 星环",
  description: "登录到 XingRin - 星环",
}

/**
 * 登录页面布局
 * 不包含侧边栏和头部
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
