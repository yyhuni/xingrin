"use client"

import React, { useState } from "react"
import { 
  Play, 
  ChevronDown, 
  ChevronUp, 
} from "lucide-react"

// 导入 UI 组件
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { LoadingSpinner } from "@/components/loading-spinner"
import { cn } from "@/lib/utils"
import { CAPABILITY_CONFIG, getEngineIcon, parseEngineCapabilities } from "@/lib/engine-config"

// 导入类型定义
import type { Organization } from "@/types/organization.types"
import type { ScanEngine } from "@/types/engine.types"

// 导入扫描服务和Toast
import { initiateScan } from "@/services/scan.service"
import { toast } from "sonner"

// 导入引擎 hooks
import { useEngines } from "@/hooks/use-engines"

// 组件属性类型定义
interface InitiateScanDialogProps {
  organization?: Organization | null  // 选中的组织（可选，用于显示信息）
  organizationId?: number             // 组织ID（用于发起扫描）
  targetId?: number                   // 目标ID（用于发起扫描，与organizationId二选一）
  targetName?: string                 // 目标名称（可选，如果提供则显示为目标扫描）
  open: boolean                       // 对话框开关状态
  onOpenChange: (open: boolean) => void  // 对话框开关回调
  onSuccess?: () => void              // 扫描发起成功的回调
}

/**
 * 发起扫描对话框组件
 * 
 * 功能特性：
 * 1. 选择扫描引擎
 * 2. 展示引擎详细信息
 * 3. 发起扫描操作
 */
export function InitiateScanDialog({
  organization,
  organizationId,
  targetId,
  targetName,
  open,
  onOpenChange,
  onSuccess,
}: InitiateScanDialogProps) {
  const [selectedEngineId, setSelectedEngineId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedEngineId, setExpandedEngineId] = useState<string | null>(null)

  // 从后端获取引擎列表
  const { data: engines, isLoading, error } = useEngines()

  // 切换展开/收起
  const toggleExpand = (engineId: string) => {
    setExpandedEngineId(
      expandedEngineId === engineId ? null : engineId
    )
  }

  // 处理发起扫描
  const handleInitiate = async () => {
    if (!selectedEngineId) return
    
    // 验证必须有 organizationId 或 targetId
    if (!organizationId && !targetId) {
      toast.error("参数错误", {
        description: "必须提供组织ID或目标ID",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 调用 API 发起扫描
      const response = await initiateScan({
        organizationId,
        targetId,
        engineId: Number(selectedEngineId),
      })
      
      // 显示成功消息
      toast.success("扫描已发起", {
        description: response.message || `成功创建 ${response.count} 个扫描任务`,
      })

      // 调用成功回调
      if (onSuccess) {
        onSuccess()
      }

      // 关闭对话框
      onOpenChange(false)
      
      // 重置选择
      setSelectedEngineId("")
    } catch (error) {
      console.error("Failed to initiate scan:", error)
      toast.error("发起扫描失败", {
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理对话框关闭
  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen)
      if (!newOpen) {
        // 关闭时重置所有状态
        setSelectedEngineId("")
        setExpandedEngineId(null)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            发起扫描
          </DialogTitle>
          <DialogDescription>
            {targetName ? (
              <>为目标 <span className="font-semibold text-foreground">{targetName}</span> 选择扫描引擎并开始安全扫描</>
            ) : (
              <>为组织 <span className="font-semibold text-foreground">{organization?.name}</span> 选择扫描引擎并开始安全扫描</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* 引擎列表容器 - 固定最大高度，预留滚动条空间 */}
          <div className="max-h-[500px] overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span className="ml-2 text-sm text-muted-foreground">
                  加载引擎中...
                </span>
              </div>
            ) : error ? (
              <div className="py-8 text-center">
                <p className="text-sm text-destructive mb-2">加载引擎失败</p>
                <p className="text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : '未知错误'}
                </p>
              </div>
            ) : !engines || engines.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无可用引擎
              </div>
            ) : (
              <RadioGroup
                value={selectedEngineId}
                onValueChange={(value) => {
                  setSelectedEngineId(value)
                  // 选中时自动展开该引擎详情
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
                      onOpenChange={() => toggleExpand(engine.id.toString())}
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
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

        {/* 底部按钮 */}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleInitiate}
            disabled={!selectedEngineId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner />
                发起扫描中...
              </>
            ) : (
              <>
                <Play />
                开始扫描
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
