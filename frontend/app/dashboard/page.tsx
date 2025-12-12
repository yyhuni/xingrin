import { DashboardStatCards } from "@/components/dashboard/dashboard-stat-cards"
import { AssetTrendChart } from "@/components/dashboard/asset-trend-chart"
import { VulnSeverityChart } from "@/components/dashboard/vuln-severity-chart"
import { DashboardDataTable } from "@/components/dashboard/dashboard-data-table"

/**
 * 仪表板页面组件
 * 这是应用的主要仪表板页面,包含卡片、图表和数据表格
 * 布局结构已移至根布局组件中
 */
export default function Page() {
  return (
    // 内容区域,包含卡片、图表和数据表格
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* 顶部统计卡片 */}
      <DashboardStatCards />

      {/* 图表区域 - 趋势图 + 漏洞分布 */}
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
        {/* 资产趋势折线图 */}
        <AssetTrendChart />

        {/* 漏洞严重程度分布 */}
        <VulnSeverityChart />
      </div>

      {/* 漏洞 / 扫描历史 Tab */}
      <div className="px-4 lg:px-6">
        <DashboardDataTable />
      </div>
    </div>
  )
}
