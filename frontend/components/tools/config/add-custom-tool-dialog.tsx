"use client"

import React, { useState } from "react"
import { Wrench } from "lucide-react"
import { IconPlus } from "@tabler/icons-react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/loading-spinner"
import { IconX } from "@tabler/icons-react"
import { CategoryNameMap, type Tool } from "@/types/tool.types"
import { useCreateTool, useUpdateTool } from "@/hooks/use-tools"

// 组件属性类型定义
interface AddCustomToolDialogProps {
  tool?: Tool                    // 要编辑的工具数据（可选，有值时为编辑模式）
  onAdd?: (tool: Tool) => void   // 添加成功回调函数（可选）
  open?: boolean                 // 外部控制对话框开关状态
  onOpenChange?: (open: boolean) => void  // 外部控制对话框开关回调
}

/**
 * 添加/编辑自定义工具对话框组件
 */
export function AddCustomToolDialog({ 
  tool,
  onAdd, 
  open: externalOpen, 
  onOpenChange: externalOnOpenChange 
}: AddCustomToolDialogProps) {
  // 判断是编辑模式还是添加模式
  const isEditMode = !!tool
  
  // 对话框开关状态 - 支持外部控制
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen
  
  // 表单数据状态 - 如果是编辑模式，使用工具数据初始化
  const [formData, setFormData] = useState({
    name: tool?.name || "",
    description: tool?.description || "",
    directory: tool?.directory || "",
    categoryNames: tool?.categoryNames || [] as string[],
  })

  // 使用预定义的分类列表
  const availableCategories = Object.keys(CategoryNameMap)

  // 使用 React Query 的创建和更新工具 mutation
  const createTool = useCreateTool()
  const updateTool = useUpdateTool()

  // 当 tool 变化时更新表单数据
  React.useEffect(() => {
    if (tool) {
      setFormData({
        name: tool.name || "",
        description: tool.description || "",
        directory: tool.directory || "",
        categoryNames: tool.categoryNames || [],
      })
    }
  }, [tool])

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 表单验证
    if (!formData.name.trim() || !formData.directory.trim()) {
      return
    }

    const toolData = {
      name: formData.name.trim(),
      type: 'custom' as const, // 自定义工具
      description: formData.description.trim() || undefined,
      directory: formData.directory.trim(),
      categoryNames: formData.categoryNames.length > 0 ? formData.categoryNames : undefined,
    }

    const onSuccessCallback = (response: { tool?: Tool }) => {
      // 重置表单
      setFormData({
        name: "",
        description: "",
        directory: "",
        categoryNames: [],
      })
      
      // 关闭对话框
      setOpen(false)
      
      // 调用外部回调（如果提供）
      if (onAdd && response?.tool) {
        onAdd(response.tool)
      }
    }

    // 根据模式选择创建或更新
    if (isEditMode && tool?.id) {
      // 编辑模式：调用更新 API
      updateTool.mutate(
        { id: tool.id, data: toolData },
        { onSuccess: onSuccessCallback }
      )
    } else {
      // 创建模式：调用创建 API
      createTool.mutate(toolData, { onSuccess: onSuccessCallback })
    }
  }

  // 处理对话框关闭 - 重置表单
  const handleOpenChange = (newOpen: boolean) => {
    // 正在提交时不允许关闭
    if (!createTool.isPending && !updateTool.isPending) {
      setOpen(newOpen)
      if (!newOpen) {
        // 对话框关闭时重置表单
        setFormData({
          name: "",
          description: "",
          directory: "",
          categoryNames: [],
        })
      }
    }
  }

  // 处理分类标签点击切换
  const handleCategoryToggle = (categoryName: string) => {
    setFormData((prev) => {
      const isSelected = prev.categoryNames.includes(categoryName)
      return {
        ...prev,
        categoryNames: isSelected
          ? prev.categoryNames.filter(c => c !== categoryName)
          : [...prev.categoryNames, categoryName]
      }
    })
  }

  // 移除分类标签
  const handleCategoryRemove = (categoryName: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryNames: prev.categoryNames.filter(c => c !== categoryName)
    }))
  }

  // 表单验证 - 检查必填字段
  const isFormValid = 
    formData.name.trim().length > 0 &&
    formData.directory.trim().length > 0

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wrench />
            <span>{isEditMode ? "编辑自定义工具" : "添加自定义工具"}</span>
          </DialogTitle>
          <DialogDescription>
            配置自定义扫描工具的基本信息。标有 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>
        
        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            {/* 工具名称 */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                工具名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="例如：自定义端口扫描"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={createTool.isPending || updateTool.isPending}
                required
              />
            </div>

            {/* 工具描述 */}
            <div className="grid gap-2">
              <Label htmlFor="description">工具描述</Label>
              <Textarea
                id="description"
                placeholder="描述工具的功能和用途..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={createTool.isPending || updateTool.isPending}
                rows={3}
              />
            </div>

            {/* 工具路径 */}
            <div className="grid gap-2">
              <Label htmlFor="directory">
                工具路径 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="directory"
                placeholder="例如：/opt/security-tools/port-scanner"
                value={formData.directory}
                onChange={(e) => setFormData({ ...formData, directory: e.target.value })}
                disabled={createTool.isPending || updateTool.isPending}
                required
              />
              <p className="text-xs text-muted-foreground">
                脚本或工具所在的目录路径
              </p>
            </div>

            {/* 分类标签 */}
            <div className="grid gap-2">
              <Label>分类标签</Label>
              
              {/* 已选择的标签 */}
              {formData.categoryNames.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                  {formData.categoryNames.map((categoryName) => (
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
                    const isSelected = formData.categoryNames.includes(categoryName)
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
              disabled={createTool.isPending || updateTool.isPending || !isFormValid}
            >
              {(createTool.isPending || updateTool.isPending) ? (
                <>
                  <LoadingSpinner/>
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
      </DialogContent>
    </Dialog>
  )
}
