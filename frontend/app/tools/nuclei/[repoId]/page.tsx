"use client"

import { useEffect, useMemo, useState } from "react"
import Editor from "@monaco-editor/react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  ArrowLeft,
  Search,
  RefreshCw,
  AlertTriangle,
  Tag,
  User,
} from "lucide-react"
import { useTheme } from "next-themes"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  useNucleiRepoTree,
  useNucleiRepoContent,
  useRefreshNucleiRepo,
  useNucleiRepo,
} from "@/hooks/use-nuclei-repos"
import type { NucleiTemplateTreeNode } from "@/types/nuclei.types"
import { cn } from "@/lib/utils"

interface FlattenedNode extends NucleiTemplateTreeNode {
  level: number
}

/** 解析 YAML 内容提取模板信息 */
function parseTemplateInfo(content: string) {
  const info: {
    id?: string
    name?: string
    severity?: string
    tags?: string[]
    author?: string
  } = {}

  // 简单正则提取，不用完整 YAML 解析
  const idMatch = content.match(/^id:\s*(.+)$/m)
  if (idMatch) info.id = idMatch[1].trim()

  const nameMatch = content.match(/^\s*name:\s*(.+)$/m)
  if (nameMatch) info.name = nameMatch[1].trim()

  const severityMatch = content.match(/^\s*severity:\s*(.+)$/m)
  if (severityMatch) info.severity = severityMatch[1].trim().toLowerCase()

  const tagsMatch = content.match(/^\s*tags:\s*(.+)$/m)
  if (tagsMatch) info.tags = tagsMatch[1].split(",").map((t) => t.trim())

  const authorMatch = content.match(/^\s*author:\s*(.+)$/m)
  if (authorMatch) info.author = authorMatch[1].trim()

  return info
}

/** 严重程度对应的颜色 */
function getSeverityColor(severity?: string) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-200"
    case "high":
      return "bg-orange-100 text-orange-700 border-orange-200"
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-200"
    case "low":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "info":
      return "bg-gray-100 text-gray-700 border-gray-200"
    default:
      return "bg-gray-100 text-gray-600 border-gray-200"
  }
}

export default function NucleiRepoDetailPage() {
  const params = useParams()
  const repoId = params?.repoId as string

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [editorValue, setEditorValue] = useState<string>("")

  const { theme } = useTheme()

  const numericRepoId = repoId ? Number(repoId) : null

  const { data: tree, isLoading, isError } = useNucleiRepoTree(numericRepoId)
  const { data: templateContent, isLoading: isLoadingContent } = useNucleiRepoContent(numericRepoId, selectedPath)
  const { data: repoDetail } = useNucleiRepo(numericRepoId)
  const refreshMutation = useRefreshNucleiRepo()

  // 展开的节点和过滤后的节点
  const nodes: FlattenedNode[] = useMemo(() => {
    const result: FlattenedNode[] = []
    const expandedSet = new Set(expandedPaths)
    const query = searchQuery.toLowerCase().trim()

    const visit = (items: NucleiTemplateTreeNode[] | undefined, level: number) => {
      if (!items) return
      for (const item of items) {
        const isFolder = item.type === "folder"
        const isFile = item.type === "file"
        const isTemplateFile =
          isFile && (item.name.endsWith(".yaml") || item.name.endsWith(".yml"))

        if (!isFolder && !isTemplateFile) {
          continue
        }

        // 搜索过滤
        if (query && isFile && !item.name.toLowerCase().includes(query)) {
          continue
        }

        result.push({ ...item, level })

        if (isFolder && item.children && item.children.length > 0) {
          // 搜索时展开所有文件夹，否则按 expandedPaths
          if (query || expandedSet.has(item.path)) {
            visit(item.children, level + 1)
          }
        }
      }
    }

    visit(tree, 0)
    return result
  }, [tree, expandedPaths, searchQuery])

  useEffect(() => {
    if (!tree || tree.length === 0) return
    if (expandedPaths.length > 0) return

    const rootFolders = tree
      .filter((item) => item.type === "folder")
      .map((item) => item.path)

    if (rootFolders.length > 0) {
      setExpandedPaths(rootFolders)
    }
  }, [tree, expandedPaths])

  useEffect(() => {
    if (templateContent) {
      setEditorValue(templateContent.content)
    } else {
      setEditorValue("")
    }
  }, [templateContent?.path])

  const toggleFolder = (path: string) => {
    setExpandedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const repoDisplayName = repoDetail?.name || `仓库 #${repoId}`

  // 解析当前模板信息
  const templateInfo = useMemo(() => {
    if (!templateContent?.content) return null
    return parseTemplateInfo(templateContent.content)
  }, [templateContent?.content])

  return (
    <div className="flex flex-col h-full">
      {/* 顶部：返回 + 标题 + 搜索 + 同步 */}
      <div className="flex items-center gap-4 px-4 py-4 lg:px-6">
        <Link href="/tools/nuclei/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </Link>
        <h1 className="text-xl font-bold truncate">{repoDisplayName}</h1>
        <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => numericRepoId && refreshMutation.mutate(numericRepoId)}
          disabled={refreshMutation.isPending || !numericRepoId}
        >
          <RefreshCw className={cn("h-4 w-4 mr-1.5", refreshMutation.isPending && "animate-spin")} />
          {refreshMutation.isPending ? "同步中..." : "同步"}
        </Button>
      </div>

      <Separator />

      {/* 主体：左侧目录 + 右侧内容 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧：模板目录 */}
        <div className="w-72 lg:w-80 border-r flex flex-col">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-medium text-muted-foreground">
              模板目录 {nodes.filter((n) => n.type === "file").length > 0 && 
                `(${nodes.filter((n) => n.type === "file").length} 个模板)`}
            </h2>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">加载中...</div>
            ) : isError || nodes.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {searchQuery ? "未找到匹配的模板" : "暂无模板或加载失败"}
              </div>
            ) : (
              <div className="p-2">
                {nodes.map((node) => {
                  const isFolder = node.type === "folder"
                  const isFile = node.type === "file"
                  const isActive = isFile && node.path === selectedPath
                  const isExpanded = isFolder && expandedPaths.includes(node.path)

                  return (
                    <button
                      key={node.path}
                      type="button"
                      onClick={() => {
                        if (isFolder) {
                          toggleFolder(node.path)
                        } else if (isFile) {
                          setSelectedPath(node.path)
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        isFolder && "font-medium",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted"
                      )}
                      style={{ paddingLeft: 8 + node.level * 16 }}
                    >
                      {isFolder ? (
                        <>
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </>
                      ) : (
                        <>
                          <span className="w-3.5" />
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </>
                      )}
                      <span className="truncate">{node.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 右侧：模板内容 */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedPath && templateContent ? (
            <>
              {/* 模板头部 */}
              <div className="px-6 py-4 border-b">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold truncate">
                      {templateContent.name}
                    </h2>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {templateContent.path}
                    </p>
                  </div>
                  {templateInfo?.severity && (
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 capitalize", getSeverityColor(templateInfo.severity))}
                    >
                      {templateInfo.severity}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 代码编辑器 */}
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  defaultLanguage="yaml"
                  value={editorValue}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    readOnly: true,
                    padding: { top: 16 },
                  }}
                  theme={theme === "dark" ? "vs-dark" : "light"}
                />
              </div>

              {/* 模板信息 */}
              {templateInfo && (templateInfo.tags || templateInfo.author) && (
                <div className="px-6 py-3 border-t flex items-center gap-4 text-sm">
                  {templateInfo.tags && templateInfo.tags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <div className="flex gap-1 flex-wrap">
                        {templateInfo.tags.slice(0, 5).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {templateInfo.tags.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{templateInfo.tags.length - 5}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {templateInfo.author && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{templateInfo.author}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            // 未选中状态
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">选择左侧模板查看内容</p>
                <p className="text-xs mt-1">或使用搜索快速定位</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
