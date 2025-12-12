"""
配置解析器

负责解析引擎配置（YAML）并提取启用的工具及其配置。

架构说明：
- 命令模板：在 command_templates.py 中定义（基础命令 + 可选参数映射）
- 工具配置：从引擎配置（engine_config YAML 字符串）读取
- 无默认配置文件：所有配置必须在引擎配置中提供

核心函数：
- parse_enabled_tools_from_dict(): 解析并过滤启用的工具，返回工具配置字典

返回格式：
- {'subfinder': {'enabled': True, 'threads': 10, 'timeout': 600}}
- timeout 是必需参数，支持整数或 'auto'（由具体 Flow 处理）
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def _normalize_config_keys(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    将配置字典的 key 中划线转换为下划线
    
    规范约定：
    - 配置文件统一用中划线（贴近 CLI 参数风格）
    - 代码里统一用下划线（Python 标识符规范）
    - 此处自动转换：rate-limit → rate_limit
    
    Args:
        config: 原始配置字典
        
    Returns:
        key 已转换的新字典
    """
    return {
        k.replace('-', '_') if isinstance(k, str) else k: v
        for k, v in config.items()
    }


def _parse_subdomain_discovery_config(scan_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    解析子域名发现配置（4阶段流程）
    
    配置格式：
        {
            'passive_tools': {'subfinder': {...}, ...},
            'bruteforce': {'enabled': True, 'subdomain_bruteforce': {...}},
            'permutation': {'enabled': True, 'subdomain_permutation_resolve': {...}},
            'resolve': {'enabled': True, 'subdomain_resolve': {...}}
        }
    
    Args:
        scan_config: subdomain_discovery 的配置字典
    
    Returns:
        配置字典，供 Flow 使用
    """
    if 'passive_tools' not in scan_config:
        logger.warning("子域名发现配置缺少 passive_tools")
        return {}
    
    result = {}
    
    # Stage 1: 被动收集工具
    passive_tools = scan_config.get('passive_tools', {})
    enabled_passive = {}
    for name, config in passive_tools.items():
        if isinstance(config, dict) and config.get('enabled', False):
            enabled_passive[name] = _normalize_config_keys(config)
    result['passive_tools'] = enabled_passive
    
    # Stage 2: 字典爆破（可选）
    bruteforce = scan_config.get('bruteforce', {})
    if bruteforce.get('enabled', False):
        # 转换内部工具配置的 key
        normalized_bruteforce = _normalize_config_keys(bruteforce)
        if 'subdomain_bruteforce' in normalized_bruteforce:
            normalized_bruteforce['subdomain_bruteforce'] = _normalize_config_keys(
                normalized_bruteforce['subdomain_bruteforce']
            )
        result['bruteforce'] = normalized_bruteforce
    
    # Stage 3: 变异生成（可选）
    permutation = scan_config.get('permutation', {})
    if permutation.get('enabled', False):
        normalized_permutation = _normalize_config_keys(permutation)
        if 'subdomain_permutation_resolve' in normalized_permutation:
            normalized_permutation['subdomain_permutation_resolve'] = _normalize_config_keys(
                normalized_permutation['subdomain_permutation_resolve']
            )
        result['permutation'] = normalized_permutation
    
    # Stage 4: 存活验证（可选）
    resolve = scan_config.get('resolve', {})
    if resolve.get('enabled', False):
        normalized_resolve = _normalize_config_keys(resolve)
        if 'subdomain_resolve' in normalized_resolve:
            normalized_resolve['subdomain_resolve'] = _normalize_config_keys(
                normalized_resolve['subdomain_resolve']
            )
        result['resolve'] = normalized_resolve
    
    logger.info(
        f"子域名发现: passive={len(enabled_passive)}, "
        f"bruteforce={'bruteforce' in result}, "
        f"permutation={'permutation' in result}, "
        f"resolve={'resolve' in result}"
    )
    return result


def parse_enabled_tools_from_dict(
    scan_type: str,
    parsed_config: Dict[str, Any]
) -> Dict[str, Dict[str, Any]]:
    """
    从解析后的配置字典中获取启用的工具及其配置
    
    Args:
        scan_type: 扫描类型 (subdomain_discovery, port_scan, site_scan, directory_scan)
        parsed_config: 已解析的配置字典
    
    Returns:
        启用的工具配置字典 {tool_name: tool_config}
        对于 subdomain_discovery，返回完整的配置结构（支持4阶段增强流程）
    
    Raises:
        ValueError: 配置格式错误或必需参数缺失/无效时抛出
    """
    if not parsed_config:
        logger.warning(f"配置字典为空 - scan_type: {scan_type}")
        return {}
    
    if scan_type not in parsed_config:
        logger.warning(f"配置中未找到扫描类型: {scan_type}")
        return {}
    
    scan_config = parsed_config[scan_type]
    
    # 子域名发现支持增强配置格式（4阶段）
    if scan_type == 'subdomain_discovery':
        return _parse_subdomain_discovery_config(scan_config)
    
    if 'tools' not in scan_config:
        logger.warning(f"扫描类型 {scan_type} 未配置任何工具")
        return {}
    
    tools = scan_config['tools']
    
    # 过滤出启用的工具
    enabled_tools = {}
    for name, config in tools.items():
        if not isinstance(config, dict):
            raise ValueError(f"工具 {name} 配置格式错误：期望 dict，实际 {type(config).__name__}")
        
        # 检查是否启用（默认为 False）
        enabled_value = config.get('enabled', False)
        
        # 验证 enabled 字段类型
        if not isinstance(enabled_value, bool):
            raise ValueError(
                f"工具 {name} 的 enabled 字段类型错误：期望 bool，实际 {type(enabled_value).__name__}"
            )
        
        if enabled_value:
            # 检查 timeout 必需参数
            if 'timeout' not in config:
                raise ValueError(f"工具 {name} 缺少必需参数 'timeout'")
            
            # 验证 timeout 值的有效性
            timeout_value = config['timeout']
            
            if timeout_value == 'auto':
                # 允许 'auto'，由具体 Flow 处理
                pass
            elif isinstance(timeout_value, int):
                if timeout_value <= 0:
                    raise ValueError(f"工具 {name} 的 timeout 参数无效（{timeout_value}），必须大于0")
            else:
                raise ValueError(
                    f"工具 {name} 的 timeout 参数类型错误：期望 int 或 'auto'，实际 {type(timeout_value).__name__}"
                )
            
            # 将配置 key 中划线转为下划线，统一给下游代码使用
            enabled_tools[name] = _normalize_config_keys(config)
    
    logger.info(f"扫描类型: {scan_type}, 启用工具: {len(enabled_tools)}/{len(tools)}")
    
    return enabled_tools
