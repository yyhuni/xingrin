import { ColumnDef } from "@tanstack/react-table"
import { PaginationParams, PaginationInfo } from "./common.types"
import type { Organization } from "./organization.types"
import type { BatchCreateResponse } from "./api-response.types"
import type { Port } from "./ip-address.types"

// 子域名相关类型定义（由原 domain.types.ts 重命名而来）

// 基础子域名类型（与前端驼峰命名规范一致）
// 注意：后端返回 snake_case，但响应拦截器会自动转换为 camelCase
export interface Subdomain {
  id: number
  name: string
  createdAt: string  // 创建时间
}

// 获取子域名列表请求参数
export interface GetSubdomainsParams extends PaginationParams {
  organizationId: number
}

// 获取子域名列表响应（字段 domains 保持与后端一致）
export interface GetSubdomainsResponse {
  domains: Subdomain[]
  total: number
  page: number
  pageSize: number      // [OK] 使用驼峰命名
  totalPages: number    // [OK] 使用驼峰命名
}

// 获取所有子域名请求参数
// 后端固定按更新时间降序排列，不支持自定义排序
export interface GetAllSubdomainsParams {
  page?: number
  pageSize?: number
  search?: string
}

// 获取所有子域名响应（字段 domains 保持与后端一致）
export interface GetAllSubdomainsResponse {
  domains: Subdomain[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 获取单个子域名详情响应（后端直接返回对象）
export type GetSubdomainByIDResponse = Subdomain

// 子域名数据表格组件属性类型定义
export interface SubdomainDataTableProps {
  data: Subdomain[]                           // 子域名数据数组
  columns: ColumnDef<Subdomain>[]             // 列定义数组
  onAddNew?: () => void                       // 添加新子域名的回调函数
  onBulkDelete?: () => void                   // 批量删除回调函数
  onSelectionChange?: (selectedRows: Subdomain[]) => void  // 选中行变化回调
  searchPlaceholder?: string                  // 搜索框占位符
  searchColumn?: string                       // 搜索的列名
  // 添加分页相关属性
  pagination?: {
    pageIndex: number
    pageSize: number
  }
  setPagination?: (pagination: { pageIndex: number; pageSize: number }) => void
  paginationInfo?: PaginationInfo
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
}

// 子域名批量创建响应（复用通用类型）
export type BatchCreateSubdomainsResponse = BatchCreateResponse
