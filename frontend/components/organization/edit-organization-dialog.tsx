"use client"

import React, { useEffect } from "react"
import { Edit, Building2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

// 导入 UI 组件
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/loading-spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { useUpdateOrganization } from "@/hooks/use-organizations"

// 导入类型定义
import type { Organization } from "@/types/organization.types"

// 表单验证 Schema
const formSchema = z.object({
  name: z.string()
    .min(2, { message: "组织名称至少需要 2 个字符" })
    .max(50, { message: "组织名称不能超过 50 个字符" }),
  description: z.string().max(200, { message: "描述不能超过 200 个字符" }).optional(),
})

type FormValues = z.infer<typeof formSchema>

// 组件属性类型定义
interface EditOrganizationDialogProps {
  organization: Organization                    // 要编辑的组织数据
  open: boolean                                // 对话框开关状态
  onOpenChange: (open: boolean) => void        // 对话框状态变化回调
  onEdit: (organization: Organization) => void  // 编辑成功回调函数
}

/**
 * 编辑组织对话框组件
 * 提供编辑现有组织的表单界面
 * 
 * 功能特性：
 * 1. 预填充现有数据
 * 2. 表单验证
 * 3. 错误处理
 * 4. 加载状态
 * 5. 变更检测
 */
export function EditOrganizationDialog({ 
  organization, 
  open, 
  onOpenChange, 
  onEdit 
}: EditOrganizationDialogProps) {
  // 使用 React Query 的更新组织 mutation
  const updateOrganization = useUpdateOrganization()

  // 初始化表单
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: organization?.name || "",
      description: organization?.description || "",
    },
  })

  // 当组织数据变化时重置表单
  useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name || "",
        description: organization.description || "",
      })
    }
  }, [organization, form])

  // 检查表单是否有变更
  const hasChanges = form.formState.isDirty

  // 处理表单提交
  const onSubmit = (values: FormValues) => {
    updateOrganization.mutate(
      {
        id: Number(organization.id),
        data: {
          name: values.name.trim(),
          description: values.description?.trim() || "",
        }
      },
      {
        onSuccess: (updatedOrganization) => {
          // 调用成功回调
          onEdit(updatedOrganization)
          
          // 关闭对话框
          onOpenChange(false)
        }
      }
    )
  }

  // 处理对话框关闭
  const handleOpenChange = (newOpen: boolean) => {
    if (!updateOrganization.isPending) {
      onOpenChange(newOpen)
    }
  }

  // 重置表单到原始状态
  const handleReset = () => {
    form.reset({
      name: organization.name || "",
      description: organization.description || "",
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* 对话框内容 */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Building2 />
            <span>编辑组织</span>
          </DialogTitle>
          <DialogDescription>
            修改组织的基本信息。标有 * 的字段为必填项。
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
                        disabled={updateOrganization.isPending}
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
                        disabled={updateOrganization.isPending}
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

              {/* 变更提示 */}
              {hasChanges && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                  检测到变更，点击更新保存修改
                </div>
              )}
            </div>
            
            {/* 对话框底部按钮 */}
            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
                disabled={updateOrganization.isPending}
              >
                取消
              </Button>
              
              {hasChanges && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleReset}
                  disabled={updateOrganization.isPending}
                >
                  重置
                </Button>
              )}
              
              <Button 
                type="submit" 
                disabled={updateOrganization.isPending || !form.formState.isValid || !hasChanges}
              >
                {updateOrganization.isPending ? (
                  <>
                    <LoadingSpinner/>
                    更新中...
                  </>
                ) : (
                  <>
                    <Edit/>
                    更新组织
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
