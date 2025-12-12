/**
 * 扫描引擎类型定义
 * 
 * 后端实际返回字段: id, name, configuration, created_at, updated_at
 */

// 扫描引擎接口
export interface ScanEngine {
  id: number
  name: string
  configuration?: string   // YAML 配置内容
  createdAt: string
  updatedAt: string
}

// 创建引擎请求
export interface CreateEngineRequest {
  name: string
  configuration: string
}

// 更新引擎请求
export interface UpdateEngineRequest {
  name?: string
  configuration?: string
}

