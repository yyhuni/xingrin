import validator from 'validator'
import { parse as parseDomain } from 'tldts'

/**
 * 目标验证工具类
 * 支持验证三种目标类型：域名、IP、CIDR
 */

export interface TargetValidationResult {
  isValid: boolean
  error?: string
  type?: 'domain' | 'ip' | 'cidr'
}

export class TargetValidator {
  /**
   * 验证域名格式（如 example.com）
   */
  static validateDomain(domain: string): TargetValidationResult {
    if (!domain || domain.trim().length === 0) {
      return {
        isValid: false,
        error: '目标不能为空'
      }
    }

    const trimmedDomain = domain.trim()

    if (trimmedDomain.includes(' ')) {
      return {
        isValid: false,
        error: '目标不能包含空格'
      }
    }

    if (!validator.isLength(trimmedDomain, { min: 1, max: 253 })) {
      return {
        isValid: false,
        error: '目标长度不能超过 253 个字符'
      }
    }

    const info = parseDomain(trimmedDomain)
    if (!info.domain || info.isIp === true) {
      return {
        isValid: false,
        error: '域名格式无效'
      }
    }

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

    return { isValid: true, type: 'domain' }
  }

  /**
   * 验证 IPv4 地址（如 192.168.1.1）
   */
  static validateIPv4(ip: string): TargetValidationResult {
    if (!ip || ip.trim().length === 0) {
      return {
        isValid: false,
        error: '目标不能为空'
      }
    }

    const trimmedIP = ip.trim()

    if (!validator.isIP(trimmedIP, 4)) {
      return {
        isValid: false,
        error: 'IPv4 地址格式无效'
      }
    }

    return { isValid: true, type: 'ip' }
  }

  /**
   * 验证 IPv6 地址（如 2001:db8::1）
   */
  static validateIPv6(ip: string): TargetValidationResult {
    if (!ip || ip.trim().length === 0) {
      return {
        isValid: false,
        error: '目标不能为空'
      }
    }

    const trimmedIP = ip.trim()

    if (!validator.isIP(trimmedIP, 6)) {
      return {
        isValid: false,
        error: 'IPv6 地址格式无效'
      }
    }

    return { isValid: true, type: 'ip' }
  }

  /**
   * 验证 IP 地址（IPv4 或 IPv6）
   */
  static validateIP(ip: string): TargetValidationResult {
    if (!ip || ip.trim().length === 0) {
      return {
        isValid: false,
        error: '目标不能为空'
      }
    }

    const trimmedIP = ip.trim()

    if (!validator.isIP(trimmedIP)) {
      return {
        isValid: false,
        error: 'IP 地址格式无效'
      }
    }

    return { isValid: true, type: 'ip' }
  }

  /**
   * 验证 CIDR 网段（如 10.0.0.0/8, 192.168.0.0/16）
   */
  static validateCIDR(cidr: string): TargetValidationResult {
    if (!cidr || cidr.trim().length === 0) {
      return {
        isValid: false,
        error: '目标不能为空'
      }
    }

    const trimmedCIDR = cidr.trim()

    // 检查是否包含 /
    if (!trimmedCIDR.includes('/')) {
      return {
        isValid: false,
        error: 'CIDR 格式无效，应包含 /'
      }
    }

    const [ip, prefix] = trimmedCIDR.split('/')

    // 验证 IP 部分
    if (!validator.isIP(ip.trim())) {
      return {
        isValid: false,
        error: 'CIDR 中的 IP 地址格式无效'
      }
    }

    // 验证前缀长度
    const prefixNum = parseInt(prefix, 10)
    if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 32) {
      return {
        isValid: false,
        error: 'CIDR 前缀长度必须在 0-32 之间'
      }
    }

    return { isValid: true, type: 'cidr' }
  }

  /**
   * 自动检测目标类型并验证
   * 支持：域名、IPv4、IPv6、CIDR
   */
  static validateTarget(target: string): TargetValidationResult {
    if (!target || target.trim().length === 0) {
      return {
        isValid: false,
        error: '目标不能为空'
      }
    }

    const trimmedTarget = target.trim()

    // 1. 先尝试 CIDR 验证（包含 /）
    if (trimmedTarget.includes('/')) {
      return this.validateCIDR(trimmedTarget)
    }

    // 2. 尝试 IP 验证
    if (validator.isIP(trimmedTarget)) {
      return this.validateIP(trimmedTarget)
    }

    // 3. 尝试域名验证
    return this.validateDomain(trimmedTarget)
  }

  /**
   * 批量验证目标列表
   */
  static validateTargetBatch(targets: string[]): Array<TargetValidationResult & { index: number; originalTarget: string }> {
    return targets.map((target, index) => ({
      ...this.validateTarget(target),
      index,
      originalTarget: target
    }))
  }
}
