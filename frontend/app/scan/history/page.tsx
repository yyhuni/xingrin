"use client"

import { IconRadar } from "@tabler/icons-react"
import { ScanHistoryList } from "@/components/scan/history/scan-history-list"
import { ScanHistoryStatCards } from "@/components/scan/history/scan-history-stat-cards"

/**
 * 扫描历史页面
 * 显示所有扫描任务的历史记录
 */
export default function ScanHistoryPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 px-4 lg:px-6">
        <IconRadar className="size-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">扫描历史</h1>
          <p className="text-muted-foreground">查看和管理所有扫描任务记录</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="px-4 lg:px-6">
        <ScanHistoryStatCards />
      </div>

      {/* 扫描历史列表 */}
      <div className="px-4 lg:px-6">
        <ScanHistoryList />
      </div>
    </div>
  )
}
