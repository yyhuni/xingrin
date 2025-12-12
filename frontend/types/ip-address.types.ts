export interface Port {
  number: number
  serviceName: string
  description: string
  isUncommon: boolean
}

export interface IPAddress {
  ip: string  // IP 地址（唯一标识）
  hosts: string[]  // 关联的主机名列表
  ports: number[]  // 关联的端口列表
  discoveredAt: string  // 首次发现时间
}

export interface GetIPAddressesParams {
  page?: number
  pageSize?: number
  search?: string
}

export interface GetIPAddressesResponse {
  results: IPAddress[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
