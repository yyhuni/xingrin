import apiClient from "@/lib/api-client"
import type { GetWordlistsResponse, Wordlist } from "@/types/wordlist.types"

// 字典（Wordlist） API 服务

// 获取字典列表
export async function getWordlists(page = 1, pageSize = 10): Promise<GetWordlistsResponse> {
  const response = await apiClient.get<GetWordlistsResponse>("/wordlists/", {
    params: {
      page,
      pageSize,
    },
  })
  return response.data
}

// 上传字典文件
export async function uploadWordlist(payload: {
  name: string
  description?: string
  file: File
}): Promise<Wordlist> {
  const formData = new FormData()
  formData.append("name", payload.name)
  if (payload.description) {
    formData.append("description", payload.description)
  }
  formData.append("file", payload.file)

  const response = await apiClient.post<Wordlist>("/wordlists/", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })

  return response.data
}

// 删除字典
export async function deleteWordlist(id: number): Promise<void> {
  await apiClient.delete(`/wordlists/${id}/`)
}

// 获取字典内容
export async function getWordlistContent(id: number): Promise<string> {
  const response = await apiClient.get<{ content: string }>(`/wordlists/${id}/content/`)
  return response.data.content
}

// 更新字典内容
export async function updateWordlistContent(id: number, content: string): Promise<Wordlist> {
  const response = await apiClient.put<Wordlist>(`/wordlists/${id}/content/`, { content })
  return response.data
}
