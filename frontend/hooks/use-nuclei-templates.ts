"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getNucleiTemplateTree, getNucleiTemplateContent, refreshNucleiTemplates, saveNucleiTemplate, uploadNucleiTemplate } from "@/services/nuclei.service"
import type { NucleiTemplateTreeNode, NucleiTemplateContent, UploadNucleiTemplatePayload, SaveNucleiTemplatePayload } from "@/types/nuclei.types"

export function useNucleiTemplateTree() {
  return useQuery<NucleiTemplateTreeNode[]>({
    queryKey: ["nuclei", "templates", "tree"],
    queryFn: () => getNucleiTemplateTree(),
  })
}

export function useNucleiTemplateContent(path: string | null) {
  return useQuery<NucleiTemplateContent>({
    queryKey: ["nuclei", "templates", "content", path],
    queryFn: () => getNucleiTemplateContent(path as string),
    enabled: !!path,
  })
}

export function useRefreshNucleiTemplates() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => refreshNucleiTemplates(),
    onMutate: () => {
      toast.loading("正在更新 Nuclei 官方模板...", { id: "refresh-nuclei-templates" })
    },
    onSuccess: () => {
      toast.dismiss("refresh-nuclei-templates")
      toast.success("模板更新完成")
      queryClient.invalidateQueries({ queryKey: ["nuclei", "templates", "tree"] })
    },
    onError: () => {
      toast.dismiss("refresh-nuclei-templates")
      toast.error("模板更新失败")
    },
  })
}

export function useUploadNucleiTemplate() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, UploadNucleiTemplatePayload>({
    mutationFn: (payload) => uploadNucleiTemplate(payload),
    onMutate: () => {
      toast.loading("正在上传模板...", { id: "upload-nuclei-template" })
    },
    onSuccess: () => {
      toast.dismiss("upload-nuclei-template")
      toast.success("模板上传成功")
      queryClient.invalidateQueries({ queryKey: ["nuclei", "templates", "tree"] })
    },
    onError: (error) => {
      toast.dismiss("upload-nuclei-template")
      toast.error(error.message || "模板上传失败")
    },
  })
}

export function useSaveNucleiTemplate() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, SaveNucleiTemplatePayload>({
    mutationFn: (payload) => saveNucleiTemplate(payload),
    onMutate: () => {
      toast.loading("正在保存模板...", { id: "save-nuclei-template" })
    },
    onSuccess: (_data, variables) => {
      toast.dismiss("save-nuclei-template")
      toast.success("模板保存成功")
      queryClient.invalidateQueries({ queryKey: ["nuclei", "templates", "content", variables.path] })
    },
    onError: (error) => {
      toast.dismiss("save-nuclei-template")
      toast.error(error.message || "模板保存失败")
    },
  })
}
