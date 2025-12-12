import validator from 'validator'
import { isIP } from 'is-ip'

/**
 * Endpoint 验证工具类
 * 提供严格的 URL 格式验证
 * 使用 validator.js 进行可靠的 URL 验证
 */

export interface EndpointValidationResult {
  isValid: boolean
  error?: string
  url?: URL
}

export class EndpointValidator {
  /**
   * 验证 Endpoint 是否为有效的 HTTP/HTTPS URL
   * @param urlString - 要验证的 URL 字符串
   * @returns 验证结果
   */
  static validate(urlString: string): EndpointValidationResult {
    // 1. 检查是否为空
    if (!urlString || urlString.trim().length === 0) {
      return {
        isValid: false,
        error: 'Endpoint 不能为空'
      }
    }

    const trimmedUrl = urlString.trim()

    // 2. 检查是否包含空格
    if (trimmedUrl.includes(' ')) {
      return {
        isValid: false,
        error: 'Endpoint 不能包含空格'
      }
    }

    // 3. 使用 validator.js 进行严格验证
    if (!validator.isURL(trimmedUrl, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      require_host: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false,
    })) {
      return {
        isValid: false,
        error: 'Endpoint 格式无效，必须是有效的 HTTP/HTTPS URL'
      }
    }

    // 4. 尝试解析 URL（双重验证）
    let parsedUrl: URL
    try {
      parsedUrl = new URL(trimmedUrl)
    } catch (error) {
      return {
        isValid: false,
        error: 'Endpoint 格式无效，无法解析'
      }
    }

    // 5. 验证协议
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        isValid: false,
        error: '只支持 HTTP 和 HTTPS 协议'
      }
    }

    // 6. 验证主机名
    if (!parsedUrl.hostname || parsedUrl.hostname.length === 0) {
      return {
        isValid: false,
        error: 'Endpoint 必须包含有效的主机名'
      }
    }

    // 7. 检查主机名格式（域名或 IP）
    if (!this.isValidHostname(parsedUrl.hostname)) {
      return {
        isValid: false,
        error: '主机名格式无效'
      }
    }

    // 8. 检查端口号（如果有）
    if (parsedUrl.port && !this.isValidPort(parsedUrl.port)) {
      return {
        isValid: false,
        error: '端口号无效（必须是 1-65535）'
      }
    }

    // 9. 检查路径（可选，但如果有必须有效）
    if (parsedUrl.pathname && parsedUrl.pathname.includes('..')) {
      return {
        isValid: false,
        error: 'Endpoint 路径不能包含 ".."'
      }
    }

    // 10. 检查是否包含危险字符
    if (this.containsDangerousCharacters(trimmedUrl)) {
      return {
        isValid: false,
        error: 'Endpoint 包含不安全的字符'
      }
    }

    return {
      isValid: true,
      url: parsedUrl
    }
  }

  /**
   * 批量验证 Endpoint 列表
   * @param urls - URL 字符串数组
   * @returns 验证结果数组
   */
  static validateBatch(urls: string[]): Array<EndpointValidationResult & { index: number; originalUrl: string }> {
    return urls.map((url, index) => ({
      ...this.validate(url),
      index,
      originalUrl: url
    }))
  }

  /**
   * 验证主机名是否有效（域名或 IP 地址）
   */
  private static isValidHostname(hostname: string): boolean {
    // 1) IP 校验（支持 IPv4/IPv6）
    if (isIP(hostname)) {
      return true
    }

    // 2) 域名校验（使用 validator 的 FQDN 校验）
    return validator.isFQDN(hostname, {
      require_tld: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_numeric_tld: false,
      allow_wildcard: false,
    })
  }

  /**
   * 验证端口号是否有效
   */
  private static isValidPort(port: string): boolean {
    const portNum = parseInt(port, 10)
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535
  }

  /**
   * 检查 URL 是否包含危险字符
   */
  private static containsDangerousCharacters(url: string): boolean {
    // 检查是否包含控制字符
    const controlCharRegex = /[\x00-\x1F\x7F]/
    if (controlCharRegex.test(url)) {
      return true
    }

    // 检查是否包含 JavaScript 协议
    if (url.toLowerCase().includes('javascript:')) {
      return true
    }

    // 检查是否包含 data 协议
    if (url.toLowerCase().includes('data:')) {
      return true
    }

    return false
  }

  /**
   * 格式化 Endpoint（规范化）
   */
  static normalize(urlString: string): string | null {
    const result = this.validate(urlString)
    if (!result.isValid || !result.url) {
      return null
    }

    // 返回规范化的 URL
    return result.url.href
  }

  /**
   * 提取 Endpoint 的各个部分
   */
  static parse(urlString: string): {
    protocol: string
    hostname: string
    port: string
    pathname: string
    search: string
    hash: string
  } | null {
    const result = this.validate(urlString)
    if (!result.isValid || !result.url) {
      return null
    }

    return {
      protocol: result.url.protocol,
      hostname: result.url.hostname,
      port: result.url.port,
      pathname: result.url.pathname,
      search: result.url.search,
      hash: result.url.hash
    }
  }
}
