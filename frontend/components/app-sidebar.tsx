"use client" // 标记为客户端组件,可以使用浏览器 API 和交互功能

// 导入 React 库
import type * as React from "react"
// 导入 Tabler Icons 图标库中的各种图标
import {
  IconDashboard, // 仪表板图标
  IconHelp, // 帮助图标
  IconInnerShadowTop, // 内阴影图标
  IconListDetails, // 列表详情图标
  IconSettings, // 设置图标
  IconUsers, // 用户图标
  IconChevronRight, // 右箭头图标
  IconRadar, // 雷达扫描图标
  IconTool, // 工具图标
  IconFlask, // 实验瓶图标
  IconServer, // 服务器图标
  IconBug, // 漏洞图标
} from "@tabler/icons-react"
// 导入路径名 hook
import { usePathname } from "next/navigation"
// 导入 Link 组件
import Link from "next/link"

// 导入自定义导航组件
import { NavSystem } from "@/components/nav-system"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
// 导入侧边栏 UI 组件
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarRail,
} from "@/components/ui/sidebar"
// 导入折叠组件
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// 定义侧边栏的数据结构
const data = {
  // 用户信息
  user: {
    name: "admin",
    email: "admin@admin.com",
    avatar: "",
  },
  // 主导航菜单项
  navMain: [
    {
      title: "仪表盘", // 仪表板
      url: "/dashboard/",
      icon: IconDashboard,
    },
    {
      title: "组织", // 组织
      url: "/organization/",
      icon: IconUsers,
    },
    {
      title: "目标", // 目标
      url: "/target/",
      icon: IconListDetails,
    },
    {
      title: "漏洞", // 漏洞
      url: "/vulnerabilities/",
      icon: IconBug,
    },
    {
      title: "扫描", // 扫描
      url: "/scan/",
      icon: IconRadar,
      items: [
        {
          title: "扫描历史", // 扫描历史
          url: "/scan/history/",
        },
        {
          title: "定时扫描", // 定时扫描
          url: "/scan/scheduled/",
        },
        {
          title: "扫描引擎", // 扫描引擎
          url: "/scan/engine/",
        },
      ],
    },
    {
      title: "工具", // 工具
      url: "/tools/",
      icon: IconTool,
      items: [
        {
          title: "字典管理", // 字典管理
          url: "/tools/wordlists/",
        },
        {
          title: "Nuclei 模板", // Nuclei 模板
          url: "/tools/nuclei/",
        },
      ],
    },
    // 测试中心相关菜单已移除
  ],
  // 次要导航菜单项
  navSecondary: [
    {
      title: "Get Help", // 获取帮助
      url: "#",
      icon: IconHelp,
    },
  ],
  // 系统设置相关菜单项
  documents: [
    {
      name: "扫描节点",
      url: "/settings/workers/",
      icon: IconServer,
    },
    {
      name: "通知设置", // 通知设置
      url: "/settings/notifications/",
      icon: IconSettings,
    },
  ],
}

/**
 * 应用侧边栏组件
 * 显示应用的主要导航菜单,包括用户信息、主菜单、文档和次要菜单
 * 支持子菜单的展开和折叠功能
 * @param props - Sidebar 组件的所有属性
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const normalize = (p: string) => (p !== "/" && p.endsWith("/") ? p.slice(0, -1) : p)
  const current = normalize(pathname)

  return (
    // collapsible="icon" 表示侧边栏可以折叠为仅图标模式
    <Sidebar collapsible="icon" {...props}>
      {/* 侧边栏头部 */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* 
              侧边栏菜单按钮,作为链接使用
              data-[slot=sidebar-menu-button]:!p-1.5 设置内边距
            */}
            <SidebarMenuButton 
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                {/* 公司 Logo 图标 */}
                <IconInnerShadowTop className="!size-5" />
                {/* 公司名称 */}
                <span className="text-base font-semibold">XingRin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* 侧边栏主要内容区域 */}
      <SidebarContent>
        {/* 主导航菜单 */}
        <SidebarGroup>
          <SidebarGroupLabel>主要功能</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => {
                const navUrl = normalize(item.url)
                const isActive = navUrl === "/" ? current === "/" : current === navUrl || current.startsWith(navUrl + "/")
                const hasSubItems = item.items && item.items.length > 0

                if (!hasSubItems) {
                  // 无子菜单的普通菜单项
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                // 有子菜单的折叠菜单项
                return (
                  <Collapsible
                    key={item.title}
                    defaultOpen={isActive}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={isActive}>
                          <item.icon />
                          <span>{item.title}</span>
                          <IconChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={current === normalize(subItem.url)}
                              >
                                <Link href={subItem.url}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {/* 系统设置导航菜单 */}
        <NavSystem items={data.documents} />
        {/* 次要导航菜单,使用 mt-auto 推到底部 */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      {/* 侧边栏底部 */}
      <SidebarFooter>
        {/* 用户信息组件 */}
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
