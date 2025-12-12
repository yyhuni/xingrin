"use client" // 标记为客户端组件，可以使用浏览器 API 和交互功能

import React from "react"
// 导入图标组件
import {
  IconDotsVertical,  // 垂直三点图标
  IconKey,           // 钥匙图标
  IconLogout,        // 登出图标
} from "@tabler/icons-react"

// 导入头像相关组件
import {
  Avatar,        // 头像容器
  AvatarFallback, // 头像备用显示
  AvatarImage,   // 头像图片
} from '@/components/ui/avatar'
// 导入下拉菜单相关组件
import {
  DropdownMenu,          // 下拉菜单容器
  DropdownMenuContent,   // 下拉菜单内容
  DropdownMenuItem,      // 下拉菜单项
  DropdownMenuLabel,     // 下拉菜单标签
  DropdownMenuSeparator, // 下拉菜单分隔线
  DropdownMenuTrigger,   // 下拉菜单触发器
} from '@/components/ui/dropdown-menu'
// 导入侧边栏相关组件
import {
  SidebarMenu,       // 侧边栏菜单
  SidebarMenuButton, // 侧边栏菜单按钮
  SidebarMenuItem,   // 侧边栏菜单项
  useSidebar,        // 侧边栏Hook
} from '@/components/ui/sidebar'
import { useAuth, useLogout } from '@/hooks/use-auth'
import { ChangePasswordDialog } from '@/components/auth/change-password-dialog'

/**
 * 用户导航组件
 * 显示用户信息和用户相关的操作菜单
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.user - 用户信息
 * @param {string} props.user.name - 用户名称
 * @param {string} props.user.email - 用户邮箱
 * @param {string} props.user.avatar - 用户头像URL
 */
export function NavUser({
  user,
}: {
  user: {
    name: string   // 用户名称
    email: string  // 用户邮箱
    avatar: string // 用户头像URL
  }
}) {
  const { isMobile } = useSidebar() // 获取移动端状态
  const { data: auth } = useAuth()
  const { mutate: logout, isPending: isLoggingOut } = useLogout()
  const [showChangePassword, setShowChangePassword] = React.useState(false)
  
  // 使用真实用户名（如果已登录）
  const displayName = auth?.user?.username || user.name

  return (
    <>
    <ChangePasswordDialog 
      open={showChangePassword} 
      onOpenChange={setShowChangePassword} 
    />
    <SidebarMenu>
      <SidebarMenuItem>
        {/* 用户下拉菜单 */}
        <DropdownMenu>
          {/* 下拉菜单触发器 */}
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"                                                    // 大尺寸
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" // 打开时的样式
            >
              {/* 用户头像 */}
              <Avatar className="h-8 w-8 rounded-lg grayscale">         {/* 8x8尺寸，圆角，灰度 */}
                <AvatarImage src={user.avatar} alt={user.name} />       {/* 用户头像图片 */}
                <AvatarFallback className="rounded-lg">CN</AvatarFallback> {/* 备用显示 */}
              </Avatar>
              {/* 用户信息区域 */}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>  {/* 用户名称 */}
                <span className="text-muted-foreground truncate text-xs">  {/* 用户邮箱 */}
                  {/* {user.email} */}
                </span>
              </div>
              {/* 三点菜单图标 */}
              <IconDotsVertical className="ml-auto size-4" />           {/* 自动左边距，4x4尺寸 */}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {/* 下拉菜单内容 */}
          <DropdownMenuContent
            className="rounded-lg"                                     // 圆角
            side={isMobile ? "bottom" : "right"}                        // 移动端下方，桌面端右侧
            align="end"                                                 // 端对齐
            sideOffset={4}                                             // 偏移4像素
          >
            {/* 用户信息标签 */}
            <DropdownMenuLabel className="p-0 font-normal">           {/* 无内边距，正常字体 */}
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                {/* 用户头像 */}
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />     {/* 用户头像图片 */}
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback> {/* 备用显示 */}
                </Avatar>
                {/* 用户信息 */}
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>  {/* 用户名称 */}
                  <span className="text-muted-foreground truncate text-xs">  {/* 用户邮箱 */}
                    {/* {user.email} */}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            {/* 分隔线 */}
            <DropdownMenuSeparator />
            {/* 修改密码 */}
            <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
              <IconKey />
              修改密码
            </DropdownMenuItem>
            {/* 登出选项 */}
            <DropdownMenuItem 
              onClick={() => logout()}
              disabled={isLoggingOut}
            >
              <IconLogout />
              {isLoggingOut ? '登出中...' : '退出登录'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
    </>
  )
}
