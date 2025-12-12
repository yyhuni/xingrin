import { api } from "@/lib/api-client"
import type { GetIPAddressesParams, GetIPAddressesResponse } from "@/types/ip-address.types"

export class IPAddressService {
  static async getTargetIPAddresses(
    targetId: number,
    params?: GetIPAddressesParams
  ): Promise<GetIPAddressesResponse> {
    const response = await api.get<GetIPAddressesResponse>(`/targets/${targetId}/ip-addresses/`, {
      params: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        ...(params?.search && { search: params.search }),
      },
    })
    return response.data
  }

  static async getScanIPAddresses(
    scanId: number,
    params?: GetIPAddressesParams
  ): Promise<GetIPAddressesResponse> {
    const response = await api.get<GetIPAddressesResponse>(`/scans/${scanId}/ip-addresses/`, {
      params: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        ...(params?.search && { search: params.search }),
      },
    })
    return response.data
  }

  /** 按目标导出所有 IP 地址（文本文件，一行一个） */
  static async exportIPAddressesByTargetId(targetId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/targets/${targetId}/ip-addresses/export/`, {
      responseType: 'blob',
    })
    return response.data
  }

  /** 按扫描任务导出所有 IP 地址（文本文件，一行一个） */
  static async exportIPAddressesByScanId(scanId: number): Promise<Blob> {
    const response = await api.get<Blob>(`/scans/${scanId}/ip-addresses/export/`, {
      responseType: 'blob',
    })
    return response.data
  }
}
