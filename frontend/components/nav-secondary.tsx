"use client" // 标记为客户端组件，可以使用浏览器 API 和交互功能

// 导入 React 库
import * as React from "react"
// 导入图标类型
import { type Icon } from "@tabler/icons-react"

// 导入侧边栏相关组件
import {
  SidebarGroup,        // 侧边栏组
  SidebarGroupContent, // 侧边栏组内容
  SidebarMenu,         // 侧边栏菜单
  SidebarMenuButton,   // 侧边栏菜单按钮
  SidebarMenuItem,     // 侧边栏菜单项
} from '@/components/ui/sidebar'

/**
 * 次要导航组件
 * 显示次要的导航菜单项，通常用于设置、帮助等功能
 * 
 * @param {Object} props - 组件属性
 * @param {Array} props.items - 导航项数组
 * @param {string} props.items[].title - 导航项标题
 * @param {string} props.items[].url - 导航项链接
 * @param {Icon} props.items[].icon - 导航项图标
 * @param {...any} props - 其他传递给 SidebarGroup 的属性
 */
export function NavSecondary({
  items,
  ...props  // 其他属性传递给 SidebarGroup
}: {
  items: {
    title: string  // 导航项标题
    url: string    // 导航项URL
    icon: Icon     // 导航项图标
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>  {/* 传递所有其他属性 */}
      {/* 侧边栏组内容 */}
      <SidebarGroupContent>
        {/* 侧边栏菜单 */}
        <SidebarMenu>
          {/* 遍历次要导航项 */}
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {/* 导航菜单按钮，使用 asChild 渲染为链接 */}
              <SidebarMenuButton asChild>
                <a href={item.url}>              {/* 导航链接 */}
                  <item.icon />                   {/* 导航项图标 */}
                  <span>{item.title}</span>       {/* 导航项标题 */}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
