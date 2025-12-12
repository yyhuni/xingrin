"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  getWordlists,
  uploadWordlist,
  deleteWordlist,
  getWordlistContent,
  updateWordlistContent,
} from "@/services/wordlist.service"
import type { GetWordlistsResponse, Wordlist } from "@/types/wordlist.types"

// 获取字典列表
export function useWordlists(params?: { page?: number; pageSize?: number }) {
  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 10

  return useQuery<GetWordlistsResponse>({
    queryKey: ["wordlists", { page, pageSize }],
    queryFn: () => getWordlists(page, pageSize),
  })
}

// 上传字典
export function useUploadWordlist() {
  const queryClient = useQueryClient()

  return useMutation<{}, Error, { name: string; description?: string; file: File }>({
    mutationFn: (payload) => uploadWordlist(payload),
    onMutate: () => {
      toast.loading("正在上传字典...", { id: "upload-wordlist" })
    },
    onSuccess: () => {
      toast.dismiss("upload-wordlist")
      toast.success("字典上传成功")
      queryClient.invalidateQueries({ queryKey: ["wordlists"] })
    },
    onError: (error) => {
      toast.dismiss("upload-wordlist")
      toast.error(`上传失败: ${error.message}`)
    },
  })
}

// 删除字典
export function useDeleteWordlist() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, number>({
    mutationFn: (id: number) => deleteWordlist(id),
    onMutate: (id) => {
      toast.loading("正在删除字典...", { id: `delete-wordlist-${id}` })
    },
    onSuccess: (_data, id) => {
      toast.dismiss(`delete-wordlist-${id}`)
      toast.success("字典删除成功")
      queryClient.invalidateQueries({ queryKey: ["wordlists"] })
    },
    onError: (error, id) => {
      toast.dismiss(`delete-wordlist-${id}`)
      toast.error(`删除失败: ${error.message}`)
    },
  })
}

// 获取字典内容
export function useWordlistContent(id: number | null) {
  return useQuery<string>({
    queryKey: ["wordlist-content", id],
    queryFn: () => getWordlistContent(id!),
    enabled: id !== null,
  })
}

// 更新字典内容
export function useUpdateWordlistContent() {
  const queryClient = useQueryClient()

  return useMutation<Wordlist, Error, { id: number; content: string }>({
    mutationFn: ({ id, content }) => updateWordlistContent(id, content),
    onMutate: () => {
      toast.loading("正在保存...", { id: "update-wordlist-content" })
    },
    onSuccess: (data) => {
      toast.dismiss("update-wordlist-content")
      toast.success("字典保存成功")
      queryClient.invalidateQueries({ queryKey: ["wordlists"] })
      queryClient.invalidateQueries({ queryKey: ["wordlist-content", data.id] })
    },
    onError: (error) => {
      toast.dismiss("update-wordlist-content")
      toast.error(`保存失败: ${error.message}`)
    },
  })
}
