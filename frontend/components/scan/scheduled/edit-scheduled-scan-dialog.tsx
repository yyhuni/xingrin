"use client"

import React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { IconX, IconLoader2 } from "@tabler/icons-react"
import { useUpdateScheduledScan } from "@/hooks/use-scheduled-scans"
import { useTargets } from "@/hooks/use-targets"
import { useEngines } from "@/hooks/use-engines"
import type { ScheduledScan, UpdateScheduledScanRequest } from "@/types/scheduled-scan.types"
import type { ScanEngine } from "@/types/engine.types"
import type { Target } from "@/types/target.types"

interface EditScheduledScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduledScan: ScheduledScan | null
  onSuccess?: () => void
}

// 常用 cron 表达式预设
const CRON_PRESETS = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每5分钟", value: "*/5 * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天凌晨2点", value: "0 2 * * *" },
  { label: "每天凌晨4点", value: "0 4 * * *" },
  { label: "每周一凌晨2点", value: "0 2 * * 1" },
  { label: "每月1号凌晨2点", value: "0 2 1 * *" },
]

export function EditScheduledScanDialog({
  open,
  onOpenChange,
  scheduledScan,
  onSuccess,
}: EditScheduledScanDialogProps) {
  const { mutate: updateScheduledScan, isPending } = useUpdateScheduledScan()
  const { data: targetsData } = useTargets()
  const { data: enginesData } = useEngines()

  // 表单状态
  const [name, setName] = React.useState("")
  const [engineId, setEngineId] = React.useState<number | null>(null)
  const [selectedTargetId, setSelectedTargetId] = React.useState<number | null>(null)
  const [cronExpression, setCronExpression] = React.useState("")

  // 当 scheduledScan 变化时，初始化表单
  React.useEffect(() => {
    if (scheduledScan && open) {
      setName(scheduledScan.name)
      setEngineId(scheduledScan.engine)
      setSelectedTargetId(scheduledScan.targetId || null)
      setCronExpression(scheduledScan.cronExpression || "0 2 * * *")
    }
  }, [scheduledScan, open])

  // 处理目标选择（单选）
  const handleTargetSelect = (targetId: number) => {
    setSelectedTargetId(selectedTargetId === targetId ? null : targetId)
  }

  // 验证 cron 表达式
  const validateCron = (cron: string): boolean => {
    const parts = cron.trim().split(/\s+/)
    return parts.length === 5
  }

  // 提交表单
  const handleSubmit = () => {
    if (!scheduledScan) return

    if (!name.trim()) {
      toast.error("请输入任务名称")
      return
    }
    if (!engineId) {
      toast.error("请选择扫描引擎")
      return
    }
    // 目标扫描模式才需要验证目标
    if (scheduledScan.scanMode === 'target' && !selectedTargetId) {
      toast.error("请选择一个扫描目标")
      return
    }
    if (!validateCron(cronExpression)) {
      toast.error("Cron 表达式格式错误，需要 5 个部分：分 时 日 月 周")
      return
    }

    const request: UpdateScheduledScanRequest = {
      name: name.trim(),
      engineId: engineId,
      cronExpression: cronExpression.trim(),
    }

    // 只有目标扫描模式才更新 targetId
    if (scheduledScan.scanMode === 'target' && selectedTargetId) {
      request.targetId = selectedTargetId
    }

    updateScheduledScan(
      { id: scheduledScan.id, data: request },
      {
        onSuccess: () => {
          onOpenChange(false)
          onSuccess?.()
        },
      }
    )
  }

  const targets: Target[] = targetsData?.targets || []
  const engines: ScanEngine[] = enginesData || []

  if (!scheduledScan) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑定时扫描</DialogTitle>
          <DialogDescription>
            修改定时扫描任务配置
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* 基本信息 */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">任务名称 *</Label>
              <Input
                id="edit-name"
                placeholder="例如：每日安全巡检"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

          </div>

          {/* 扫描引擎 */}
          <div className="grid gap-2">
            <Label>扫描引擎 *</Label>
            <Select
              value={engineId?.toString() || ""}
              onValueChange={(v) => setEngineId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择扫描引擎" />
              </SelectTrigger>
              <SelectContent>
                {engines.map((engine) => (
                  <SelectItem key={engine.id} value={engine.id.toString()}>
                    {engine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 扫描目标/组织 */}
          <div className="grid gap-2">
            <Label>扫描范围</Label>
            {scheduledScan.scanMode === 'organization' ? (
              // 组织扫描模式：显示组织信息，不可编辑
              <div className="border rounded-md p-3 bg-muted/50">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">组织扫描</Badge>
                  <span className="font-medium">{scheduledScan.organizationName}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  组织扫描模式下，执行时将动态获取该组织下所有目标
                </p>
              </div>
            ) : (
              // 目标扫描模式：可编辑目标（单选）
              <>
                <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto">
                  {targets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无可用目标</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {targets.map((target) => (
                        <Badge
                          key={target.id}
                          variant={selectedTargetId === target.id ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => handleTargetSelect(target.id)}
                        >
                          {target.name}
                          {selectedTargetId === target.id && (
                            <IconX className="h-3 w-3 ml-1" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTargetId && (
                  <p className="text-xs text-muted-foreground">
                    已选择: {targets.find(t => t.id === selectedTargetId)?.name}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Cron 表达式 */}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Cron 表达式 *</Label>
              <Input
                placeholder="分 时 日 月 周（如：0 2 * * *）"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                格式：分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0-6，0=周日)
              </p>
            </div>

            {/* 快捷预设 */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">快捷选择</Label>
              <div className="flex flex-wrap gap-2">
                {CRON_PRESETS.map((preset) => (
                  <Badge
                    key={preset.value}
                    variant={cronExpression === preset.value ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setCronExpression(preset.value)}
                  >
                    {preset.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <IconLoader2 className="h-4 w-4 animate-spin" />}
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
