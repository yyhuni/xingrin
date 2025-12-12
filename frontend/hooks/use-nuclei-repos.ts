/**
 * Nuclei 模板仓库相关 Hooks
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { nucleiRepoApi } from "../services/nuclei-repo.api"
import type { NucleiTemplateTreeNode, NucleiTemplateContent } from "@/types/nuclei.types"

// ==================== 仓库 CRUD ====================

export interface NucleiRepo {
  id: number
  name: string
  repoUrl: string
  localPath: string
  commitHash: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 获取仓库列表 */
export function useNucleiRepos() {
  return useQuery<NucleiRepo[]>({
    queryKey: ["nuclei-repos"],
    queryFn: nucleiRepoApi.listRepos,
  })
}

/** 获取单个仓库详情 */
export function useNucleiRepo(repoId: number | null) {
  return useQuery<NucleiRepo>({
    queryKey: ["nuclei-repos", repoId],
    queryFn: () => nucleiRepoApi.getRepo(repoId!),
    enabled: !!repoId,
  })
}

/** 创建仓库 */
export function useCreateNucleiRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: nucleiRepoApi.createRepo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nuclei-repos"] })
    },
  })
}

/** 更新仓库 */
export function useUpdateNucleiRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      id: number
      repoUrl?: string
    }) => nucleiRepoApi.updateRepo(data.id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["nuclei-repos"] })
      queryClient.invalidateQueries({ queryKey: ["nuclei-repos", variables.id] })
    },
  })
}

/** 删除仓库 */
export function useDeleteNucleiRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: nucleiRepoApi.deleteRepo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nuclei-repos"] })
    },
  })
}

// ==================== Git 同步 ====================

/** 刷新仓库（Git clone/pull） */
export function useRefreshNucleiRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: nucleiRepoApi.refreshRepo,
    onSuccess: (_data, repoId) => {
      // 刷新仓库列表（last_synced_at 会更新）
      queryClient.invalidateQueries({ queryKey: ["nuclei-repos"] })
      queryClient.invalidateQueries({ queryKey: ["nuclei-repos", repoId] })
      queryClient.invalidateQueries({ queryKey: ["nuclei-repo-tree", repoId] })
    },
  })
}

// ==================== 模板只读 ====================

/** 获取仓库模板目录树 */
export function useNucleiRepoTree(repoId: number | null) {
  return useQuery({
    queryKey: ["nuclei-repo-tree", repoId],
    queryFn: async () => {
      const res = await nucleiRepoApi.getTemplateTree(repoId!)
      return (res.roots ?? []) as NucleiTemplateTreeNode[]
    },
    enabled: !!repoId,
  })
}

/** 获取模板文件内容 */
export function useNucleiRepoContent(repoId: number | null, path: string | null) {
  return useQuery<NucleiTemplateContent>({
    queryKey: ["nuclei-repo-content", repoId, path],
    queryFn: () => nucleiRepoApi.getTemplateContent(repoId!, path!),
    enabled: !!repoId && !!path,
  })
}
