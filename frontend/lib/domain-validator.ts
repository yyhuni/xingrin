import validator from 'validator'
import { parse as parseDomain } from 'tldts'

/**
 * 域名验证工具类
 * 使用 validator.js 进行可靠的域名验证
 */

export interface DomainValidationResult {
  isValid: boolean
  error?: string
}

export class DomainValidator {
  /**
   * 验证域名格式（如 example.com）
   * @param domain - 要验证的域名字符串
   * @returns 验证结果
   */
  static validateDomain(domain: string): DomainValidationResult {
    // 1. 检查是否为空
    if (!domain || domain.trim().length === 0) {
      return {
        isValid: false,
        error: '域名不能为空'
      }
    }

    const trimmedDomain = domain.trim()

    // 2. 检查是否包含空格
    if (trimmedDomain.includes(' ')) {
      return {
        isValid: false,
        error: '域名不能包含空格'
      }
    }

    // 3. 检查长度（使用 validator 包）
    if (!validator.isLength(trimmedDomain, { min: 1, max: 253 })) {
      return {
        isValid: false,
        error: '域名长度不能超过 253 个字符'
      }
    }

    // 4. 使用 tldts 做域名语义校验（优先）
    const info = parseDomain(trimmedDomain)
    if (!info.domain || info.isIp === true) {
      return {
        isValid: false,
        error: '域名格式无效'
      }
    }

    // 5. 使用 validator.js 的 isFQDN 兜底，确保严格性
    if (!validator.isFQDN(trimmedDomain, {
      require_tld: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_numeric_tld: false,
      allow_wildcard: false,
    })) {
      return {
        isValid: false,
        error: '域名格式无效'
      }
    }

    return { isValid: true }
  }

  /**
   * 验证子域名格式（如 www.example.com, api.test.org）
   * @param subdomain - 要验证的子域名字符串
   * @returns 验证结果
   */
  static validateSubdomain(subdomain: string): DomainValidationResult {
    // 先进行基本域名验证
    const basicValidation = this.validateDomain(subdomain)
    if (!basicValidation.isValid) {
      return basicValidation
    }

    // 子域名必须至少包含 3 个部分（如 www.example.com）
    const labels = subdomain.trim().split('.')
    if (labels.length < 3) {
      return {
        isValid: false,
        error: '子域名必须至少包含 3 个部分（如 www.example.com）'
      }
    }

    return {
      isValid: true
    }
  }

  /**
   * 批量验证域名列表
   * @param domains - 域名字符串数组
   * @returns 验证结果数组
   */
  static validateDomainBatch(domains: string[]): Array<DomainValidationResult & { index: number; originalDomain: string }> {
    return domains.map((domain, index) => ({
      ...this.validateDomain(domain),
      index,
      originalDomain: domain
    }))
  }

  /**
   * 批量验证子域名列表
   * @param subdomains - 子域名字符串数组
   * @returns 验证结果数组
   */
  static validateSubdomainBatch(subdomains: string[]): Array<DomainValidationResult & { index: number; originalDomain: string }> {
    return subdomains.map((subdomain, index) => ({
      ...this.validateSubdomain(subdomain),
      index,
      originalDomain: subdomain
    }))
  }

  /**
   * 规范化域名（转换为小写）
   */
  static normalize(domain: string): string | null {
    const result = this.validateDomain(domain)
    if (!result.isValid) {
      return null
    }
    return domain.trim().toLowerCase()
  }

  /**
   * 从子域名中提取根域名（使用 PSL - Public Suffix List）
   * @param subdomain - 子域名（如 www.example.com, blog.github.io）
   * @returns 根域名（如 example.com, blog.github.io）或 null
   * 
   * 示例：
   * - www.example.com → example.com
   * - api.test.example.com → example.com
   * - blog.github.io → blog.github.io (正确处理公共后缀)
   * - www.bbc.co.uk → bbc.co.uk (正确处理多级 TLD)
   */
  static extractRootDomain(subdomain: string): string | null {
    const trimmed = subdomain.trim().toLowerCase()
    if (!trimmed) return null

    // 使用 tldts 解析域名
    const parsed = parseDomain(trimmed)
    if (!parsed.domain) {
      return null
    }
    return parsed.domain
  }

  /**
   * 将子域名列表按根域名分组
   * @param subdomains - 子域名列表
   * @returns { grouped: Map<根域名, 子域名[]>, invalid: 无效的子域名[] }
   */
  static groupSubdomainsByRootDomain(subdomains: string[]): {
    grouped: Map<string, string[]>
    invalid: string[]
  } {
    const grouped = new Map<string, string[]>()
    const invalid: string[] = []
    
    for (const subdomain of subdomains) {
      const rootDomain = this.extractRootDomain(subdomain)
      
      if (!rootDomain) {
        invalid.push(subdomain)
        continue
      }
      
      if (!grouped.has(rootDomain)) {
        grouped.set(rootDomain, [])
      }
      
      grouped.get(rootDomain)!.push(subdomain)
    }
    
    return { grouped, invalid }
  }

  /**
   * 检查子域名是否属于指定的根域名
   * @param subdomain - 子域名（如 www.example.com, api.example.com）
   * @param rootDomain - 根域名（如 example.com）
   * @returns 是否属于该根域名
   * 
   * 示例：
   * - isSubdomainOf('www.example.com', 'example.com') → true
   * - isSubdomainOf('api.test.example.com', 'example.com') → true
   * - isSubdomainOf('www.test.com', 'example.com') → false
   */
  static isSubdomainOf(subdomain: string, rootDomain: string): boolean {
    const trimmedSubdomain = subdomain.trim().toLowerCase()
    const trimmedRootDomain = rootDomain.trim().toLowerCase()
    
    if (!trimmedSubdomain || !trimmedRootDomain) {
      return false
    }
    
    // 提取子域名的根域名
    const extractedRoot = this.extractRootDomain(trimmedSubdomain)
    
    // 比较提取的根域名与目标根域名
    return extractedRoot === trimmedRootDomain
  }
}
