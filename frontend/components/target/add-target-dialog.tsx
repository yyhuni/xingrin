"use client"

import React, { useState, useRef } from "react"
import { Plus, Target as TargetIcon, Building2, Loader2, Check, ChevronsUpDown } from "lucide-react"
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/loading-spinner"
import { TargetValidator } from "@/lib/target-validator"

// 导入 React Query Hooks
import { useOrganizations } from "@/hooks/use-organizations"
import { useBatchCreateTargets } from "@/hooks/use-targets"
import { toast } from "sonner"
import type { BatchCreateTargetsRequest } from "@/types/target.types"

// 组件属性类型定义
interface AddTargetDialogProps {
  onAdd?: () => void                                             // 添加成功回调
  open?: boolean                                                 // 外部控制对话框开关状态
  onOpenChange?: (open: boolean) => void                         // 外部控制对话框开关回调
  prefetchEnabled?: boolean                                      // 是否提前预取组织列表
}

/**
 * 添加目标对话框组件（支持选择组织）
 * 
 * 功能特性：
 * 1. 批量输入目标
 * 2. 可选择所属组织
 * 3. 自动创建不存在的目标
 * 4. 自动管理提交状态
 * 5. 自动错误处理和成功提示
 */
export function AddTargetDialog({ 
  onAdd,
  open: externalOpen, 
  onOpenChange: externalOnOpenChange,
  prefetchEnabled,
}: AddTargetDialogProps) {
  // 对话框开关状态 - 支持外部控制
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen
  const [orgPickerOpen, setOrgPickerOpen] = useState(false)
  
  // 表单数据状态
  const [formData, setFormData] = useState({
    targets: "",  // 目标列表，每行一个
    organizationId: "",  // 选择的组织ID
  })
  
  // 组织选择器状态
  const [orgSearchQuery, setOrgSearchQuery] = useState("")
  const [orgPage, setOrgPage] = useState(1)
  const [orgPageSize, setOrgPageSize] = useState(20)  // 默认每页20条
  const pageSizeOptions = [20, 50, 200, 500, 1000]
  
  // 验证错误状态
  const [invalidTargets, setInvalidTargets] = useState<Array<{ index: number; originalTarget: string; error: string; type?: string }>>([])
  
  // 使用批量创建目标 mutation
  const batchCreateTargets = useBatchCreateTargets()
  
  // 行号列和输入框的 ref（用于同步滚动）
  const lineNumbersRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  
  // 获取组织列表（支持分页）
  const shouldEnableOrgsQuery = Boolean(prefetchEnabled || orgPickerOpen)
  const { data: organizationsData, isLoading: isLoadingOrganizations } = useOrganizations(
    {
      page: orgPage,
      pageSize: orgPageSize,  // 动态每页数量
    },
    { enabled: shouldEnableOrgsQuery }
  )

  // 处理输入框变化
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    if (field === "targets") {
      const lines = value
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      if (lines.length === 0) {
        setInvalidTargets([])
        return
      }

      const results = TargetValidator.validateTargetBatch(lines)
      const invalid = results
        .filter((r) => !r.isValid)
        .map((r) => ({ index: r.index, originalTarget: r.originalTarget, error: r.error || "目标格式无效", type: r.type }))
      setInvalidTargets(invalid)
    }
  }
  
  // 计算目标数量
  const targetCount = formData.targets
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0).length

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 表单验证
    if (!formData.targets.trim()) {
      return
    }

    if (invalidTargets.length > 0) {
      return
    }

    // 解析目标列表（每行一个目标）
    const targetList = formData.targets
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(name => ({
        name,
      }))

    if (targetList.length === 0) {
      return
    }

    // 组装请求数据（组织为可选字段）
    const payload: BatchCreateTargetsRequest = {
      targets: targetList,
    }

    if (formData.organizationId) {
      payload.organizationId = parseInt(formData.organizationId, 10)
    }

    // 调用批量创建 API
    batchCreateTargets.mutate(
      payload,
      {
        onSuccess: (batchCreateResult) => {
          // 重置表单
          setFormData({
            targets: "",
            organizationId: "",
          })
          setInvalidTargets([])
          setOrgSearchQuery("")
          setOrgPage(1)
          setOrgPageSize(20)
          
          // 关闭对话框
          setOpen(false)
          
          // 调用外部回调（如果提供）
          if (onAdd) {
            onAdd()
          }
        }
      }
    )
  }

  // 处理对话框关闭
  const handleOpenChange = (newOpen: boolean) => {
    if (!batchCreateTargets.isPending) {
      setOpen(newOpen)
      if (!newOpen) {
        // 关闭时重置表单
        setFormData({
          targets: "",
          organizationId: "",
        })
        setInvalidTargets([])
        setOrgSearchQuery("")
        setOrgPage(1)
        setOrgPageSize(20)  // 重置为默认值
      }
    }
  }

  // 表单验证
  const isFormValid = formData.targets.trim().length > 0 && invalidTargets.length === 0
  
  // 同步输入框和行号列的滚动
  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }

  // 获取选中的组织名称
  const [selectedOrgName, setSelectedOrgName] = useState("")
  const selectedOrganization = organizationsData?.organizations.find(
    org => org.id.toString() === formData.organizationId
  )
  
  // 更新选中组织的名称
  React.useEffect(() => {
    if (selectedOrganization) {
      setSelectedOrgName(selectedOrganization.name)
    }
  }, [selectedOrganization])
  
  // 过滤组织列表
  const filteredOrganizations = React.useMemo(() => {
    if (!organizationsData?.organizations) return []
    if (!orgSearchQuery) return organizationsData.organizations
    return organizationsData.organizations.filter(org => 
      org.name.toLowerCase().includes(orgSearchQuery.toLowerCase())
    )
  }, [organizationsData?.organizations, orgSearchQuery])
  
  // 处理组织选择
  const handleSelectOrganization = (orgId: string, orgName: string) => {
    handleInputChange("organizationId", orgId)
    setSelectedOrgName(orgName)
    setOrgPickerOpen(false)
    setOrgSearchQuery("")
    setOrgPage(1)
    setOrgPageSize(20)  // 重置为默认值
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* 触发按钮 - 仅在非外部控制时显示 */}
      {externalOpen === undefined && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus />
            添加目标
          </Button>
        </DialogTrigger>
      )}
      
      {/* 对话框内容 */}
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <TargetIcon />
            <span>添加目标</span>
          </DialogTitle>
          <DialogDescription>
            输入目标并关联到组织。支持批量添加，每行一个目标。标有 * 的字段为必填项。
          </DialogDescription>
        </DialogHeader>
        
        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 目标输入框（支持多行） */}
            <div className="grid gap-2">
              <Label htmlFor="targets">
                目标列表 <span className="text-destructive">*</span>
              </Label>
              <div className="flex border rounded-md overflow-hidden h-[180px]">
                {/* 行号列 - 固定宽度 */}
                <div className="flex-shrink-0 w-12 border-r bg-muted/50">
                  <div 
                    ref={lineNumbersRef}
                    className="py-3 px-2 text-right font-mono text-xs text-muted-foreground leading-[1.4] h-full overflow-y-auto scrollbar-hide"
                  >
                    {Array.from({ length: Math.max(formData.targets.split('\n').length, 8) }, (_, i) => (
                      <div key={i + 1} className="h-[20px]">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                </div>
                {/* 输入框区域 - 占据剩余空间 */}
                <div className="flex-1 overflow-hidden">
                  {/* 输入框 - 固定高度显示8行 */}
                  <Textarea
                    ref={textareaRef}
                    id="targets"
                    value={formData.targets}
                    onChange={(e) => handleInputChange("targets", e.target.value)}
                    onScroll={handleTextareaScroll}
                    placeholder={`请输入目标，每行一个
支持域名、IP、CIDR
例如：
example.com
192.168.1.1
10.0.0.0/8`}
                    disabled={batchCreateTargets.isPending}
                    className="font-mono h-full overflow-y-auto resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 leading-[1.4] text-sm py-3"
                    style={{ lineHeight: '20px' }}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {targetCount} 个目标
              </div>
              {invalidTargets.length > 0 && (
                <div className="text-xs text-destructive">
                  {invalidTargets.length} 个无效目标，例如 第 {invalidTargets[0].index + 1} 行: &quot;{invalidTargets[0].originalTarget}&quot; - {invalidTargets[0].error}
                </div>
              )}
            </div>

            {/* 所属组织（可选择、可搜索、分页） */}
            <div className="grid gap-2">
              <Label htmlFor="organization">
                关联组织（可选）
              </Label>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between"
                onClick={() => setOrgPickerOpen(true)}
                disabled={batchCreateTargets.isPending || isLoadingOrganizations}
              >
                {isLoadingOrganizations ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载中...
                  </span>
                ) : formData.organizationId ? (
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{selectedOrgName}</span>
                  </span>
                ) : (
                  "请选择组织"
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
              <CommandDialog
                open={orgPickerOpen}
                onOpenChange={(o) => {
                  setOrgPickerOpen(o)
                  if (!o) {
                    setOrgSearchQuery("")
                    setOrgPage(1)
                    setOrgPageSize(20)
                  }
                }}
              >
                <CommandInput
                  placeholder="搜索组织..."
                  value={orgSearchQuery}
                  onValueChange={(v) => setOrgSearchQuery(v)}
                />
                <CommandList className="max-h-[300px] overflow-y-auto overscroll-contain">
                  {isLoadingOrganizations ? (
                    <div className="py-6 text-center text-sm">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </div>
                  ) : filteredOrganizations.length === 0 ? (
                    <CommandEmpty>未找到组织</CommandEmpty>
                  ) : (
                    <CommandGroup>
                      <div className="grid grid-cols-2 gap-1 p-1">
                        {filteredOrganizations.map((org) => (
                          <CommandItem
                            key={org.id}
                            value={org.id.toString()}
                            onSelect={() => handleSelectOrganization(org.id.toString(), org.name)}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-1 h-3.5 w-3.5 flex-shrink-0",
                                formData.organizationId === org.id.toString()
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <Building2 className="mr-1 h-3.5 w-3.5 flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{org.name}</span>
                          </CommandItem>
                        ))}
                      </div>
                    </CommandGroup>
                  )}
                </CommandList>
                {organizationsData && (
                  <div className="flex items-center justify-between border-t p-2 bg-muted/50">
                    <div className="text-xs text-muted-foreground">
                      共 {organizationsData.pagination.total} 个组织 · 第 {organizationsData.pagination.page} / {organizationsData.pagination.totalPages} 页
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">每页:</span>
                        <Select value={orgPageSize.toString()} onValueChange={(value) => {
                          setOrgPageSize(Number(value))
                          setOrgPage(1)
                        }}>
                          <SelectTrigger className="h-7 w-16 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {pageSizeOptions.map((size) => (
                              <SelectItem key={size} value={size.toString()}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => setOrgPage(1)}
                          disabled={orgPage === 1 || isLoadingOrganizations}
                        >
                          <span className="sr-only">第一页</span>
                          <IconChevronsLeft />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setOrgPage(prev => Math.max(1, prev - 1))}
                          disabled={orgPage === 1 || isLoadingOrganizations}
                        >
                          <span className="sr-only">上一页</span>
                          <IconChevronLeft />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setOrgPage(prev => Math.min(organizationsData.pagination.totalPages, prev + 1))}
                          disabled={orgPage === organizationsData.pagination.totalPages || isLoadingOrganizations}
                        >
                          <span className="sr-only">下一页</span>
                          <IconChevronRight />
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => setOrgPage(organizationsData.pagination.totalPages)}
                          disabled={orgPage === organizationsData.pagination.totalPages || isLoadingOrganizations}
                        >
                          <span className="sr-only">最后一页</span>
                          <IconChevronsRight />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CommandDialog>
            </div>
          </div>
          
          {/* 对话框底部按钮 */}
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              disabled={batchCreateTargets.isPending}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              disabled={batchCreateTargets.isPending || !isFormValid}
            >
              {batchCreateTargets.isPending ? (
                <>
                  <LoadingSpinner/>
                  创建中...
                </>
              ) : (
                <>
                  <Plus />
                  创建目标
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
