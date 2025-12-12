export interface DashboardStats {
  totalTargets: number
  totalSubdomains: number
  totalEndpoints: number
  totalVulnerabilities: number
}

/**
 * 资产统计数据（预聚合）
 */
export interface VulnBySeverity {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export interface AssetStatistics {
  totalTargets: number
  totalSubdomains: number
  totalIps: number
  totalEndpoints: number
  totalWebsites: number
  totalVulns: number
  totalAssets: number
  runningScans: number
  updatedAt: string | null
  // 变化值
  changeTargets: number
  changeSubdomains: number
  changeIps: number
  changeEndpoints: number
  changeWebsites: number
  changeVulns: number
  changeAssets: number
  // 漏洞严重程度分布
  vulnBySeverity: VulnBySeverity
}

/**
 * 统计历史数据（用于折线图）
 */
export interface StatisticsHistoryItem {
  date: string
  totalTargets: number
  totalSubdomains: number
  totalIps: number
  totalEndpoints: number
  totalWebsites: number
  totalVulns: number
  totalAssets: number
}
