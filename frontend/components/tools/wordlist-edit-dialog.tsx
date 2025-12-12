"use client"

import React, { useState, useEffect, useRef } from "react"
import { FileText, Save, X, AlertTriangle } from "lucide-react"
import Editor from "@monaco-editor/react"
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
import { useTheme } from "next-themes"
import { useWordlistContent, useUpdateWordlistContent } from "@/hooks/use-wordlists"
import type { Wordlist } from "@/types/wordlist.types"

interface WordlistEditDialogProps {
  wordlist: Wordlist | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 字典编辑弹窗
 * 使用 Monaco Editor 提供 VSCode 级别的编辑体验
 */
export function WordlistEditDialog({
  wordlist,
  open,
  onOpenChange,
}: WordlistEditDialogProps) {
  const [content, setContent] = useState("")
  const [hasChanges, setHasChanges] = useState(false)
  const [isEditorReady, setIsEditorReady] = useState(false)
  const { theme } = useTheme()
  const editorRef = useRef<any>(null)

  // 获取字典内容
  const { data: originalContent, isLoading } = useWordlistContent(
    open && wordlist ? wordlist.id : null
  )
  const updateMutation = useUpdateWordlistContent()

  // 当获取到内容时，更新编辑器
  useEffect(() => {
    if (originalContent !== undefined && open) {
      setContent(originalContent)
      setHasChanges(false)
    }
  }, [originalContent, open])

  // 当弹窗关闭时重置状态
  useEffect(() => {
    if (!open) {
      setContent("")
      setHasChanges(false)
      setIsEditorReady(false)
    }
  }, [open])

  // 处理编辑器内容变化
  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || ""
    setContent(newValue)
    setHasChanges(newValue !== originalContent)
  }

  // 处理编辑器挂载
  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    setIsEditorReady(true)
  }

  // 处理保存
  const handleSave = async () => {
    if (!wordlist) return

    updateMutation.mutate(
      { id: wordlist.id, content },
      {
        onSuccess: () => {
          setHasChanges(false)
          onOpenChange(false)
        },
      }
    )
  }

  // 处理关闭
  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm("您有未保存的更改，确定要关闭吗？")
      if (!confirmed) return
    }
    onOpenChange(false)
  }

  // 计算行数
  const lineCount = content.split("\n").length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-w-[calc(100%-2rem)] h-[90vh] flex flex-col p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              编辑字典 - {wordlist?.name}
            </DialogTitle>
            <DialogDescription>
              编辑字典内容，每行一个条目。保存后会自动更新行数、文件大小和 Hash 值。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden px-6 py-4">
            <div className="flex flex-col h-full gap-2">
              <div className="flex items-center justify-between">
                <Label>字典内容</Label>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>共 {lineCount.toLocaleString()} 行</span>
                  {wordlist?.fileHash && (
                    <span title={wordlist.fileHash}>
                      Hash: {wordlist.fileHash.slice(0, 12)}...
                    </span>
                  )}
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="border rounded-md overflow-hidden h-full">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      <p className="text-sm text-muted-foreground">加载字典内容...</p>
                    </div>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    defaultLanguage="plaintext"
                    value={content}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: "on",
                      wordWrap: "off",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      insertSpaces: true,
                      folding: false,
                      padding: {
                        top: 16,
                        bottom: 16,
                      },
                      readOnly: updateMutation.isPending,
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
                )}
              </div>

              {/* 未保存提示 */}
              {hasChanges && (
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  您有未保存的更改
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updateMutation.isPending}
            >
              <X className="h-4 w-4" />
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending || !hasChanges || !isEditorReady}
            >
              {updateMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存字典
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
