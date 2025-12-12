// 工具类型枚举
export type ToolType = 'opensource' | 'custom'

// 工具类型定义（匹配前端 camelCase 转换后的格式）
// 注意：后端返回 snake_case，api-client.ts 自动转换为 camelCase
export interface Tool {
  id: number
  name: string                 // 工具名称
  type: ToolType              // 工具类型：opensource/custom（后端: type）
  repoUrl: string             // 仓库地址（后端: repo_url）
  version: string              // 版本号
  description: string          // 工具描述
  categoryNames: string[]      // 分类标签数组（后端: category_names）
  directory: string            // 工具路径（后端: directory）
  installCommand: string       // 安装命令（后端: install_command）
  updateCommand: string        // 更新命令（后端: update_command）
  versionCommand: string       // 版本查询命令（后端: version_command）
  createdAt: string           // 后端: created_at
  updatedAt: string           // 后端: updated_at
}

// 工具分类名称到中文的映射
// 所有分类参考后端模型设计文档
export const CategoryNameMap: Record<string, string> = {
  subdomain: '子域名扫描',
  vulnerability: '漏洞扫描',
  port: '端口扫描',
  directory: '目录扫描',
  dns: 'DNS解析',
  http: 'HTTP探测',
  crawler: '网页爬虫',
  recon: '信息收集',
  fuzzer: '模糊测试',
  wordlist: '字典生成',
  screenshot: '截图工具',
  exploit: '漏洞利用',
  network: '网络扫描',
  other: '其他',
}

// 工具列表响应类型（api-client.ts 会自动转换为 camelCase）
export interface GetToolsResponse {
  tools: Tool[]
  total: number
  page: number
  pageSize: number      // 后端返回 camelCase 格式
  totalPages: number    // 后端返回 camelCase 格式
  // 兼容字段（向后兼容）
  page_size?: number
  total_pages?: number
}

// 创建工具请求类型
export interface CreateToolRequest {
  name: string
  type: ToolType              // 工具类型（必填）
  repoUrl?: string
  version?: string
  description?: string
  categoryNames?: string[]    // 分类标签数组
  directory?: string          // 工具路径（自定义工具必填）
  installCommand?: string     // 安装命令（开源工具必填）
  updateCommand?: string      // 更新命令（开源工具必填）
  versionCommand?: string     // 版本查询命令（开源工具必填）
}

// 更新工具请求类型
export interface UpdateToolRequest {
  name?: string
  type?: ToolType             // 工具类型（用于验证命令字段）
  repoUrl?: string
  version?: string
  description?: string
  categoryNames?: string[]    // 分类标签数组
  directory?: string          // 工具路径
  installCommand?: string     // 安装命令
  updateCommand?: string      // 更新命令
  versionCommand?: string     // 版本查询命令
}

// 工具查询参数
// 后端固定按更新时间降序排列，不支持自定义排序
export interface GetToolsParams {
  page?: number
  pageSize?: number
}

// 工具过滤类型
export type ToolFilter = 'all' | 'default' | 'custom'
