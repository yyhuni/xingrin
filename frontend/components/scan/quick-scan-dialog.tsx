"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { 
  Zap, Target, Settings, Check, ChevronRight, ChevronLeft, Loader2, ChevronDown, ChevronUp
} from "lucide-react"
import { getEngines } from "@/services/engine.service"
import { quickScan } from "@/services/scan.service"
import { CAPABILITY_CONFIG, getEngineIcon, parseEngineCapabilities } from "@/lib/engine-config"
import type { ScanEngine } from "@/types/engine.types"

// 步骤定义
const STEPS = [
  { id: 1, title: "输入目标", icon: Target },
  { id: 2, title: "选择引擎", icon: Settings },
  { id: 3, title: "确认", icon: Check },
] as const

interface QuickScanDialogProps {
  trigger?: React.ReactNode
}

export function QuickScanDialog({ trigger }: QuickScanDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  // 表单数据
  const [targetInput, setTargetInput] = React.useState("")
  const [selectedEngineId, setSelectedEngineId] = React.useState<string>("")
  const [expandedEngineId, setExpandedEngineId] = React.useState<string | null>(null)
  const [engines, setEngines] = React.useState<ScanEngine[]>([])
  
  // 行号列和输入框的 ref（用于同步滚动）
  const lineNumbersRef = React.useRef<HTMLDivElement | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  
  // 同步输入框和行号列的滚动
  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }
  
  // 解析目标列表（多行）
  const parseTargets = (input: string): string[] => {
    return input
      .split(/[\n,;]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0)
  }
  
  
  // 加载引擎列表
  React.useEffect(() => {
    if (open && step === 2 && engines.length === 0) {
      setIsLoading(true)
      getEngines()
        .then((data) => {
          setEngines(data)
        })
        .catch(() => {
          toast.error("获取引擎列表失败")
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [open, step, engines.length])
  
  // 重置表单
  const resetForm = () => {
    setStep(1)
    setTargetInput("")
    setSelectedEngineId("")
    setExpandedEngineId(null)
  }
  
  // 关闭弹框
  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      resetForm()
    }
  }
  
  // 验证单个目标
  const validateSingleTarget = (target: string): boolean => {
    if (!target.trim()) return false
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
    const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    return domainPattern.test(target) || ipPattern.test(target) || cidrPattern.test(target)
  }
  
  // 验证所有目标
  const validateTargets = (): { valid: boolean; targets: string[]; invalid: string[] } => {
    const targets = parseTargets(targetInput)
    if (targets.length === 0) {
      return { valid: false, targets: [], invalid: [] }
    }
    const invalid = targets.filter(t => !validateSingleTarget(t))
    return { valid: invalid.length === 0, targets, invalid }
  }
  
  // 下一步
  const handleNext = () => {
    if (step === 1) {
      const { valid, targets, invalid } = validateTargets()
      if (targets.length === 0) {
        toast.error("请输入至少一个目标")
        return
      }
      if (!valid) {
        toast.error(`以下目标格式无效：${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "..." : ""}`)
        return
      }
    }
    if (step === 2) {
      if (!selectedEngineId) {
        toast.error("请选择扫描引擎")
        return
      }
    }
    setStep(step + 1)
  }
  
  // 上一步
  const handlePrev = () => {
    setStep(step - 1)
  }
  
  // 提交扫描
  const handleSubmit = async () => {
    const targets = parseTargets(targetInput)
    if (targets.length === 0) return
    
    setIsSubmitting(true)
    try {
      // 调用快速扫描接口，一次性提交所有目标
      const response = await quickScan({
        targets: targets.map(name => ({ name })),
        engineId: Number(selectedEngineId),
      })
      
      const { targetStats, scans } = response
      
      if (scans.length > 0) {
        toast.success(response.message || `已创建 ${scans.length} 个扫描任务`, {
          description: targetStats.failed > 0 
            ? `${targetStats.created} 个目标成功，${targetStats.failed} 个失败`
            : undefined
        })
        handleClose(false)
      } else {
        toast.error("创建扫描任务失败", {
          description: targetStats.failed > 0 
            ? `${targetStats.failed} 个目标处理失败`
            : undefined
        })
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.response?.data?.error || "创建扫描任务失败")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // 获取选中的引擎
  const selectedEngine = engines.find(e => String(e.id) === selectedEngineId)
  const parsedTargets = parseTargets(targetInput)
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1.5 group">
            <Zap className="h-4 w-4 transition-transform group-hover:scale-125 group-hover:rotate-12" />
            快速扫描
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            快速扫描
          </DialogTitle>
        </DialogHeader>
        
        {/* 步骤指示器 */}
        <div className="flex items-center justify-between px-2 py-4">
          {STEPS.map((s, index) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    step === s.id && "border-primary bg-primary text-primary-foreground",
                    step > s.id && "border-primary bg-primary/10 text-primary",
                    step < s.id && "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {step > s.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <s.icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    step >= s.id ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 rounded-full transition-colors",
                    step > s.id ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        
        {/* 步骤内容 */}
        <div className="min-h-[200px] py-4">
          {/* 第一步：输入目标 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target">目标列表</Label>
                <div className="flex border rounded-md overflow-hidden h-[180px]">
                  {/* 行号列 - 固定宽度 */}
                  <div className="flex-shrink-0 w-10 border-r bg-muted/50">
                    <div 
                      ref={lineNumbersRef}
                      className="py-2 px-1.5 text-right font-mono text-xs text-muted-foreground leading-[1.4] h-full overflow-y-auto scrollbar-hide"
                    >
                      {Array.from({ length: Math.max(targetInput.split('\n').length, 8) }, (_, i) => (
                        <div key={i + 1} className="h-[20px]">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* 输入框区域 - 占据剩余空间 */}
                  <div className="flex-1 overflow-hidden">
                    <Textarea
                      ref={textareaRef}
                      id="target"
                      value={targetInput}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTargetInput(e.target.value)}
                      onScroll={handleTextareaScroll}
                      placeholder={`请输入目标，每行一个
支持域名、IP、CIDR
例如：
example.com
192.168.1.1
10.0.0.0/8`}
                      className="font-mono h-full overflow-y-auto resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 leading-[1.4] text-sm py-2"
                      style={{ lineHeight: '20px' }}
                      autoFocus
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {parsedTargets.length > 0 ? (
                    <span className="text-primary">{parsedTargets.length} 个目标</span>
                  ) : (
                    "0 个目标"
                  )}
                </p>
              </div>
            </div>
          )}
          
          {/* 第二步：选择引擎 */}
          {step === 2 && (
            <div className="space-y-2">
              <Label>扫描引擎</Label>
              <div className="max-h-[300px] overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : engines.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    暂无可用引擎
                  </div>
                ) : (
                  <RadioGroup
                    value={selectedEngineId}
                    onValueChange={(value: string) => {
                      setSelectedEngineId(value)
                      setExpandedEngineId(value)
                    }}
                    disabled={isSubmitting}
                    className="space-y-2"
                  >
                    {engines.map((engine) => {
                      const capabilities = parseEngineCapabilities(engine.configuration || '')
                      
                      return (
                        <Collapsible
                          key={engine.id}
                          open={expandedEngineId === engine.id.toString()}
                          onOpenChange={() => setExpandedEngineId(
                            expandedEngineId === engine.id.toString() ? null : engine.id.toString()
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-lg border transition-all",
                              selectedEngineId === engine.id.toString()
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
                            )}
                          >
                            {/* 引擎主信息 */}
                            <div className="flex items-center gap-3 p-4">
                              {/* Radio 按钮 */}
                              <RadioGroupItem
                                value={engine.id.toString()}
                                id={`engine-${engine.id}`}
                                className="mt-0.5"
                              />
                              
                              {/* 引擎图标 - 根据能力动态显示 */}
                              {(() => {
                                const primaryCap = capabilities[0]
                                const EngineIcon = getEngineIcon(capabilities)
                                const iconConfig = primaryCap ? CAPABILITY_CONFIG[primaryCap] : null
                                return (
                                  <div className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-lg",
                                    iconConfig?.color || "bg-muted text-muted-foreground"
                                  )}>
                                    <EngineIcon className="h-4 w-4" />
                                  </div>
                                )
                              })()}
                              
                              {/* 引擎名称 */}
                              <label
                                htmlFor={`engine-${engine.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{engine.name}</span>
                                </div>
                                {/* 能力数量预览 */}
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {capabilities.length > 0 
                                    ? `${capabilities.length} 项扫描能力` 
                                    : "点击展开查看详情"}
                                </p>
                              </label>
                              
                              {/* 展开按钮 */}
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  {expandedEngineId === engine.id.toString() ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            
                            {/* 可展开的详情内容 */}
                            <CollapsibleContent>
                              <div className="border-t px-4 py-3 space-y-3">
                                {/* 能力标签 */}
                                {capabilities.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {capabilities.map((capKey) => {
                                      const config = CAPABILITY_CONFIG[capKey]
                                      return (
                                        <Badge
                                          key={capKey}
                                          variant="outline"
                                          className={cn("text-xs font-normal", config?.color)}
                                        >
                                          {config?.label || capKey}
                                        </Badge>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    暂无能力信息
                                  </p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      )
                    })}
                  </RadioGroup>
                )}
              </div>
            </div>
          )}
          
          {/* 第三步：确认 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">目标</span>
                  <div className="mt-1 max-h-[100px] overflow-y-auto">
                    {parsedTargets.map((target, idx) => (
                      <div key={idx} className="font-mono text-sm">{target}</div>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">共 {parsedTargets.length} 个目标</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">引擎</span>
                  <Badge variant="secondary">{selectedEngine?.name}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                确认以上信息无误后，点击开始扫描
              </p>
            </div>
          )}
        </div>
        
        {/* 操作按钮 */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={step === 1}
            className={cn(step === 1 && "invisible")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            上一步
          </Button>
          
          {step < 3 ? (
            <Button onClick={handleNext}>
              下一步
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  开始扫描
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
