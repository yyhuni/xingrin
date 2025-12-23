"use client"

import React, { useState, useEffect, useRef } from "react"
import { FileCode, Save, X, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react"
import Editor from "@monaco-editor/react"
import * as yaml from "js-yaml"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useColorTheme } from "@/hooks/use-color-theme"
import type { ScanEngine } from "@/types/engine.types"

interface EngineEditDialogProps {
  engine: ScanEngine | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (engineId: number, yamlContent: string) => Promise<void>
}

/**
 * 引擎配置编辑弹窗
 * 使用 Monaco Editor 提供 VSCode 级别的编辑体验
 */
export function EngineEditDialog({
  engine,
  open,
  onOpenChange,
  onSave,
}: EngineEditDialogProps) {
  const [yamlContent, setYamlContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [yamlError, setYamlError] = useState<{ message: string; line?: number; column?: number } | null>(null)
  const { currentTheme } = useColorTheme()
  const editorRef = useRef<any>(null)

  // 生成示例 YAML 配置
  const generateSampleYaml = (engine: ScanEngine) => {
    return `# 引擎名称: ${engine.name}

# ==================== 子域名发现 ====================
subdomain_discovery:
  tools:
    subfinder:
      enabled: true
      timeout: 600      # 10 分钟（必需）
      
    amass_passive:
      enabled: true
      timeout: 600      # 10 分钟（必需）
      
    amass_active:
      enabled: true
      timeout: 1800     # 30 分钟（必需）
      
    sublist3r:
      enabled: true
      timeout: 900      # 15 分钟（必需）
      
    oneforall:
      enabled: true
      timeout: 1200     # 20 分钟（必需）


# ==================== 端口扫描 ====================
port_scan:
  tools:
    naabu_active:
      enabled: true
      timeout: auto     # 自动计算
      threads: 5
      top-ports: 100
      rate: 10
      
    naabu_passive:
      enabled: true
      timeout: auto


# ==================== 站点扫描 ====================
site_scan:
  tools:
    httpx:
      enabled: true
      timeout: auto         # 自动计算


# ==================== 目录扫描 ====================
directory_scan:
  tools:
    ffuf:
      enabled: true
      timeout: auto                            # 自动计算超时时间
      wordlist: ~/Desktop/dirsearch_dicc.txt   # 词表文件路径（必需）
      delay: 0.1-2.0
      threads: 10
      request_timeout: 10
      match_codes: 200,201,301,302,401,403


# ==================== URL 获取 ====================
url_fetch:
  tools:
    waymore:
      enabled: true
      timeout: auto
    
    katana:
      enabled: true
      timeout: auto
      depth: 5
      threads: 10
      rate-limit: 30
      random-delay: 1
      retry: 2
      request-timeout: 12
    
    uro:
      enabled: true
      timeout: auto
    
    httpx:
      enabled: true
      timeout: auto
`
  }

  // 当引擎改变时，更新 YAML 内容
  useEffect(() => {
    if (engine && open) {
      // TODO: 从后端 API 获取实际的 YAML 配置
      // 如果引擎有配置则使用，否则使用示例配置
      const content = engine.configuration || generateSampleYaml(engine)
      setYamlContent(content)
      setHasChanges(false)
      setYamlError(null)
    }
  }, [engine, open])

  // 验证 YAML 语法
  const validateYaml = (content: string) => {
    if (!content.trim()) {
      setYamlError(null)
      return true
    }

    try {
      yaml.load(content)
      setYamlError(null)
      return true
    } catch (error) {
      const yamlError = error as yaml.YAMLException
      setYamlError({
        message: yamlError.message,
        line: yamlError.mark?.line ? yamlError.mark.line + 1 : undefined,
        column: yamlError.mark?.column ? yamlError.mark.column + 1 : undefined,
      })
      return false
    }
  }

  // 处理编辑器内容变化
  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || ""
    setYamlContent(newValue)
    setHasChanges(true)
    validateYaml(newValue)
  }

  // 处理编辑器挂载
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    setIsEditorReady(true)
  }

  // 处理保存
  const handleSave = async () => {
    if (!engine) return

    // YAML 验证
    if (!yamlContent.trim()) {
      toast.error("配置内容不能为空")
      return
    }

    if (!validateYaml(yamlContent)) {
      toast.error("YAML 语法错误", {
        description: yamlError?.message,
      })
      return
    }

    setIsSubmitting(true)
    try {
      if (onSave) {
        await onSave(engine.id, yamlContent)
      } else {
        // TODO: 调用实际的 API 保存 YAML 配置
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      toast.success("配置保存成功", {
        description: `引擎 "${engine.name}" 的配置已更新`,
      })
      setHasChanges(false)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save YAML config:", error)
      toast.error("配置保存失败", {
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理关闭
  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm("您有未保存的更改，确定要关闭吗？")
      if (!confirmed) return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-w-[calc(100%-2rem)] h-[90vh] flex flex-col p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              编辑引擎配置 - {engine?.name}
            </DialogTitle>
            <DialogDescription>
              使用 Monaco Editor 编辑引擎的 YAML 配置文件，支持语法高亮、自动补全和错误提示。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6 py-4">
            <div className="flex flex-col h-full gap-2">
              <div className="flex items-center justify-between">
                <Label>YAML 配置</Label>
                {/* 语法验证状态 */}
                <div className="flex items-center gap-2">
                  {yamlContent.trim() && (
                    yamlError ? (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>语法错误</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>语法正确</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Monaco Editor */}
              <div className={`border rounded-md overflow-hidden h-full ${yamlError ? 'border-destructive' : ''}`}>
                <Editor
                  height="100%"
                  defaultLanguage="yaml"
                  value={yamlContent}
                  onChange={handleEditorChange}
                  onMount={handleEditorDidMount}
                  theme={currentTheme.isDark ? "vs-dark" : "light"}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    wordWrap: "off",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    formatOnPaste: true,
                    formatOnType: true,
                    folding: true,
                    foldingStrategy: "indentation",
                    showFoldingControls: "always",
                    bracketPairColorization: {
                      enabled: true,
                    },
                    padding: {
                      top: 16,
                      bottom: 16,
                    },
                    readOnly: isSubmitting,
                  }}
                  loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        <p className="text-sm text-muted-foreground">加载编辑器...</p>
                      </div>
                    </div>
                  }
                />
              </div>

              {/* 错误信息显示 */}
              {yamlError && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-destructive mb-1">
                      {yamlError.line && yamlError.column
                        ? `第 ${yamlError.line} 行，第 ${yamlError.column} 列`
                        : "YAML 语法错误"}
                    </p>
                    <p className="text-muted-foreground">{yamlError.message}</p>
                  </div>
                </div>
              )}
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                您有未保存的更改
              </p>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || !hasChanges || !!yamlError || !isEditorReady}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存配置
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
