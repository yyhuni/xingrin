"use client"

import React, { useState, useMemo } from "react"
import { Settings, Search, Pencil, Trash2, Check, X, Plus } from "lucide-react"
import * as yaml from "js-yaml"
import Editor from "@monaco-editor/react"
import { useColorTheme } from "@/hooks/use-color-theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
import { EngineEditDialog, EngineCreateDialog } from "@/components/scan/engine"
import { useEngines, useCreateEngine, useUpdateEngine, useDeleteEngine } from "@/hooks/use-engines"
import { cn } from "@/lib/utils"
import type { ScanEngine } from "@/types/engine.types"
import { MasterDetailSkeleton } from "@/components/ui/master-detail-skeleton"

/** 功能配置项定义 - 与 YAML 配置结构对应 */
const FEATURE_LIST = [
  { key: "subdomain_discovery", label: "子域名发现" },
  { key: "port_scan", label: "端口扫描" },
  { key: "site_scan", label: "站点扫描" },
  { key: "directory_scan", label: "目录扫描" },
  { key: "url_fetch", label: "URL 抓取" },
  { key: "vuln_scan", label: "漏洞扫描" },
] as const

type FeatureKey = typeof FEATURE_LIST[number]["key"]

/** 解析引擎配置获取启用的功能 */
function parseEngineFeatures(engine: ScanEngine): Record<FeatureKey, boolean> {
  const defaultFeatures: Record<FeatureKey, boolean> = {
    subdomain_discovery: false,
    port_scan: false,
    site_scan: false,
    directory_scan: false,
    url_fetch: false,
    vuln_scan: false,
  }

  if (!engine.configuration) return defaultFeatures

  try {
    const config = yaml.load(engine.configuration) as Record<string, unknown>
    if (!config) return defaultFeatures

    return {
      subdomain_discovery: !!config.subdomain_discovery,
      port_scan: !!config.port_scan,
      site_scan: !!config.site_scan,
      directory_scan: !!config.directory_scan,
      url_fetch: !!config.url_fetch,
      vuln_scan: !!config.vuln_scan,
    }
  } catch {
    return defaultFeatures
  }
}

/** 计算启用的功能数量 */
function countEnabledFeatures(engine: ScanEngine) {
  const features = parseEngineFeatures(engine)
  return Object.values(features).filter(Boolean).length
}

/**
 * 扫描引擎页面
 */
export default function ScanEnginePage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [editingEngine, setEditingEngine] = useState<ScanEngine | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [engineToDelete, setEngineToDelete] = useState<ScanEngine | null>(null)

  const { currentTheme } = useColorTheme()

  // API Hooks
  const { data: engines = [], isLoading } = useEngines()
  const createEngineMutation = useCreateEngine()
  const updateEngineMutation = useUpdateEngine()
  const deleteEngineMutation = useDeleteEngine()

  // 过滤引擎列表
  const filteredEngines = useMemo(() => {
    if (!searchQuery.trim()) return engines
    const query = searchQuery.toLowerCase()
    return engines.filter((e) => e.name.toLowerCase().includes(query))
  }, [engines, searchQuery])

  // 选中的引擎
  const selectedEngine = useMemo(() => {
    if (!selectedId) return null
    return engines.find((e) => e.id === selectedId) || null
  }, [selectedId, engines])

  // 选中引擎的功能状态
  const selectedFeatures = useMemo(() => {
    if (!selectedEngine) return null
    return parseEngineFeatures(selectedEngine)
  }, [selectedEngine])

  const handleEdit = (engine: ScanEngine) => {
    setEditingEngine(engine)
    setIsEditDialogOpen(true)
  }

  const handleSaveYaml = async (engineId: number, yamlContent: string) => {
    await updateEngineMutation.mutateAsync({
      id: engineId,
      data: { configuration: yamlContent },
    })
  }

  const handleDelete = (engine: ScanEngine) => {
    setEngineToDelete(engine)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!engineToDelete) return
    deleteEngineMutation.mutate(engineToDelete.id, {
      onSuccess: () => {
        if (selectedId === engineToDelete.id) {
          setSelectedId(null)
        }
        setDeleteDialogOpen(false)
        setEngineToDelete(null)
      },
    })
  }

  const handleCreateEngine = async (name: string, yamlContent: string) => {
    await createEngineMutation.mutateAsync({
      name,
      configuration: yamlContent,
    })
  }

  // 加载状态
  if (isLoading) {
    return <MasterDetailSkeleton title="扫描引擎" listItemCount={4} />
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部：标题 + 搜索 + 新建按钮 */}
      <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-6">
        <h1 className="text-2xl font-bold shrink-0">扫描引擎</h1>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索引擎..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新建引擎
        </Button>
      </div>

      <Separator />

      {/* 主体：左侧列表 + 右侧详情 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧：引擎列表 */}
        <div className="w-72 lg:w-80 border-r flex flex-col">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-medium text-muted-foreground">
              引擎列表 ({filteredEngines.length})
            </h2>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">加载中...</div>
            ) : filteredEngines.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {searchQuery ? "未找到匹配的引擎" : "暂无引擎，请先新建"}
              </div>
            ) : (
              <div className="p-2">
                {filteredEngines.map((engine) => (
                  <button
                    key={engine.id}
                    onClick={() => setSelectedId(engine.id)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                      selectedId === engine.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="font-medium text-sm truncate">
                      {engine.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {countEnabledFeatures(engine)} 个功能已启用
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 右侧：引擎详情 */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedEngine && selectedFeatures ? (
            <>
              {/* 详情头部 */}
              <div className="px-6 py-4 border-b">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold truncate">
                      {selectedEngine.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      更新于 {new Date(selectedEngine.updatedAt).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {countEnabledFeatures(selectedEngine)} 个功能
                  </Badge>
                </div>
              </div>

              {/* 详情内容 */}
              <div className="flex-1 flex flex-col min-h-0 p-6 gap-6">
                {/* 功能状态 */}
                <div className="shrink-0">
                  <h3 className="text-sm font-medium mb-3">已启用功能</h3>
                  <div className="rounded-lg border">
                    <div className="grid grid-cols-3 gap-px bg-muted">
                      {FEATURE_LIST.map((feature) => {
                        const enabled = selectedFeatures[feature.key as keyof typeof selectedFeatures]
                        return (
                          <div
                            key={feature.key}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2.5 bg-background",
                              enabled ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {enabled ? (
                              <Check className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                            )}
                            <span className="text-sm truncate">{feature.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* 配置预览 */}
                {selectedEngine.configuration && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <h3 className="text-sm font-medium mb-3 shrink-0">配置预览</h3>
                    <div className="flex-1 rounded-lg border overflow-hidden min-h-0">
                      <Editor
                        height="100%"
                        defaultLanguage="yaml"
                        value={selectedEngine.configuration}
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 12,
                          lineNumbers: "off",
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          folding: true,
                          wordWrap: "on",
                          padding: { top: 12, bottom: 12 },
                        }}
                        theme={currentTheme.isDark ? "vs-dark" : "light"}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="px-6 py-4 border-t flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(selectedEngine)}
                >
                  <Pencil className="h-4 w-4 mr-1.5" />
                  编辑配置
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedEngine)}
                  disabled={deleteEngineMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  删除
                </Button>
              </div>
            </>
          ) : (
            // 未选中状态
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">选择左侧引擎查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 编辑引擎弹窗 */}
      <EngineEditDialog
        engine={editingEngine}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveYaml}
      />

      {/* 新建引擎弹窗 */}
      <EngineCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreateEngine}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除引擎「{engineToDelete?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteEngineMutation.isPending}
            >
              {deleteEngineMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

