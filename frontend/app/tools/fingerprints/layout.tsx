"use client"

import React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Fingerprint, HelpCircle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useFingerprintStats } from "@/hooks/use-fingerprints"

// 指纹库说明
const FINGERPRINT_HELP = `
• EHole: 红队重点资产识别工具，支持关键词、favicon hash 等方式识别
• Goby: 攻击面测绘工具，包含大量 Web 应用和设备指纹（即将支持）
• Wappalyzer: 浏览器扩展，可识别网站使用的技术栈（即将支持）
`.trim()

/**
 * 指纹管理布局
 * 提供 Tab 导航切换不同指纹库
 */
export default function FingerprintsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: stats, isLoading } = useFingerprintStats()

  // 获取当前激活的 Tab
  const getActiveTab = () => {
    if (pathname.includes("/ehole")) return "ehole"
    if (pathname.includes("/goby")) return "goby"
    if (pathname.includes("/wappalyzer")) return "wappalyzer"
    return "ehole"
  }

  // Tab 路径映射
  const basePath = "/tools/fingerprints"
  const tabPaths = {
    ehole: `${basePath}/ehole/`,
    goby: `${basePath}/goby/`,
    wappalyzer: `${basePath}/wappalyzer/`,
  }

  // 各指纹库数量
  const counts = {
    ehole: stats?.ehole || 0,
    goby: stats?.goby || 0,
    wappalyzer: stats?.wappalyzer || 0,
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between px-4 lg:px-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="px-4 lg:px-6">
          <Skeleton className="h-10 w-96" />
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
            <Fingerprint className="h-6 w-6" />
            指纹管理
          </h2>
          <p className="text-muted-foreground">Web 指纹识别规则管理</p>
        </div>
      </div>

      {/* Tabs 导航 */}
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Tabs value={getActiveTab()} className="w-full">
            <TabsList>
              <TabsTrigger value="ehole" asChild>
                <Link href={tabPaths.ehole} className="flex items-center gap-0.5">
                  EHole
                  {counts.ehole > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                      {counts.ehole}
                    </Badge>
                  )}
                </Link>
              </TabsTrigger>
              <TabsTrigger value="goby" asChild disabled>
                <Link href={tabPaths.goby} className="flex items-center gap-0.5 opacity-50 cursor-not-allowed">
                  Goby
                  {counts.goby > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                      {counts.goby}
                    </Badge>
                  )}
                </Link>
              </TabsTrigger>
              <TabsTrigger value="wappalyzer" asChild disabled>
                <Link href={tabPaths.wappalyzer} className="flex items-center gap-0.5 opacity-50 cursor-not-allowed">
                  Wappalyzer
                  {counts.wappalyzer > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                      {counts.wappalyzer}
                    </Badge>
                  )}
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm whitespace-pre-line">
                {FINGERPRINT_HELP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* 子页面内容 */}
      {children}
    </div>
  )
}
