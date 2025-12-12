"use client"

import { useState } from "react"
import { ToolCard } from "@/components/tools/config/tool-card"
import { AddToolDialog } from "@/components/tools/config/add-tool-dialog"
import { useTools, useDeleteTool } from "@/hooks/use-tools"
import type { Tool } from "@/types/tool.types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LoadingSpinner } from "@/components/loading-spinner"
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton"

/**
 * 开源工具列表组件
 * 展示和管理开源扫描工具
 */
export function OpensourceToolsList() {
  const [checkingToolId, setCheckingToolId] = useState<number | null>(null)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null)
  
  // 获取工具列表（只获取开源工具）
  const { data, isLoading, error } = useTools({
    page: 1,
    pageSize: 100,
  })

  // 过滤出开源工具
  const tools = (data?.tools || []).filter((tool: Tool) => tool.type === 'opensource')
  
  // 删除工具 mutation
  const deleteTool = useDeleteTool()

  // 处理检查更新
  const handleCheckUpdate = async (toolId: number) => {
    try {
      setCheckingToolId(toolId)
      console.log("检查工具更新:", toolId)
      
      // TODO: 调用后端 API 检查更新
      // 模拟异步操作
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      console.log("检查完成:", toolId)
    } catch (error) {
      console.error("检查更新失败:", error)
    } finally {
      setCheckingToolId(null)
    }
  }

  // 处理编辑工具
  const handleEditTool = (tool: Tool) => {
    setEditingTool(tool)
    setIsEditDialogOpen(true)
  }

  // 编辑对话框关闭回调
  const handleEditDialogClose = (open: boolean) => {
    setIsEditDialogOpen(open)
    if (!open) {
      setEditingTool(null)
    }
  }

  // 处理删除工具
  const handleDeleteTool = (toolId: number) => {
    const tool = tools.find((t: Tool) => t.id === toolId)
    if (!tool) return
    setToolToDelete(tool)
  }

  // 确认删除工具
  const confirmDelete = async () => {
    if (!toolToDelete) return
    
    try {
      await deleteTool.mutateAsync(toolToDelete.id)
      // 删除成功后关闭对话框
      setToolToDelete(null)
    } catch (error) {
      // 错误已在 hook 中处理
    }
  }

  // 加载状态
  if (isLoading) {
    return <CardGridSkeleton cards={4} />
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive">加载失败: {error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 工具列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tools.map((tool: Tool) => (
          <ToolCard 
            key={tool.id} 
            tool={tool}
            onCheckUpdate={handleCheckUpdate}
            onEdit={handleEditTool}
            onDelete={handleDeleteTool}
            isChecking={checkingToolId === tool.id}
          />
        ))}
      </div>
      
      {/* 空状态 */}
      {tools.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">暂无工具</p>
        </div>
      )}

      {/* 编辑工具对话框 */}
      <AddToolDialog 
        tool={editingTool || undefined}
        open={isEditDialogOpen}
        onOpenChange={handleEditDialogClose}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={!!toolToDelete} onOpenChange={(open) => !open && setToolToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除开源工具 &quot;{toolToDelete?.name}&quot; 及其相关配置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTool.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTool.isPending}
            >
              {deleteTool.isPending ? (
                <>
                  <LoadingSpinner/>
                  删除中...
                </>
              ) : (
                "删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
