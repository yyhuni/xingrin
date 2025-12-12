"use client"

import React, { useState, useEffect } from "react"
import { Wrench, AlertTriangle } from "lucide-react"
import { IconPlus } from "@tabler/icons-react"
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
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/loading-spinner"
import { IconX } from "@tabler/icons-react"
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
import { useCreateTool, useUpdateTool } from "@/hooks/use-tools"

// 导入类型定义
import type { Tool } from "@/types/tool.types"
import { CategoryNameMap } from "@/types/tool.types"

// 表单验证 Schema
const formSchema = z.object({
  name: z.string()
    .min(2, { message: "工具名称至少需要 2 个字符" })
    .max(255, { message: "工具名称不能超过 255 个字符" }),
  repoUrl: z.string().optional().or(z.literal("")),
  version: z.string().max(100).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
  categoryNames: z.array(z.string()),
  installCommand: z.string().min(1, { message: "安装命令不能为空" }),
  updateCommand: z.string().min(1, { message: "更新命令不能为空" }),
  versionCommand: z.string().min(1, { message: "版本查询命令不能为空" }),
})

type FormValues = z.infer<typeof formSchema>

// 组件属性类型定义
interface AddToolDialogProps {
  tool?: Tool                   // 要编辑的工具数据（可选，有值时为编辑模式）
  onAdd?: (tool: Tool) => void  // 添加成功回调函数（可选）
  open?: boolean                // 外部控制对话框开关状态
  onOpenChange?: (open: boolean) => void  // 外部控制对话框开关回调
}

/**
 * 根据工具名称和安装命令自动生成版本查询命令
 */
function generateVersionCommand(toolName: string, installCommand: string): string {
  if (!toolName) return ""

  const lowerName = toolName.toLowerCase().trim()
  const lowerInstall = installCommand.toLowerCase()

  // Python 工具
  if (lowerInstall.includes("python") || lowerInstall.includes(".py")) {
    return `python ${lowerName}.py -v`
  }

  // Go 工具
  if (lowerInstall.includes("go install") || lowerInstall.includes("go get")) {
    return `${lowerName} -version`
  }

  // 默认尝试常见的版本命令
  return `${lowerName} --version`
}

/**
 * 添加工具对话框组件（使用 React Query）
 * 
 * 功能特性：
 * 1. 自动管理提交状态
 * 2. 自动错误处理和成功提示
 * 3. 自动刷新相关数据
 * 4. 支持多分类标签选择
 * 5. 支持安装、更新、版本命令配置
 */
export function AddToolDialog({
  tool,
  onAdd,
  open: externalOpen,
  onOpenChange: externalOnOpenChange
}: AddToolDialogProps) {
  // 判断是编辑模式还是添加模式
  const isEditMode = !!tool

  // 对话框开关状态 - 支持外部控制
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  // 使用预定义的分类列表
  const availableCategories = Object.keys(CategoryNameMap)

  // 使用 React Query 的创建和更新工具 mutation
  const createTool = useCreateTool()
  const updateTool = useUpdateTool()

  // 初始化表单
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tool?.name || "",
      repoUrl: tool?.repoUrl || "",
      version: tool?.version || "",
      description: tool?.description || "",
      categoryNames: tool?.categoryNames || [],
      installCommand: tool?.installCommand || "",
      updateCommand: tool?.updateCommand || "",
      versionCommand: tool?.versionCommand || "",
    },
  })

  // 当 tool 变化时重置表单
  useEffect(() => {
    if (tool) {
      form.reset({
        name: tool.name || "",
        repoUrl: tool.repoUrl || "",
        version: tool.version || "",
        description: tool.description || "",
        categoryNames: tool.categoryNames || [],
        installCommand: tool.installCommand || "",
        updateCommand: tool.updateCommand || "",
        versionCommand: tool.versionCommand || "",
      })
    }
  }, [tool, form])

  // 监听表单值变化
  const watchName = form.watch("name")
  const watchInstallCommand = form.watch("installCommand")
  const watchVersionCommand = form.watch("versionCommand")
  const watchCategoryNames = form.watch("categoryNames")

  // 自动生成版本命令
  useEffect(() => {
    if (watchName && watchInstallCommand && !watchVersionCommand) {
      const generatedCmd = generateVersionCommand(watchName, watchInstallCommand)
      form.setValue("versionCommand", generatedCmd)
    }
  }, [watchName, watchInstallCommand, watchVersionCommand, form])

  // 处理表单提交
  const onSubmit = (values: FormValues) => {
    const toolData = {
      name: values.name.trim(),
      type: 'opensource' as const,
      repoUrl: values.repoUrl?.trim() || undefined,
      version: values.version?.trim() || undefined,
      description: values.description?.trim() || undefined,
      categoryNames: values.categoryNames.length > 0 ? values.categoryNames : undefined,
      installCommand: values.installCommand.trim(),
      updateCommand: values.updateCommand.trim(),
      versionCommand: values.versionCommand.trim(),
    }

    const onSuccessCallback = (response: { tool?: Tool }) => {
      // 重置表单
      form.reset()

      // 关闭对话框
      setOpen(false)

      // 调用外部回调
      if (onAdd && response?.tool) {
        onAdd(response.tool)
      }
    }

    // 根据模式选择创建或更新
    if (isEditMode && tool?.id) {
      updateTool.mutate(
        { id: tool.id, data: toolData },
        { onSuccess: onSuccessCallback }
      )
    } else {
      createTool.mutate(toolData, { onSuccess: onSuccessCallback })
    }
  }

  // 处理分类标签点击
  const handleCategoryToggle = (categoryName: string) => {
    const current = form.getValues("categoryNames")
    const isSelected = current.includes(categoryName)
    form.setValue(
      "categoryNames",
      isSelected
        ? current.filter(c => c !== categoryName)
        : [...current, categoryName]
    )
  }

  // 移除分类标签
  const handleCategoryRemove = (categoryName: string) => {
    const current = form.getValues("categoryNames")
    form.setValue("categoryNames", current.filter(c => c !== categoryName))
  }

  // 处理对话框关闭
  const handleOpenChange = (newOpen: boolean) => {
    if (!createTool.isPending && !updateTool.isPending) {
      setOpen(newOpen)
      if (!newOpen) {
        form.reset()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* 触发按钮 - 仅在非外部控制时显示 */}
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button>
            <IconPlus className="h-5 w-5" />
            添加工具
          </Button>
        </DialogTrigger>
      )}

      {/* 对话框内容 */}
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wrench />
            <span>{isEditMode ? "编辑工具" : "添加新工具"}</span>
          </DialogTitle>
          <DialogDescription>
            配置扫描工具的基本信息和执行命令。标有 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>

        {/* 表单 */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-6 py-4">
              {/* 基本信息部分 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">基本信息</h3>

                {/* 工具名称 */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>工具名称 <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如: Nuclei, Subfinder, HTTPX"
                          disabled={createTool.isPending || updateTool.isPending}
                          maxLength={255}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{field.value.length}/255 字符</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 仓库地址 */}
                <FormField
                  control={form.control}
                  name="repoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>仓库地址</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="https://github.com/projectdiscovery/nuclei"
                          disabled={createTool.isPending || updateTool.isPending}
                          maxLength={512}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 版本号 */}
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>当前版本</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="v3.0.0"
                          disabled={createTool.isPending || updateTool.isPending}
                          maxLength={100}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 工具描述 */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>工具描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="描述工具的功能、特点和使用场景..."
                          disabled={createTool.isPending || updateTool.isPending}
                          rows={3}
                          maxLength={1000}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>{(field.value || "").length}/1000 字符</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 分类标签 */}
                <div className="grid gap-2">
                  <FormLabel>分类标签</FormLabel>

                  {/* 已选择的标签 */}
                  {watchCategoryNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                      {watchCategoryNames.map((categoryName) => (
                        <Badge
                          key={categoryName}
                          variant="default"
                          className="flex items-center gap-1 px-2 py-1"
                        >
                          {CategoryNameMap[categoryName] || categoryName}
                          <button
                            type="button"
                            onClick={() => handleCategoryRemove(categoryName)}
                            disabled={createTool.isPending || updateTool.isPending}
                            className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* 可选择的标签 */}
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md">
                    {availableCategories.length > 0 ? (
                      availableCategories.map((categoryName) => {
                        const isSelected = watchCategoryNames.includes(categoryName)
                        return (
                          <Badge
                            key={categoryName}
                            variant={isSelected ? "secondary" : "outline"}
                            className="cursor-pointer hover:bg-secondary/80 transition-colors"
                            onClick={() => handleCategoryToggle(categoryName)}
                          >
                            {CategoryNameMap[categoryName] || categoryName}
                          </Badge>
                        )
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无可用分类</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 命令配置部分 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">命令配置</h3>

                {/* 安装命令 */}
                <FormField
                  control={form.control}
                  name="installCommand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>安装命令 <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="git clone https://github.com/user/tool&#10;或&#10;go install -v github.com/tool@latest"
                          disabled={createTool.isPending || updateTool.isPending}
                          rows={3}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="space-y-1">
                        <span className="block"><strong>示例：</strong></span>
                        <span className="block">• 使用 git: <code className="bg-muted px-1 py-0.5 rounded">git clone https://github.com/user/tool</code></span>
                        <span className="block">• 使用 go: <code className="bg-muted px-1 py-0.5 rounded">go install -v github.com/tool@latest</code></span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          注意：go get 已不再支持，请使用 go install
                        </span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 更新命令 */}
                <FormField
                  control={form.control}
                  name="updateCommand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>更新命令 <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="git pull&#10;或&#10;go install -v github.com/tool@latest"
                          disabled={createTool.isPending || updateTool.isPending}
                          rows={2}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="space-y-1">
                        <span className="block">• 使用 git clone 安装的工具，推荐使用 <code className="bg-muted px-1 py-0.5 rounded">git pull</code></span>
                        <span className="block">• 使用 go install 安装的工具，推荐使用相同的安装命令</span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 版本查询命令 */}
                <FormField
                  control={form.control}
                  name="versionCommand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        版本查询命令 <span className="text-destructive">*</span>
                        {field.value && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            已自动生成
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="toolname --version"
                          disabled={createTool.isPending || updateTool.isPending}
                          maxLength={500}
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="space-y-1">
                        <span className="block">系统会使用此命令检查工具版本并提示更新。常见格式：</span>
                        <span className="block">• <code className="bg-muted px-1 py-0.5 rounded">toolname -v</code></span>
                        <span className="block">• <code className="bg-muted px-1 py-0.5 rounded">toolname -V</code></span>
                        <span className="block">• <code className="bg-muted px-1 py-0.5 rounded">toolname --version</code></span>
                        <span className="block">• <code className="bg-muted px-1 py-0.5 rounded">python tool_name.py -v</code></span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 对话框底部按钮 */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createTool.isPending || updateTool.isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createTool.isPending || updateTool.isPending || !form.formState.isValid}
              >
                {(createTool.isPending || updateTool.isPending) ? (
                  <>
                    <LoadingSpinner />
                    {isEditMode ? "保存中..." : "创建中..."}
                  </>
                ) : (
                  <>
                    <IconPlus className="h-5 w-5" />
                    {isEditMode ? "保存修改" : "创建工具"}
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
