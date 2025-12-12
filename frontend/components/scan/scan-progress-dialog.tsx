"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  IconCircleCheck,
  IconLoader,
  IconClock,
  IconCircleX,
  IconPlayerStop,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { ScanStage, ScanRecord, StageProgress, StageStatus } from "@/types/scan.types"

/** 阶段名称中文映射（支持驼峰和下划线两种格式） */
const STAGE_LABELS: Record<string, string> = {
  // 驼峰命名（后端返回格式）
  subdomainDiscovery: "子域名发现",
  portScan: "端口扫描",
  siteScan: "站点扫描",
  directoryScan: "目录扫描",
  urlFetch: "URL 抓取",
  vulnScan: "漏洞扫描",
  // 下划线命名（engine_config 格式）
  subdomain_discovery: "子域名发现",
  port_scan: "端口扫描",
  site_scan: "站点扫描",
  directory_scan: "目录扫描",
  url_fetch: "URL 抓取",
  vuln_scan: "漏洞扫描",
}

/** 获取阶段中文名称 */
function getStageName(stage: string): string {
  return STAGE_LABELS[stage] || stage
}

/**
 * 扫描阶段详情
 */
interface StageDetail {
  stage: ScanStage      // 阶段名称（来自 engine_config key）
  status: StageStatus
  duration?: string     // 耗时，如 "2m30s"
  detail?: string       // 额外信息，如 "发现 120 个子域名"
  resultCount?: number  // 结果数量
}

/**
 * 扫描进度数据
 */
export interface ScanProgressData {
  id: number
  targetName: string
  engineName: string
  status: string
  progress: number
  currentStage?: ScanStage
  startedAt?: string
  errorMessage?: string  // 错误信息（失败时有值）
  stages: StageDetail[]
}

interface ScanProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ScanProgressData | null
}

/** 扫描状态配置（与 scan-history 状态颜色一致） */
const SCAN_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  running: { label: "扫描中", className: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400" },
  cancelled: { label: "已取消", className: "bg-gray-500/15 text-gray-600 border-gray-500/30 dark:text-gray-400" },
  completed: { label: "已完成", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400" },
  failed: { label: "失败", className: "bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400" },
  initiated: { label: "等待中", className: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400" },
}

/**
 * 闪烁点动效（与 scan-history 一致）
 */
function PulsingDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-3 w-3", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-current" />
    </span>
  )
}

/**
 * 扫描状态图标（用于标题，与 scan-history 状态列动效一致）
 */
function ScanStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <PulsingDot className="text-blue-500" />
    case "completed":
      return <IconCircleCheck className="h-5 w-5 text-emerald-500" />
    case "cancelled":
      return <IconCircleX className="h-5 w-5 text-gray-500" />
    case "failed":
      return <IconCircleX className="h-5 w-5 text-red-500" />
    case "initiated":
      return <PulsingDot className="text-amber-500" />
    default:
      return <PulsingDot className="text-muted-foreground" />
  }
}

/**
 * 扫描状态徽章
 */
function ScanStatusBadge({ status }: { status: string }) {
  const config = SCAN_STATUS_CONFIG[status] || { label: status, className: "bg-muted text-muted-foreground" }
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

/**
 * 阶段状态图标
 */
function StageStatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "completed":
      return <IconCircleCheck className="h-5 w-5 text-emerald-500" />
    case "running":
      return <PulsingDot className="text-blue-500" />
    case "failed":
      return <IconCircleX className="h-5 w-5 text-destructive" />
    case "cancelled":
      return <IconCircleX className="h-5 w-5 text-orange-500" />
    default:
      return <IconClock className="h-5 w-5 text-muted-foreground" />
  }
}

/**
 * 单个阶段行
 */
function StageRow({ stage }: { stage: StageDetail }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 px-4 rounded-lg transition-colors",
        stage.status === "running" && "bg-blue-500/10 border border-blue-500/20",
        stage.status === "completed" && "bg-muted/50",
        stage.status === "failed" && "bg-destructive/10",
        stage.status === "cancelled" && "bg-orange-500/10",
      )}
    >
      <div className="flex items-center gap-3">
        <StageStatusIcon status={stage.status} />
        <div>
          <span className="font-medium">{getStageName(stage.stage)}</span>
          {stage.detail && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {stage.detail}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3 text-right">
        {/* 状态/耗时 */}
        {stage.status === "running" && (
          <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400">
            进行中
          </Badge>
        )}
        {stage.status === "completed" && stage.duration && (
          <span className="text-sm text-muted-foreground font-mono">
            {stage.duration}
          </span>
        )}
        {stage.status === "pending" && (
          <span className="text-sm text-muted-foreground">等待中</span>
        )}
        {stage.status === "failed" && (
          <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
            失败
          </Badge>
        )}
        {stage.status === "cancelled" && (
          <Badge variant="outline" className="bg-orange-500/20 text-orange-500 border-orange-500/30">
            已取消
          </Badge>
        )}
      </div>
    </div>
  )
}

/**
 * 扫描进度弹窗
 */
export function ScanProgressDialog({
  open,
  onOpenChange,
  data,
}: ScanProgressDialogProps) {
  if (!data) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanStatusIcon status={data.status} />
            扫描进度
          </DialogTitle>
        </DialogHeader>

        {/* 基本信息 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">目标</span>
            <span className="font-medium">{data.targetName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">引擎</span>
            <Badge variant="secondary">{data.engineName}</Badge>
          </div>
          {data.startedAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">开始时间</span>
              <span className="font-mono text-xs">{formatDateTime(data.startedAt)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">状态</span>
            <ScanStatusBadge status={data.status} />
          </div>
          {/* 错误信息（失败时显示） */}
          {data.errorMessage && (
            <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive font-medium">错误原因</p>
              <p className="text-sm text-destructive/80 mt-1 break-words">{data.errorMessage}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* 总进度 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">总进度</span>
            <span className="font-mono text-muted-foreground">{data.progress}%</span>
          </div>

          <div className="h-2 bg-primary/10 rounded-full overflow-hidden border border-border">
            <div 
              className={`h-full transition-all ${
                data.status === "completed" ? "bg-emerald-500/80" : 
                data.status === "failed" ? "bg-red-500/80" : 
                data.status === "running" ? "bg-blue-500/80 progress-striped" : 
                data.status === "cancelled" ? "bg-gray-500/80" :
                data.status === "cancelling" ? "bg-orange-500/80 progress-striped" :
                data.status === "initiated" ? "bg-amber-500/80 progress-striped" :
                "bg-muted-foreground/80"
              }`}
              style={{ width: `${data.status === "completed" ? 100 : data.progress}%` }}
            />
          </div>
        </div>

        <Separator />

        {/* 阶段列表 */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {data.stages.map((stage) => (
            <StageRow key={stage.stage} stage={stage} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 格式化时长（秒 -> 可读字符串）
 */
function formatDuration(seconds?: number): string | undefined {
  if (seconds === undefined || seconds === null) return undefined
  if (seconds < 1) return "<1s"
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
}

/**
 * 格式化日期时间（ISO 字符串 -> 可读格式）
 */
function formatDateTime(isoString?: string): string {
  if (!isoString) return ""
  try {
    const date = new Date(isoString)
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch {
    return isoString
  }
}

/** 从 summary 中获取阶段对应的结果数量 */
function getStageResultCount(stageName: string, summary: ScanRecord["summary"]): number | undefined {
  if (!summary) return undefined
  switch (stageName) {
    case "subdomain_discovery":
    case "subdomainDiscovery":
      return summary.subdomains
    case "site_scan":
    case "siteScan":
      return summary.websites
    case "directory_scan":
    case "directoryScan":
      return summary.directories
    case "url_fetch":
    case "urlFetch":
      return summary.endpoints
    case "vuln_scan":
    case "vulnScan":
      return summary.vulnerabilities?.total
    default:
      return undefined
  }
}

/**
 * 从 ScanRecord 构建 ScanProgressData
 * 
 * 阶段名称直接来自 engine_config 的 key，无需映射
 * 阶段顺序按 order 字段排序，与 Flow 执行顺序一致
 */
export function buildScanProgressData(scan: ScanRecord): ScanProgressData {
  const stages: StageDetail[] = []
  
  if (scan.stageProgress) {
    // 按 order 排序后遍历
    const sortedEntries = Object.entries(scan.stageProgress)
      .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    
    for (const [stageName, progress] of sortedEntries) {
      const resultCount = progress.status === "completed" 
        ? getStageResultCount(stageName, scan.summary)
        : undefined
      
      stages.push({
        stage: stageName,
        status: progress.status,
        duration: formatDuration(progress.duration),
        detail: progress.detail || progress.error || progress.reason,
        resultCount,
      })
    }
  }
  
  return {
    id: scan.id,
    targetName: scan.targetName,
    engineName: scan.engineName,
    status: scan.status,
    progress: scan.progress,
    currentStage: scan.currentStage,
    startedAt: scan.createdAt,
    errorMessage: scan.errorMessage,
    stages,
  }
}
