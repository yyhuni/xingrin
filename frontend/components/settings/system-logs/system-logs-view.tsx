"use client"

import { useEffect, useMemo, useRef } from "react"
import Editor from "@monaco-editor/react"
import { useColorTheme } from "@/hooks/use-color-theme"

import { Card, CardContent } from "@/components/ui/card"
import { useSystemLogs } from "@/hooks/use-system-logs"

export function SystemLogsView() {
  const { currentTheme } = useColorTheme()
  const { data } = useSystemLogs({ lines: 500 })

  const content = useMemo(() => data?.content ?? "", [data?.content])

  const editorRef = useRef<any>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const model = editor.getModel?.()
    if (!model) return

    const lastLine = model.getLineCount?.() ?? 1
    editor.revealLine?.(lastLine)
  }, [content])

  return (
    <Card>
      <CardContent>
        <div className="h-[calc(100vh-240px)] min-h-[360px] rounded-lg border overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="log"
            value={content || "（暂无日志内容）"}
            theme={currentTheme.isDark ? "vs-dark" : "light"}
            onMount={(editor) => {
              editorRef.current = editor
            }}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "off",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              folding: false,
              wordWrap: "off",
              renderLineHighlight: "none",
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
