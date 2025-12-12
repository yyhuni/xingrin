import {
  Globe,
  Network,
  Monitor,
  FolderSearch,
  Link,
  ShieldAlert,
  Shield,
  Camera,
  Search,
  Cpu,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/** 统一的能力标签颜色（使用全局 CSS 变量） */
const CAPABILITY_COLOR = "bg-primary/10 text-primary border-primary/20"

/**
 * 引擎能力配置（使用全局 CSS 颜色）
 * 用于发起扫描、快速扫描等引擎选择界面
 */
export const CAPABILITY_CONFIG: Record<string, { 
  label: string
  color: string
  icon: LucideIcon 
}> = {
  subdomain_discovery: { label: "子域名发现", color: CAPABILITY_COLOR, icon: Globe },
  port_scan: { label: "端口扫描", color: CAPABILITY_COLOR, icon: Network },
  site_scan: { label: "站点扫描", color: CAPABILITY_COLOR, icon: Monitor },
  directory_scan: { label: "目录扫描", color: CAPABILITY_COLOR, icon: FolderSearch },
  url_fetch: { label: "URL 抓取", color: CAPABILITY_COLOR, icon: Link },
  vuln_scan: { label: "漏洞扫描", color: CAPABILITY_COLOR, icon: ShieldAlert },
  waf_detection: { label: "WAF 检测", color: CAPABILITY_COLOR, icon: Shield },
  screenshot: { label: "截图", color: CAPABILITY_COLOR, icon: Camera },
  osint: { label: "OSINT", color: CAPABILITY_COLOR, icon: Search },
}

/**
 * 根据引擎能力获取主图标
 * 按优先级返回第一个匹配的能力图标
 */
export function getEngineIcon(capabilities: string[]): LucideIcon {
  const priorityOrder = [
    'vuln_scan', 
    'subdomain_discovery', 
    'port_scan', 
    'site_scan', 
    'directory_scan', 
    'url_fetch', 
    'waf_detection', 
    'screenshot', 
    'osint'
  ]
  
  for (const key of priorityOrder) {
    if (capabilities.includes(key)) {
      return CAPABILITY_CONFIG[key].icon
    }
  }
  return Cpu
}

/**
 * 解析引擎配置以获取能力列表
 */
export function parseEngineCapabilities(configuration: string): string[] {
  if (!configuration) return []
  
  try {
    const capabilities: string[] = []
    Object.keys(CAPABILITY_CONFIG).forEach((key) => {
      if (configuration.includes(key)) {
        capabilities.push(key)
      }
    })
    return capabilities
  } catch {
    return []
  }
}
