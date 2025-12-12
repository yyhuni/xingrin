"""
简化的命令构建工具
使用 Python 原生 f-string 和条件拼接，零依赖，性能更好。
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


def build_scan_command(
    tool_name: str,
    scan_type: str,
    command_params: Dict[str, Any],
    tool_config: Dict[str, Any]
) -> str:
    """
    构建扫描工具命令（使用 f-string）
    
    Args:
        tool_name: 工具名称（如 'subfinder'）
        scan_type: 扫描类型（如 'subdomain_discovery'）
        command_params: 命令占位符参数
            - domain: 目标域名
            - domains_file: 域名列表文件（用于端口扫描）
            - url_file: URL列表文件（用于站点扫描）
            - target_file: 目标文件路径（通用）
            - output_file: 输出文件路径
        tool_config: 工具配置参数（包含可选参数）
            - threads: 线程数
            - timeout: 超时时间（秒）
            - 其他可选参数...
    
    Returns:
        完整的命令字符串
    
    Example:
        >>> build_scan_command(
        ...     tool_name='subfinder',
        ...     scan_type='subdomain_discovery',
        ...     command_params={'domain': 'example.com', 'output_file': '/tmp/out.txt'},
        ...     tool_config={'threads': 10}
        ... )
        'subfinder -d example.com -o /tmp/out.txt -silent -t 10'
    """
    from apps.scan.configs.command_templates import get_command_template, SCAN_TOOLS_BASE_PATH
    
    # 获取命令模板
    template = get_command_template(scan_type, tool_name)
    if not template:
        raise ValueError(f"未找到工具 {tool_name} 的命令模板（扫描类型: {scan_type}）")
    
    # 合并所有参数，并将中划线统一转成下划线
    # 规范约定：
    #   - 配置文件（YAML）：参数名用中划线，贴近 CLI 原生参数（如 rate-limit, request-timeout）
    #   - 模板文件（Python）：参数名用下划线，符合 str.format() 占位符语法要求
    #   - 此处自动转换：rate-limit → rate_limit
    def normalize_key(k):
        return k.replace('-', '_') if isinstance(k, str) else k
    
    all_params = {
        'scan_tools_base': SCAN_TOOLS_BASE_PATH,
        **{normalize_key(k): v for k, v in command_params.items()},
        **{normalize_key(k): v for k, v in tool_config.items()}
    }

    # nuclei 特殊处理：要求 template_args 必填（支持多 -t），避免格式化缺失
    if tool_name == "nuclei":
        if not all_params.get("template_args"):
            raise ValueError("nuclei 命令构建缺少 template_args（请检查模板仓库列表配置）")
    
    try:
        # 1. 构建基础命令
        base_command = template['base'].format(**all_params)
        
        # 2. 拼接可选参数
        optional_parts = []
        for param_name, flag_template in template.get('optional', {}).items():
            # 检查参数是否存在且有值
            if param_name in all_params and all_params[param_name]:
                optional_parts.append(flag_template.format(**all_params))
        
        # 3. 组合完整命令
        full_command = base_command
        if optional_parts:
            full_command += ' ' + ' '.join(optional_parts)
        
        # 4. 清理多余空白
        import re
        cleaned_command = re.sub(r'\s+', ' ', full_command).strip()
        
        return cleaned_command
        
    except KeyError as e:
        raise ValueError(
            f"命令构建失败：缺少必需参数 {e}\n"
            f"模板: {template}\n"
            f"提供的参数: {list(all_params.keys())}"
        )
    except Exception as e:
        raise ValueError(
            f"命令构建失败: {e}\n"
            f"模板: {template}\n"
            f"提供的参数: {list(all_params.keys())}"
        )
