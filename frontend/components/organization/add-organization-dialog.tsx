"use client"

import React, { useState, useRef, useMemo } from "react"
import { Plus, Building2, Target } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

// 导入 UI 组件
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LoadingSpinner } from "@/components/loading-spinner"
import { TargetValidator } from "@/lib/target-validator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

// 导入 React Query Hook
import { useCreateOrganization } from "@/hooks/use-organizations"
import { useBatchCreateTargets } from "@/hooks/use-targets"

// 导入类型定义
import type { Organization } from "@/types/organization.types"

// 表单验证 Schema
const formSchema = z.object({
  name: z.string()
    .min(2, { message: "组织名称至少需要 2 个字符" })
    .max(50, { message: "组织名称不能超过 50 个字符" }),
  description: z.string().max(200, { message: "描述不能超过 200 个字符" }).optional(),
  targets: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

// 组件属性类型定义
interface AddOrganizationDialogProps {
  onAdd?: (organization: Organization) => void  // 添加成功回调函数（可选）
  open?: boolean                               // 外部控制对话框开关状态
  onOpenChange?: (open: boolean) => void       // 外部控制对话框开关回调
}

/**
 * 添加组织对话框组件（使用 React Query）
 * 
 * 功能特性：
 * 1. 自动管理提交状态
 * 2. 自动错误处理和成功提示
 * 3. 自动刷新相关数据
 * 4. 更好的用户体验
 */
export function AddOrganizationDialog({ 
  onAdd, 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange 
}: AddOrganizationDialogProps) {
  // 对话框开关状态 - 支持外部控制
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  // 行号列和输入框的 ref（用于同步滚动）
  const lineNumbersRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // 使用 React Query 的创建组织和目标 mutation
  const createOrganization = useCreateOrganization()
  const batchCreateTargets = useBatchCreateTargets()
  
  // 初始化表单
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      targets: "",
    },
  })

  // 监听表单值变化
  const targetsText = form.watch("targets") || ""

  // 实时验证目标
  const targetValidation = useMemo(() => {
    const lines = targetsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (lines.length === 0) {
      return {
        count: 0,
        invalid: []
      }
    }

    const results = TargetValidator.validateTargetBatch(lines)
    const invalid = results
      .filter((r) => !r.isValid)
      .map((r) => ({ index: r.index, originalTarget: r.originalTarget, error: r.error || "目标格式无效", type: r.type }))
    
    return {
      count: lines.length,
      invalid
    }
  }, [targetsText])

  // 同步输入框和行号列的滚动
  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  // 处理表单提交
  const onSubmit = (values: FormValues) => {
    // 检查是否有无效目标
    if (targetValidation.invalid.length > 0) {
      return
    }

    // 先创建组织
    createOrganization.mutate(
      {
        name: values.name.trim(),
        description: values.description?.trim() || "",
      },
      {
        onSuccess: (newOrganization) => {
          // 如果有目标，则批量创建目标
          if (values.targets && values.targets.trim()) {
            const targetList = values.targets
              .split("\n")
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .map(name => ({
                name,
              }))

            if (targetList.length > 0) {
              // 批量创建目标并关联到新组织（后端会自动检测目标类型）
              batchCreateTargets.mutate(
                {
                  targets: targetList,
                  organizationId: newOrganization.id,
                },
                {
                  onSuccess: () => {
                    // 重置表单
                    form.reset()
                    
                    // 关闭对话框
                    setOpen(false)
                    
                    // 调用外部回调
                    if (onAdd) {
                      onAdd(newOrganization)
                    }
                  }
                }
              )
            } else {
              // 没有目标，直接完成
              form.reset()
              setOpen(false)
              if (onAdd) {
                onAdd(newOrganization)
              }
            }
          } else {
            // 没有目标，直接完成
            form.reset()
            setOpen(false)
            if (onAdd) {
              onAdd(newOrganization)
            }
          }
        }
      }
    )
  }

  // 处理对话框关闭
  const handleOpenChange = (newOpen: boolean) => {
    if (!createOrganization.isPending && !batchCreateTargets.isPending) {
      setOpen(newOpen)
      if (!newOpen) {
        // 关闭时重置表单
        form.reset()
      }
    }
  }

  // 表单验证
  const isFormValid = form.formState.isValid && targetValidation.invalid.length === 0
  const isSubmitting = createOrganization.isPending || batchCreateTargets.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* 触发按钮 - 仅在非外部控制时显示 */}
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus />
            添加组织
          </Button>
        </DialogTrigger>
      )}
      
      {/* 对话框内容 */}
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 />
            <span>添加新组织</span>
          </DialogTitle>
          <DialogDescription>
            填写组织信息以添加到系统中。可以同时添加目标。标有 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>
        
        {/* 表单 */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              {/* 组织名称输入框 */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      组织名称 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入组织名称"
                        disabled={isSubmitting}
                        maxLength={50}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {field.value.length}/50 字符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* 组织描述输入框 */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>组织描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入组织描述（可选）"
                        disabled={isSubmitting}
                        rows={3}
                        maxLength={200}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {(field.value || "").length}/200 字符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 目标输入框 - 支持多行，带行号 */}
              <FormField
                control={form.control}
                name="targets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-2">
                      <Target className="h-4 w-4" />
                      <span>添加目标（可选）</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative border rounded-md overflow-hidden bg-background">
                        <div className="flex h-[324px]">
                          {/* 行号列 - 固定显示15行 */}
                          <div className="flex-shrink-0 w-12 bg-muted/30 border-r select-none overflow-hidden">
                            <div 
                              ref={lineNumbersRef}
                              className="py-3 px-2 text-right font-mono text-xs text-muted-foreground leading-[1.4] h-full overflow-y-auto scrollbar-hide"
                            >
                              {Array.from({ length: Math.max(field.value?.split('\n').length || 1, 15) }, (_, i) => (
                                <div key={i + 1} className="h-[20px]">
                                  {i + 1}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* 输入框 - 固定高度显示15行 */}
                          <Textarea
                            {...field}
                            ref={(e) => {
                              field.ref(e)
                              textareaRef.current = e
                            }}
                            onScroll={handleTextareaScroll}
                            placeholder={`请输入目标，每行一个\n支持域名、IP、CIDR\n例如：\nexample.com\n192.168.1.1\n10.0.0.0/8`}
                            disabled={isSubmitting}
                            className="font-mono h-full overflow-y-auto resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 leading-[1.4] text-sm py-3"
                            style={{ lineHeight: '20px' }}
                          />
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      {targetValidation.count} 个目标
                      {targetValidation.invalid.length > 0 && (
                        <span className="text-destructive ml-2">
                          | {targetValidation.invalid.length} 个无效
                        </span>
                      )}
                    </FormDescription>
                    {targetValidation.invalid.length > 0 && (
                      <div className="text-xs text-destructive">
                        例如 第 {targetValidation.invalid[0].index + 1} 行: &quot;{targetValidation.invalid[0].originalTarget}&quot; - {targetValidation.invalid[0].error}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* 对话框底部按钮 */}
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
                type="submit" 
                disabled={isSubmitting || !isFormValid}
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner/>
                    {createOrganization.isPending ? "创建组织中..." : "批量创建目标中..."}
                  </>
                ) : (
                  <>
                    <Plus />
                    创建组织
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
