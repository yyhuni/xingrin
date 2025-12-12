"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconEdit, IconTrash, IconFolder } from "@tabler/icons-react"
import { AddCustomToolDialog } from "@/components/tools/config/add-custom-tool-dialog"
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
import { CategoryNameMap, type Tool } from "@/types/tool.types"
import { useTools, useDeleteTool } from "@/hooks/use-tools"

/**
 * 自定义工具列表组件
 * 展示和管理自定义扫描脚本和工具
 */
export function CustomToolsList() {
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null)
  
  // 获取工具列表（只获取自定义工具）
  const { data, isLoading, error } = useTools({
    page: 1,
    pageSize: 100,
  })

  // 过滤出自定义工具
  const customTools = (data?.tools || []).filter((tool: Tool) => tool.type === 'custom')
  
  // 删除工具 mutation
  const deleteTool = useDeleteTool()

  const handleEditTool = (tool: Tool) => {
    setEditingTool(tool)
    setIsEditDialogOpen(true)
  }

  const handleEditDialogClose = (open: boolean) => {
    setIsEditDialogOpen(open)
    if (!open) {
      setEditingTool(null)
    }
  }

  const handleDeleteTool = (toolId: number) => {
    const tool = customTools.find((t: Tool) => t.id === toolId)
    if (!tool) return
    setToolToDelete(tool)
  }

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
        {customTools.map((tool: Tool) => (
          <Card key={tool.id} className="flex flex-col h-full hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg truncate" title={tool.name}>{tool.name}</CardTitle>
              <CardDescription className="line-clamp-2" title={tool.description || '暂无描述'}>
                {tool.description || '暂无描述'}
              </CardDescription>
              
              {/* 分类标签 */}
              <div className="flex flex-wrap gap-1 mt-2">
                {tool.categoryNames && tool.categoryNames.length > 0 ? (
                  <div 
                    className="flex flex-wrap gap-1"
                    title={tool.categoryNames.map(c => CategoryNameMap[c] || c).join('、')}
                  >
                    {tool.categoryNames.slice(0, 3).map((category: string) => (
                      <Badge key={category} variant="secondary" className="text-xs whitespace-nowrap">
                        {CategoryNameMap[category] || category}
                      </Badge>
                    ))}
                    {tool.categoryNames.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{tool.categoryNames.length - 3}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    未分类
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                {/* 工具目录 */}
                <div className="bg-muted rounded-md p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <IconFolder className="h-4 w-4" />
                    <span>目录</span>
                  </div>
                  <code 
                    className="text-sm font-mono break-all line-clamp-2" 
                    title={tool.directory}
                  >
                    {tool.directory}
                  </code>
                </div>

                {/* 最后更新时间 */}
                <div className="text-sm text-muted-foreground">
                  最后更新：{new Date(tool.updatedAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-0">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleEditTool(tool)}
              >
                <IconEdit className="h-4 w-4" />
                编辑
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleDeleteTool(tool.id)}
              >
                <IconTrash className="h-4 w-4" />
                删除
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* 空状态 */}
      {customTools.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">暂无自定义工具</p>
        </div>
      )}

     

      {/* 编辑工具对话框 */}
      <AddCustomToolDialog 
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
              此操作无法撤销。这将永久删除自定义工具 &quot;{toolToDelete?.name}&quot; 及其相关配置。
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
