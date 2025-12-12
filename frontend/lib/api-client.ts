/**
 * API 客户端配置文件
 * 
 * 核心功能：
 * 1. 统一的 HTTP 请求封装
 * 2. 统一错误处理
 * 3. 请求/响应日志记录
 * 
 * 命名规范说明：
 * - 前端（TypeScript/React）：驼峰命名 camelCase
 *   例如：pageSize, createdAt, organizationId
 * 
 * - 后端（Django/Python）：下划线命名 snake_case（模型字段）
 *   例如：page_size, created_at, organization_id
 * 
 * - API JSON 格式：驼峰命名 camelCase（已由后端自动转换）
 *   例如：pageSize, createdAt, organizationId
 * 
 * 命名转换机制：
 * ══════════════════════════════════════════════════════════════════════
 * 【后端处理】Django REST Framework + djangorestframework-camel-case
 * ══════════════════════════════════════════════════════════════════════
 * 
 * 1. 前端发送请求（camelCase）：
 *    { pageSize: 10, sortBy: "name" }
 *    
 * 2. Django 接收并自动转换为 snake_case：
 *    { page_size: 10, sort_by: "name" }
 *    
 * 3. Django 处理后端逻辑（使用 snake_case 模型字段）
 * 
 * 4. Django 返回数据时自动转换为 camelCase：
 *    { pageSize: 10, createdAt: "2024-01-01" }
 *    
 * 5. 前端直接使用（camelCase）：
 *    response.data.pageSize  // [OK] 直接使用
 * 
 * [NOTE] 关键点：命名转换由后端统一处理，前端无需转换
 */

import axios, { AxiosRequestConfig } from 'axios';

/**
 * 创建 axios 实例
 * 配置基础 URL、超时时间和默认请求头
 */
const apiClient = axios.create({
  baseURL: '/api',  // API 基础路径
  timeout: 30000,      // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器：处理请求前的准备工作
 * 
 * 工作流程：
 * 1. 确保 URL 格式正确（Django 要求末尾斜杠）
 * 2. 记录请求日志（开发调试用）
 * 
 * 注意事项：
 * - 命名转换由后端处理，前端无需转换
 * - 前端直接使用 camelCase 命名即可
 */
apiClient.interceptors.request.use(
  (config) => {
    // 只在开发环境输出调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[REQUEST] API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        data: config.data,
        params: config.params
      });
    }

    return config;
  },
  (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ERROR] Request Error:', error);
    }
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器：处理响应数据
 * 
 * 工作流程：
 * 1. 记录响应日志（开发调试用）
 * 2. 返回响应数据（后端已转换为 camelCase）
 * 
 * 注意事项：
 * - 后端已自动将 snake_case 转换为 camelCase
 * - 前端直接使用即可，无需额外转换
 */
apiClient.interceptors.response.use(
  (response) => {
    // 只在开发环境输出调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[RESPONSE] API Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.config.url,
        data: response.data
      });
    }

    return response;
  },
  (error) => {
    // 只在开发环境输出错误日志
    if (process.env.NODE_ENV === 'development') {
      // 检查是否是 Axios 错误
      if (axios.isAxiosError(error)) {
        console.error('[ERROR] API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method,
          data: error.response?.data,
          message: error.message,
          code: error.code
        });
      } else if (error instanceof Error) {
        // 普通 Error 对象
        console.error('[ERROR] API Error:', error.message, error.stack);
      } else {
        // 未知错误类型
        console.error('[ERROR] API Error: Unknown error', String(error));
      }
    }

    return Promise.reject(error);
  }
);

// 导出默认的 axios 实例（一般不直接使用）
export default apiClient;

/**
 * 导出常用的 HTTP 方法
 * 
 * 使用示例：
 * 
 * 1. GET 请求：
 *    api.get('/organizations', { 
 *      params: { pageSize: 10, sortBy: 'name' }  // 使用 camelCase
 *    })
 *    后端接收：page_size=10&sort_by=name（自动转换）
 * 
 * 2. POST 请求：
 *    api.post('/organizations/create', {
 *      organizationName: 'test',  // 使用 camelCase
 *      createdAt: '2024-01-01'
 *    })
 *    后端接收：organization_name, created_at（自动转换）
 * 
 * 3. 响应数据（已经是 camelCase）：
 *    const response = await api.get('/organizations')
 *    response.data.pageSize  // [OK] 直接使用 camelCase
 *    response.data.createdAt // [OK] 直接使用 camelCase
 * 
 * 类型参数：
 * - T: 响应数据的类型（可选）
 * - config: axios 配置对象（可选）
 */
export const api = {
  /**
   * GET 请求
   * @param url - 请求路径（相对于 baseURL）
   * @param config - axios 配置，建议使用 params 传递查询参数
   * @returns Promise<AxiosResponse<T>>
   */
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => apiClient.get<T>(url, config),

  /**
   * POST 请求
   * @param url - 请求路径（相对于 baseURL）
   * @param data - 请求体数据（会自动转换为 snake_case）
   * @param config - axios 配置（可选）
   * @returns Promise<AxiosResponse<T>>
   */
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => apiClient.post<T>(url, data, config),

  /**
   * PUT 请求
   * @param url - 请求路径（相对于 baseURL）
   * @param data - 请求体数据（会自动转换为 snake_case）
   * @param config - axios 配置（可选）
   * @returns Promise<AxiosResponse<T>>
   */
  put: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => apiClient.put<T>(url, data, config),

  /**
   * PATCH 请求（部分更新）
   * @param url - 请求路径（相对于 baseURL）
   * @param data - 请求体数据（会自动转换为 snake_case）
   * @param config - axios 配置（可选）
   * @returns Promise<AxiosResponse<T>>
   */
  patch: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => apiClient.patch<T>(url, data, config),

  /**
   * DELETE 请求
   * @param url - 请求路径（相对于 baseURL）
   * @param config - axios 配置（可选）
   * @returns Promise<AxiosResponse<T>>
   */
  delete: <T = unknown>(url: string, config?: AxiosRequestConfig) => apiClient.delete<T>(url, config),
};

/**
 * 错误处理工具函数
 * 
 * 功能：从错误对象中提取用户友好的错误消息
 * 
 * 错误优先级：
 * 1. 请求取消
 * 2. 请求超时
 * 3. 后端返回的错误消息
 * 4. axios 错误消息
 * 5. 未知错误
 * 
 * 使用示例：
 * try {
 *   await api.get('/organizations')
 * } catch (error) {
 *   const message = getErrorMessage(error)
 *   toast.error(message)
 * }
 * 
 * @param error - 错误对象（可以是任意类型）
 * @returns 用户友好的错误消息字符串
 */
export const getErrorMessage = (error: unknown): string => {
  // 请求被取消（用户主动取消或组件卸载）
  if (axios.isCancel(error)) {
    return '请求已被取消';
  }

  // 类型守卫：检查是否为错误对象
  const err = error as {
    code?: string;
    response?: { data?: { message?: string; error?: string; detail?: string } };
    message?: string
  }

  // 请求超时（超过 30 秒）
  if (err.code === 'ECONNABORTED') {
    return '请求超时，请稍后重试';
  }

  // 后端返回的错误消息（支持多种格式）
  if (err.response?.data?.error) {
    return err.response.data.error;
  }
  if (err.response?.data?.message) {
    return err.response.data.message;
  }
  if (err.response?.data?.detail) {
    return err.response.data.detail;
  }

  // axios 自身的错误消息
  if (err.message) {
    return err.message;
  }

  // 兜底错误消息
  return '发生未知错误';
};
