import { api } from "@/lib/api-client"

/** 目录相关 API 服务 */
export class DirectoryService {
  /** 按目标导出所有目录 URL（文本文件，一行一个） */
  static async exportDirectoriesByTargetId(targetId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/targets/${targetId}/directories/export/`, {
      responseType: "blob",
    })
    return response.data
  }

  /** 按扫描任务导出所有目录 URL（文本文件，一行一个） */
  static async exportDirectoriesByScanId(scanId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/scans/${scanId}/directories/export/`, {
      responseType: "blob",
    })
    return response.data
  }
}
