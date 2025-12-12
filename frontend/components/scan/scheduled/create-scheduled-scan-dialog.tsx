"use client"

import React from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  IconX,
  IconLoader2,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconBuilding,
  IconTarget,
  IconClock,
  IconInfoCircle,
  IconSearch,
} from "@tabler/icons-react"
import { CronExpressionParser } from "cron-parser"
import cronstrue from "cronstrue/i18n"
import { useStep } from "@/hooks/use-step"
import { useCreateScheduledScan } from "@/hooks/use-scheduled-scans"
import { useTargets } from "@/hooks/use-targets"
import { useEngines } from "@/hooks/use-engines"
import { useOrganizations } from "@/hooks/use-organizations"
import type { CreateScheduledScanRequest } from "@/types/scheduled-scan.types"
import type { ScanEngine } from "@/types/engine.types"
import type { Target } from "@/types/target.types"
import type { Organization } from "@/types/organization.types"

interface CreateScheduledScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  // 预设值（从组织/目标页面点击定时扫描时传入）
  presetOrganizationId?: number
  presetOrganizationName?: string
  presetTargetId?: number
  presetTargetName?: string
}

// 常用 cron 表达式预设
const CRON_PRESETS = [
  { label: "每小时", value: "0 * * * *" },
  { label: "每天凌晨2点", value: "0 2 * * *" },
  { label: "每天凌晨4点", value: "0 4 * * *" },
  { label: "每周一凌晨2点", value: "0 2 * * 1" },
  { label: "每月1号凌晨2点", value: "0 2 1 * *" },
]

// 完整步骤配置（从定时扫描页面进入）
const FULL_STEPS = [
  { id: 1, title: "基本信息", icon: IconInfoCircle },
  { id: 2, title: "扫描模式", icon: IconBuilding },
  { id: 3, title: "选择目标", icon: IconTarget },
  { id: 4, title: "调度设置", icon: IconClock },
]

// 简化步骤配置（从组织/目标页面进入，已预设目标）
const PRESET_STEPS = [
  { id: 1, title: "基本信息", icon: IconInfoCircle },
  { id: 2, title: "调度设置", icon: IconClock },
]

// 选择模式
type SelectionMode = "organization" | "target"

export function CreateScheduledScanDialog({
  open,
  onOpenChange,
  onSuccess,
  presetOrganizationId,
  presetOrganizationName,
  presetTargetId,
  presetTargetName,
}: CreateScheduledScanDialogProps) {
  const { mutate: createScheduledScan, isPending } = useCreateScheduledScan()
  const { data: enginesData } = useEngines()

  // 服务端搜索状态
  const [orgSearchInput, setOrgSearchInput] = React.useState("")
  const [targetSearchInput, setTargetSearchInput] = React.useState("")
  const [orgSearch, setOrgSearch] = React.useState("")
  const [targetSearch, setTargetSearch] = React.useState("")

  // 搜索处理函数
  const handleOrgSearch = () => setOrgSearch(orgSearchInput)
  const handleTargetSearch = () => setTargetSearch(targetSearchInput)

  // 服务端搜索请求
  const { data: organizationsData, isFetching: isOrgFetching } = useOrganizations({ 
    pageSize: 50, 
    search: orgSearch || undefined 
  })
  const { data: targetsData, isFetching: isTargetFetching } = useTargets({ 
    pageSize: 50, 
    search: targetSearch || undefined 
  })

  // 判断是否有预设值（简化模式）
  const hasPreset = !!(presetOrganizationId || presetTargetId)
  const steps = hasPreset ? PRESET_STEPS : FULL_STEPS
  const totalSteps = steps.length

  // 步骤控制
  const [currentStep, { goToNextStep, goToPrevStep, reset: resetStep }] = useStep(totalSteps)

  // 表单状态
  const [name, setName] = React.useState("")
  const [engineId, setEngineId] = React.useState<number | null>(null)
  const [selectionMode, setSelectionMode] = React.useState<SelectionMode>("organization")
  const [selectedOrgId, setSelectedOrgId] = React.useState<number | null>(null)
  const [selectedTargetId, setSelectedTargetId] = React.useState<number | null>(null)
  const [cronExpression, setCronExpression] = React.useState("0 2 * * *")

  // 预设值处理：当打开对话框且有预设值时，自动填充
  React.useEffect(() => {
    if (open) {
      if (presetOrganizationId) {
        // 预设组织模式
        setSelectionMode("organization")
        setSelectedOrgId(presetOrganizationId)
        setName(presetOrganizationName ? `${presetOrganizationName} - 定时扫描` : "")
      } else if (presetTargetId) {
        // 预设目标模式
        setSelectionMode("target")
        setSelectedTargetId(presetTargetId)
        setName(presetTargetName ? `${presetTargetName} - 定时扫描` : "")
      }
    }
  }, [open, presetOrganizationId, presetOrganizationName, presetTargetId, presetTargetName])

  // 数据
  const targets: Target[] = targetsData?.targets || []
  const engines: ScanEngine[] = enginesData || []
  const organizations: Organization[] = organizationsData?.organizations || []

  // 重置表单
  const resetForm = () => {
    setName("")
    setEngineId(null)
    setSelectionMode("organization")
    setSelectedOrgId(null)
    setSelectedTargetId(null)
    setCronExpression("0 2 * * *")
    resetStep()
  }

  // 处理弹窗关闭
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm()
    }
    onOpenChange(isOpen)
  }

  // 处理组织选择（单选）
  const handleOrgSelect = (orgId: number) => {
    setSelectedOrgId(selectedOrgId === orgId ? null : orgId)
  }

  // 处理目标选择（单选）
  const handleTargetSelect = (targetId: number) => {
    setSelectedTargetId(selectedTargetId === targetId ? null : targetId)
  }

  // 验证当前步骤
  const validateCurrentStep = (): boolean => {
    // 简化模式（有预设值）：只有2步
    if (hasPreset) {
      switch (currentStep) {
        case 1: // 基本信息
          if (!name.trim()) {
            toast.error("请输入任务名称")
            return false
          }
          if (!engineId) {
            toast.error("请选择扫描引擎")
            return false
          }
          return true
        case 2: // 调度设置
          const parts = cronExpression.trim().split(/\s+/)
          if (parts.length !== 5) {
            toast.error("Cron 表达式格式错误，需要 5 个部分：分 时 日 月 周")
            return false
          }
          return true
        default:
          return true
      }
    }

    // 完整模式：4步
    switch (currentStep) {
      case 1:
        if (!name.trim()) {
          toast.error("请输入任务名称")
          return false
        }
        if (!engineId) {
          toast.error("请选择扫描引擎")
          return false
        }
        return true
      case 2:
        // 只选择模式，无需验证
        return true
      case 3:
        if (selectionMode === "organization") {
          if (!selectedOrgId) {
            toast.error("请选择一个组织")
            return false
          }
        } else {
          if (!selectedTargetId) {
            toast.error("请选择一个扫描目标")
            return false
          }
        }
        return true
      case 4:
        const cronParts = cronExpression.trim().split(/\s+/)
        if (cronParts.length !== 5) {
          toast.error("Cron 表达式格式错误，需要 5 个部分：分 时 日 月 周")
          return false
        }
        return true
      default:
        return true
    }
  }

  // 下一步
  const handleNext = () => {
    if (validateCurrentStep()) {
      goToNextStep()
    }
  }

  // 提交表单
  const handleSubmit = () => {
    if (!validateCurrentStep()) return

    // 根据扫描模式构建请求
    const request: CreateScheduledScanRequest = {
      name: name.trim(),
      engineId: engineId!,
      cronExpression: cronExpression.trim(),
    }

    if (selectionMode === "organization" && selectedOrgId) {
      // 组织扫描模式
      request.organizationId = selectedOrgId
    } else if (selectedTargetId) {
      // 目标扫描模式
      request.targetId = selectedTargetId
    }

    createScheduledScan(request, {
      onSuccess: () => {
        resetForm()
        onOpenChange(false)
        onSuccess?.()
      },
    })
  }

  // 获取 cron 描述（使用 cronstrue）
  const getCronDescription = (cron: string): string => {
    try {
      const parts = cron.trim().split(/\s+/)
      if (parts.length !== 5) return "无效的表达式"
      
      return cronstrue.toString(cron, { locale: "zh_CN" })
    } catch {
      return "无效的表达式"
    }
  }

  // 计算下次执行时间（使用 cron-parser v5）
  const getNextExecutions = (cron: string, count: number = 3): string[] => {
    try {
      const parts = cron.trim().split(/\s+/)
      if (parts.length !== 5) return []
      
      // cron-parser v5 API
      const interval = CronExpressionParser.parse(cron, {
        currentDate: new Date(),
        tz: "Asia/Shanghai",
      })
      
      const results: string[] = []
      for (let i = 0; i < count; i++) {
        const next = interval.next()
        const date = next.toDate()
        results.push(date.toLocaleString("zh-CN"))
      }
      
      return results
    } catch (e) {
      console.error("cron parse error:", e)
      return []
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>新建定时扫描</DialogTitle>
          <DialogDescription>
            配置定时扫描任务，设置执行计划
          </DialogDescription>
        </DialogHeader>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-between px-2 py-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    currentStep > step.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : currentStep === step.id
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <IconCheck className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    currentStep >= step.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2",
                    currentStep > step.id ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <Separator />

        {/* 步骤内容 */}
        <div className="flex-1 overflow-y-auto py-4 px-1">
          {/* 步骤 1: 基本信息 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">任务名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：每日安全巡检"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  为定时任务设置一个易于识别的名称
                </p>
              </div>

              <div className="space-y-2">
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
                <p className="text-xs text-muted-foreground">
                  选择要使用的扫描引擎配置
                </p>
              </div>
            </div>
          )}

          {/* 步骤 2: 扫描模式（完整模式）或 调度设置（简化模式） */}
          {currentStep === 2 && !hasPreset && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>选择扫描模式</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors",
                      selectionMode === "organization"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                    onClick={() => {
                      setSelectionMode("organization")
                      setSelectedTargetId(null)
                    }}
                  >
                    <IconBuilding className="h-8 w-8" />
                    <div className="text-center">
                      <p className="font-medium">组织扫描</p>
                      <p className="text-xs text-muted-foreground">
                        选择组织，执行时动态获取其下所有目标
                      </p>
                    </div>
                    {selectionMode === "organization" && (
                      <IconCheck className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  <div
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors",
                      selectionMode === "target"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                    onClick={() => {
                      setSelectionMode("target")
                      setSelectedOrgId(null)
                    }}
                  >
                    <IconTarget className="h-8 w-8" />
                    <div className="text-center">
                      <p className="font-medium">目标扫描</p>
                      <p className="text-xs text-muted-foreground">
                        选择固定的目标列表进行扫描
                      </p>
                    </div>
                    {selectionMode === "target" && (
                      <IconCheck className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {selectionMode === "organization" 
                  ? "组织扫描：每次执行时会动态获取组织下的所有目标，新增的目标也会被扫描"
                  : "目标扫描：扫描固定的目标列表，后续新增的目标不会被扫描"
                }
              </p>
            </div>
          )}

          {/* 步骤 3: 选择目标（仅完整模式，单选） */}
          {currentStep === 3 && !hasPreset && (
            <div className="space-y-4">
              {selectionMode === "organization" ? (
                // 组织扫描模式：选择单个组织
                <>
                  <Label>选择组织</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      placeholder="搜索组织名称..."
                      value={orgSearchInput}
                      onChange={(e) => setOrgSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleOrgSearch()}
                      className="h-9 flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-9 w-9"
                      onClick={handleOrgSearch}
                      disabled={isOrgFetching}
                    >
                      {isOrgFetching ? (
                        <IconLoader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <IconSearch className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Command className="border rounded-lg" shouldFilter={false}>
                    <CommandList className="max-h-[250px]">
                      {organizations.length === 0 ? (
                        <CommandEmpty>未找到组织</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {organizations.map((org) => (
                            <CommandItem
                              key={org.id}
                              value={org.id.toString()}
                              onSelect={() => handleOrgSelect(org.id)}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedOrgId === org.id}
                                  onCheckedChange={() => handleOrgSelect(org.id)}
                                />
                                <span>{org.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {org.targetCount || 0} 个目标
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>

                  {selectedOrgId && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        已选择组织，执行时将动态扫描该组织下所有目标
                      </p>
                      <Badge variant="secondary">
                        {organizations.find((o) => o.id === selectedOrgId)?.name}
                        <IconX
                          className="h-3 w-3 ml-1 cursor-pointer"
                          onClick={() => setSelectedOrgId(null)}
                        />
                      </Badge>
                    </div>
                  )}
                </>
              ) : (
                // 目标扫描模式：选择单个目标
                <>
                  <Label>选择扫描目标</Label>
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      placeholder="搜索目标名称..."
                      value={targetSearchInput}
                      onChange={(e) => setTargetSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleTargetSearch()}
                      className="h-9 flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-9 w-9"
                      onClick={handleTargetSearch}
                      disabled={isTargetFetching}
                    >
                      {isTargetFetching ? (
                        <IconLoader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <IconSearch className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Command className="border rounded-lg" shouldFilter={false}>
                    <CommandList className="max-h-[250px]">
                      {targets.length === 0 ? (
                        <CommandEmpty>未找到目标</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {targets.map((target) => (
                            <CommandItem
                              key={target.id}
                              value={target.id.toString()}
                              onSelect={() => handleTargetSelect(target.id)}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={selectedTargetId === target.id}
                                  onCheckedChange={() => handleTargetSelect(target.id)}
                                />
                                <span>{target.name}</span>
                              </div>
                              {target.organizations && target.organizations.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {target.organizations.map((o) => o.name).join(", ")}
                                </span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>

                  {selectedTargetId && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        已选择目标
                      </p>
                      <Badge variant="outline">
                        {targets.find((t) => t.id === selectedTargetId)?.name}
                        <IconX
                          className="h-3 w-3 ml-1 cursor-pointer"
                          onClick={() => setSelectedTargetId(null)}
                        />
                      </Badge>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 调度设置：完整模式步骤4 或 简化模式步骤2 */}
          {((currentStep === 4 && !hasPreset) || (currentStep === 2 && hasPreset)) && (
            <div className="space-y-6">
              <div className="space-y-2">
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

              <div className="space-y-2">
                <Label className="text-muted-foreground">快捷选择</Label>
                <div className="flex flex-wrap gap-2">
                  {CRON_PRESETS.map((preset) => (
                    <Badge
                      key={preset.value}
                      variant={
                        cronExpression === preset.value ? "default" : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() => setCronExpression(preset.value)}
                    >
                      {preset.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <IconClock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">执行预览</span>
                  {cronExpression.trim().split(/\s+/).length === 5 && (
                    <Badge variant="secondary" className="ml-auto">
                      <IconCheck className="h-3 w-3 mr-1" />
                      有效
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{getCronDescription(cronExpression)}</p>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">下次执行时间：</p>
                  {getNextExecutions(cronExpression).map((time, i) => (
                    <p key={i} className="text-sm">
                      • {time}
                      {i === 0 && (
                        <span className="text-muted-foreground ml-2">(即将执行)</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* 底部按钮 */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={goToPrevStep}
            disabled={currentStep === 1}
          >
            <IconChevronLeft className="h-4 w-4 mr-1" />
            上一步
          </Button>

          {currentStep < totalSteps ? (
            <Button onClick={handleNext}>
              下一步
              <IconChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <IconLoader2 className="h-4 w-4 mr-1 animate-spin" />}
              创建任务
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
