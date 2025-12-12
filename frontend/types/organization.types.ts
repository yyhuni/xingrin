import { ColumnDef } from "@tanstack/react-table"
import { PaginationInfo } from "./common.types"

// 组织统计数据
export interface OrganizationStats {
  totalDomains?: number    // 域名总数
  totalEndpoints?: number  // 端点总数
  totalTargets?: number    // 目标总数
}

// 组织相关类型定义（匹配后端 Organization 模型）
export interface Organization {
  id: number
  name: string
  description: string
  createdAt: string      // 后端 created_at 由 Django 自动转换为 camelCase
  updatedAt: string      // 后端 updated_at
  // 关联数据（通过 serializer 添加）
  targets?: Array<{
    id: number
    name: string
  }>
  // 统计数据（可选，通过聚合查询获取）
  stats?: OrganizationStats
  targetCount?: number   // 目标数量（用于列表展示）
  domainCount?: number   // 域名数量（用于列表展示）
  endpointCount?: number // 端点数量（用于列表展示）
}

// 组织列表响应类型（匹配后端实际响应格式）
export interface OrganizationsResponse<T = Organization> {
  results: T[]          // 组织数据列表
  total: number         // 总记录数（后端实际字段）
  page: number          // 当前页码
  pageSize: number      // 每页大小
  totalPages: number    // 总页数
  // 兼容字段
  count?: number        // DRF 标准字段（向后兼容）
  next?: string | null   // 下一页链接（DRF 标准字段）
  previous?: string | null // 上一页链接（DRF 标准字段）
  organizations?: T[]
  pagination?: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}


// 创建组织请求类型
export interface CreateOrganizationRequest {
  name: string
  description: string
}

// 更新组织请求类型
export interface UpdateOrganizationRequest {
  name: string
  description: string
}

// 组织数据表格组件属性类型定义
export interface OrganizationDataTableProps {
  data: Organization[]                           // 组织数据数组
  columns: ColumnDef<Organization>[]             // 列定义数组
  onAddNew?: () => void                          // 添加新组织的回调函数
  onBulkDelete?: () => void                      // 批量删除回调函数
  onSelectionChange?: (selectedRows: Organization[]) => void  // 选中行变化回调
  searchPlaceholder?: string                     // 搜索框占位符
  searchColumn?: string                          // 搜索的列名
  searchValue?: string                           // 受控：搜索框当前值（服务端搜索）
  onSearch?: (value: string) => void             // 受控：搜索框变更回调（服务端搜索）
  isSearching?: boolean                          // 搜索中状态（显示加载动画）
  // 添加分页相关属性
  pagination?: {
    pageIndex: number
    pageSize: number
  }
  setPagination?: (pagination: { pageIndex: number; pageSize: number }) => void
  paginationInfo?: PaginationInfo
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
}
