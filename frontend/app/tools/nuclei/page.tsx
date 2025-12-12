"use client"

import Link from "next/link"
import { useState, useMemo, type FormEvent } from "react"
import { GitBranch, Search, RefreshCw, Settings, Trash2, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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
import {
  useNucleiRepos,
  useCreateNucleiRepo,
  useDeleteNucleiRepo,
  useRefreshNucleiRepo,
  useUpdateNucleiRepo,
  type NucleiRepo,
} from "@/hooks/use-nuclei-repos"
import { cn } from "@/lib/utils"
import { MasterDetailSkeleton } from "@/components/ui/master-detail-skeleton"

/** 格式化时间显示 */
function formatDateTime(isoString: string | null) {
  if (!isoString) return "-"
  try {
    return new Date(isoString).toLocaleString("zh-CN")
  } catch {
    return isoString
  }
}

export default function NucleiReposPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newRepoUrl, setNewRepoUrl] = useState("")

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRepo, setEditingRepo] = useState<NucleiRepo | null>(null)
  const [editRepoUrl, setEditRepoUrl] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [repoToDelete, setRepoToDelete] = useState<NucleiRepo | null>(null)

  // API Hooks
  const { data: repos, isLoading, isError } = useNucleiRepos()
  const createMutation = useCreateNucleiRepo()
  const deleteMutation = useDeleteNucleiRepo()
  const refreshMutation = useRefreshNucleiRepo()
  const updateMutation = useUpdateNucleiRepo()

  // 过滤仓库列表
  const filteredRepos = useMemo(() => {
    if (!repos) return []
    if (!searchQuery.trim()) return repos
    const query = searchQuery.toLowerCase()
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.repoUrl?.toLowerCase().includes(query)
    )
  }, [repos, searchQuery])

  // 选中的仓库
  const selectedRepo = useMemo(() => {
    if (!selectedId || !repos) return null
    return repos.find((r) => r.id === selectedId) || null
  }, [selectedId, repos])

  const resetCreateForm = () => {
    setNewName("")
    setNewRepoUrl("")
  }

  const resetEditForm = () => {
    setEditingRepo(null)
    setEditRepoUrl("")
  }

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    const repoUrl = newRepoUrl.trim()
    if (!name || !repoUrl) return

    createMutation.mutate(
      { name, repoUrl },
      {
        onSuccess: () => {
          resetCreateForm()
          setCreateDialogOpen(false)
        },
      }
    )
  }

  const handleRefresh = (repoId: number) => {
    refreshMutation.mutate(repoId)
  }

  const handleDelete = (repo: NucleiRepo) => {
    setRepoToDelete(repo)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!repoToDelete) return
    deleteMutation.mutate(repoToDelete.id, {
      onSuccess: () => {
        if (selectedId === repoToDelete.id) {
          setSelectedId(null)
        }
        setDeleteDialogOpen(false)
        setRepoToDelete(null)
      },
    })
  }

  const openEditDialog = (repo: NucleiRepo) => {
    setEditingRepo(repo)
    setEditRepoUrl(repo.repoUrl || "")
    setEditDialogOpen(true)
  }

  const handleEditSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!editingRepo) return
    const repoUrl = editRepoUrl.trim()
    if (!repoUrl) return

    updateMutation.mutate(
      { id: editingRepo.id, repoUrl },
      {
        onSuccess: () => {
          resetEditForm()
          setEditDialogOpen(false)
        },
      }
    )
  }

  // 加载状态
  if (isLoading) {
    return <MasterDetailSkeleton title="Nuclei 模板仓库" listItemCount={3} />
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部：标题 + 搜索 + 新增按钮 */}
      <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-6">
        <h1 className="text-2xl font-bold shrink-0">Nuclei 模板仓库</h1>
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索仓库..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          新增模板仓库
        </Button>
      </div>

      <Separator />

      {/* 主体：左侧列表 + 右侧详情 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧：仓库列表 */}
        <div className="w-72 lg:w-80 border-r flex flex-col">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-medium text-muted-foreground">
              仓库列表 ({filteredRepos.length})
            </h2>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">加载中...</div>
            ) : isError ? (
              <div className="p-4 text-sm text-red-500">加载失败</div>
            ) : filteredRepos.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {searchQuery ? "未找到匹配的仓库" : "暂无仓库，请先新增"}
              </div>
            ) : (
              <div className="p-2">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => setSelectedId(repo.id)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                      selectedId === repo.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate flex-1">
                        {repo.name}
                      </span>
                      {repo.lastSyncedAt ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs shrink-0">
                          已同步
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs shrink-0">
                          未同步
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {repo.lastSyncedAt
                        ? `同步于 ${formatDateTime(repo.lastSyncedAt)}`
                        : "尚未同步"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 右侧：仓库详情 */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedRepo ? (
            <>
              {/* 详情头部 */}
              <div className="px-6 py-4 border-b">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <GitBranch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold truncate">
                        {selectedRepo.name}
                      </h2>
                      {selectedRepo.lastSyncedAt ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          已同步
                        </Badge>
                      ) : (
                        <Badge variant="outline">未同步</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 详情内容 */}
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                  {/* 统计信息 */}
                  <div className="rounded-lg border">
                    <div className="grid grid-cols-2 divide-x">
                      <div className="p-4">
                        <div className="text-xs text-muted-foreground">状态</div>
                        <div className="text-lg font-semibold mt-1">
                          {selectedRepo.lastSyncedAt ? "已同步" : "未同步"}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="text-xs text-muted-foreground">最后同步</div>
                        <div className="text-lg font-semibold mt-1">
                          {selectedRepo.lastSyncedAt
                            ? new Date(selectedRepo.lastSyncedAt).toLocaleString("zh-CN")
                            : "-"}
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="p-4 space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Git 地址</span>
                        <div className="font-mono text-xs mt-1 break-all bg-muted p-2 rounded">
                          {selectedRepo.repoUrl}
                        </div>
                      </div>
                      {selectedRepo.localPath && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">本地路径</span>
                          <div className="font-mono text-xs mt-1 break-all bg-muted p-2 rounded">
                            {selectedRepo.localPath}
                          </div>
                        </div>
                      )}
                      {selectedRepo.commitHash && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Commit</span>
                          <div className="font-mono text-xs mt-1 break-all bg-muted p-2 rounded">
                            {selectedRepo.commitHash}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* 操作按钮 */}
              <div className="px-6 py-4 border-t flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRefresh(selectedRepo.id)}
                  disabled={refreshMutation.isPending}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1.5", refreshMutation.isPending && "animate-spin")} />
                  {refreshMutation.isPending ? "同步中..." : "同步仓库"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(selectedRepo)}
                >
                  <Settings className="h-4 w-4 mr-1.5" />
                  编辑配置
                </Button>
                <Link href={`/tools/nuclei/${selectedRepo.id}/`}>
                  <Button size="sm">
                    <FolderOpen className="h-4 w-4 mr-1.5" />
                    管理模板
                  </Button>
                </Link>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedRepo)}
                  disabled={deleteMutation.isPending}
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
                <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">选择左侧仓库查看详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open)
        if (!open) {
          resetCreateForm()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增 Nuclei 模板仓库</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateSubmit}>
            <div className="space-y-2">
              <Label htmlFor="nuclei-repo-name">仓库名称</Label>
              <Input
                id="nuclei-repo-name"
                type="text"
                placeholder="例如：默认 Nuclei 官方模板"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nuclei-repo-url">Git 仓库地址</Label>
              <Input
                id="nuclei-repo-url"
                type="text"
                placeholder="例如：https://github.com/projectdiscovery/nuclei-templates.git"
                value={newRepoUrl}
                onChange={(event) => setNewRepoUrl(event.target.value)}
              />
            </div>

            {/* 目前只支持公开仓库，这里不再提供认证方式和凭据配置 */}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={!newName.trim() || !newRepoUrl.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "创建中..." : "确认新增"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            resetEditForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑 Nuclei 仓库配置</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleEditSubmit}>
            <div className="space-y-1 text-sm text-muted-foreground">
              <span className="font-medium">仓库名称：</span>
              <span>{editingRepo?.name ?? ""}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-nuclei-repo-url">Git 仓库地址</Label>
              <Input
                id="edit-nuclei-repo-url"
                type="text"
                placeholder="例如：https://github.com/projectdiscovery/nuclei-templates.git"
                value={editRepoUrl}
                onChange={(event) => setEditRepoUrl(event.target.value)}
              />
            </div>

            {/* 编辑时也不再支持配置认证方式/凭据，仅允许修改 Git 地址 */}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={updateMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={!editRepoUrl.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? "保存中..." : "保存配置"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除仓库「{repoToDelete?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
