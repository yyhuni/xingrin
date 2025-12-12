// 字典（Wordlist）相关类型

import type { PaginationInfo } from "@/types/common.types"

// 字典基础信息
export interface Wordlist {
  id: number
  name: string
  description?: string
  // 文件大小（字节），可选，由后端返回
  fileSize?: number
  // 行数，便于估算耗时，可选，由后端返回
  lineCount?: number
  // 文件 SHA-256 哈希，用于缓存校验
  fileHash?: string
  createdAt: string
  updatedAt: string
}

// 获取字典列表响应（遵循统一分页结构）
export interface GetWordlistsResponse extends PaginationInfo {
  results: Wordlist[]
}
