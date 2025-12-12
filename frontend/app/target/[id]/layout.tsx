"use client"

import React from "react"
import { usePathname, useParams } from "next/navigation"
import Link from "next/link"
import { Target } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useTarget } from "@/hooks/use-targets"

/**
 * 目标详情布局
 * 为所有子页面提供共享的目标信息和导航
 */
export default function TargetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { id } = useParams<{ id: string }>()
  const pathname = usePathname()

  // 使用 React Query 获取目标数据
  const {
    data: target,
    isLoading,
    error
  } = useTarget(Number(id))

  // 获取当前激活的 Tab
  const getActiveTab = () => {
    if (pathname.includes("/subdomain")) return "subdomain"
    if (pathname.includes("/endpoints")) return "endpoints"
    if (pathname.includes("/websites")) return "websites"
    if (pathname.includes("/directories")) return "directories"
    if (pathname.includes("/vulnerabilities")) return "vulnerabilities"
    if (pathname.includes("/ip-addresses")) return "ip-addresses"
    return ""
  }

  // Tab 路径映射
  const basePath = `/target/${id}`
  const tabPaths = {
    subdomain: `${basePath}/subdomain/`,
    endpoints: `${basePath}/endpoints/`,
    websites: `${basePath}/websites/`,
    directories: `${basePath}/directories/`,
    vulnerabilities: `${basePath}/vulnerabilities/`,
    "ip-addresses": `${basePath}/ip-addresses/`,
  }

  // 从目标数据中获取各个tab的数量
  const counts = {
    subdomain: (target as any)?.summary?.subdomains || 0,
    endpoints: (target as any)?.summary?.endpoints || 0,
    websites: (target as any)?.summary?.websites || 0,
    directories: (target as any)?.summary?.directories || 0,
    vulnerabilities: (target as any)?.summary?.vulnerabilities?.total || 0,
    "ip-addresses": (target as any)?.summary?.ips || 0,
  }

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {/* 页面头部骨架 */}
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div className="w-full max-w-xl space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-7 w-48" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Tabs 导航骨架 */}
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Target className="mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">加载失败</h3>
            <p className="text-muted-foreground">
              {error.message || "获取目标数据时出现错误"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!target) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Target className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">目标不存在</h3>
            <p className="text-muted-foreground">
              未找到ID为 {id} 的目标
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target />
            {target.name}
          </h2>
          <p className="text-muted-foreground">{target.description || "暂无描述"}</p>
        </div>
      </div>

      {/* Tabs 导航 - 使用 Link 确保触发进度条 */}
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Tabs value={getActiveTab()} className="w-full">
          <TabsList>
            <TabsTrigger value="subdomain" asChild>
              <Link href={tabPaths.subdomain} className="flex items-center gap-0.5">
                Subdomains
                <Badge className="text-xs bg-chart-5 text-white border-0">
                  {counts.subdomain}
                </Badge>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="endpoints" asChild>
              <Link href={tabPaths.endpoints} className="flex items-center gap-0.5">
                URLs
                <Badge className="text-xs bg-chart-5 text-white border-0">
                  {counts.endpoints}
                </Badge>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="websites" asChild>
              <Link href={tabPaths.websites} className="flex items-center gap-0.5">
                Websites
                <Badge className="text-xs bg-chart-5 text-white border-0">
                  {counts.websites}
                </Badge>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="directories" asChild>
              <Link href={tabPaths.directories} className="flex items-center gap-0.5">
                Directories
                <Badge className="text-xs bg-chart-5 text-white border-0">
                  {counts.directories}
                </Badge>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="ip-addresses" asChild>
              <Link href={tabPaths["ip-addresses"]} className="flex items-center gap-0.5">
                IP Addresses
                <Badge className="text-xs bg-chart-5 text-white border-0">
                  {counts["ip-addresses"]}
                </Badge>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="vulnerabilities" asChild>
              <Link href={tabPaths.vulnerabilities} className="flex items-center gap-0.5">
                Vulnerabilities
                <Badge className="text-xs bg-chart-5 text-white border-0">
                  {counts.vulnerabilities}
                </Badge>
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 子页面内容 */}
      {children}
    </div>
  )
}
