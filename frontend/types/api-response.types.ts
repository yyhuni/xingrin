// 通用API响应类型
export interface ApiResponse<T = any> {
  code: string;          // HTTP状态码，如 "200", "400", "500"
  state: string;         // 业务状态，如 "success", "error"
  message: string;       // 响应消息
  data?: T;              // 响应数据
}

// 通用批量创建响应数据（对应后端 BaseBatchCreateResponseData）
// 适用于：域名、端点等批量创建操作
export interface BatchCreateResponse {
  message: string          // 详细说明，如 "成功处理 5 个域名，新创建 3 个，2 个已存在，1 个已跳过"
  requestedCount: number   // 请求创建的总数量
  createdCount: number     // 新创建的数量
  existedCount: number     // 已存在的数量
  skippedCount?: number    // 跳过的数量（可选）
  skippedDomains?: Array<{  // 跳过的域名列表（可选）
    name: string
    reason: string
  }>
}
