/**
 * WebSite 相关类型定义
 */

export interface WebSite {
  id: number
  scan?: number
  target?: number
  url: string
  location: string
  title: string
  webserver: string
  contentType: string
  statusCode: number
  contentLength: number
  bodyPreview: string
  tech: string[]
  vhost: boolean | null
  subdomain: string
  discoveredAt: string
}

export interface Technology {
  id: number
  name: string
  version?: string
  category?: string
}

export interface WebSiteFilters {
  url?: string
  title?: string
  statusCode?: number
  webserver?: string
  contentType?: string
}

export interface WebSiteListResponse {
  results: WebSite[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
