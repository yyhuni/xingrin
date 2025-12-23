"use client"

import React, { useState } from "react"
import { FileCode, Save, X, AlertCircle, CheckCircle2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useColorTheme } from "@/hooks/use-color-theme"

interface EngineCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (name: string, yamlContent: string) => Promise<void>
}

/**
 * 新建引擎弹窗
 */
export function EngineCreateDialog({
  open,
  onOpenChange,
  onSave,
}: EngineCreateDialogProps) {
  const [engineName, setEngineName] = useState("")
  const [yamlContent, setYamlContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const [yamlError, setYamlError] = useState<{ message: string; line?: number; column?: number } | null>(null)
  const { currentTheme } = useColorTheme()
  const editorRef = React.useRef<any>(null)

  // 默认 YAML 模板
  const defaultYaml = `# 请在此处编写引擎配置 YAML
# 可以参考 engine_config_example.yaml 文件中的配置示例`;

  // 当对话框打开时，重置表单
  React.useEffect(() => {
    if (open) {
      setEngineName("")
      setYamlContent(defaultYaml)
      setYamlError(null)
    }
  }, [open])

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
    validateYaml(newValue)
  }

  // 处理编辑器挂载
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    setIsEditorReady(true)
  }

  // 处理保存
  const handleSave = async () => {
    // 验证引擎名称
    if (!engineName.trim()) {
      toast.error("请输入引擎名称")
      return
    }

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
        await onSave(engineName, yamlContent)
      } else {
        // TODO: 调用实际的 API 创建引擎
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      toast.success("引擎创建成功", {
        description: `引擎 "${engineName}" 已成功创建`,
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to create engine:", error)
      toast.error("引擎创建失败", {
        description: error instanceof Error ? error.message : "未知错误",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理关闭
  const handleClose = () => {
    if (engineName.trim() || yamlContent !== defaultYaml) {
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
              新建扫描引擎
            </DialogTitle>
            <DialogDescription>
              创建新的扫描引擎配置，使用 Monaco Editor 编辑 YAML 配置文件，支持语法高亮、自动补全和错误提示。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6 py-4">
            <div className="flex flex-col h-full gap-4">
              {/* 引擎名称输入 */}
              <div className="space-y-2">
                <Label htmlFor="engine-name">
                  引擎名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="engine-name"
                  value={engineName}
                  onChange={(e) => setEngineName(e.target.value)}
                  placeholder="请输入引擎名称，例如：全面扫描引擎"
                  disabled={isSubmitting}
                  className="max-w-md"
                />
              </div>

              {/* YAML 编辑器 */}
              <div className="flex flex-col flex-1 min-h-0 gap-2">
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
                <div className={`border rounded-md overflow-hidden flex-1 ${yamlError ? 'border-destructive' : ''}`}>
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
              </div>
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
              disabled={isSubmitting || !engineName.trim() || !!yamlError || !isEditorReady}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  创建中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  创建引擎
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

