"""
工作流编排器

职责：
- 解析 YAML 配置
- 检测扫描类型
- 提供 Flow 函数映射
- 生成执行计划

注意：本类只负责准备和解析，不执行 Flow
Flow 的执行由 initiate_scan_flow (Prefect @flow) 负责
"""

import logging
import yaml
from typing import Dict, List, Optional, Callable, Any

from apps.scan.configs.command_templates import get_supported_scan_types, EXECUTION_STAGES

logger = logging.getLogger(__name__)


class FlowOrchestrator:
    """
    工作流编排器
    
    负责解析 YAML 配置并生成执行计划，不执行具体的 Flow
    """
    
    def __init__(self, engine_config: str):
        """
        初始化编排器
        
        Args:
            engine_config: YAML 格式的引擎配置字符串
        
        Raises:
            ValueError: 配置为空或解析失败
        """
        if not engine_config or not engine_config.strip():
            raise ValueError("引擎配置不能为空")
        
        try:
            self.config = yaml.safe_load(engine_config) or {}
        except yaml.YAMLError as e:
            logger.error(f"引擎配置解析失败: {e}")
            raise ValueError(f"引擎配置解析失败: {e}")
        
        if not self.config:
            raise ValueError("引擎配置为空")
        
        # 检测启用的扫描类型
        self.scan_types = self._detect_scan_types()
        
        # 解析所有扫描类型的工具配置
        from apps.scan.utils.config_parser import parse_enabled_tools_from_dict
        self.enabled_tools_by_type = {}
        for scan_type in self.scan_types:
            try:
                enabled_tools = parse_enabled_tools_from_dict(
                    scan_type=scan_type,
                    parsed_config=self.config
                )
                if enabled_tools:
                    self.enabled_tools_by_type[scan_type] = enabled_tools
                    logger.debug(f"✓ {scan_type}: {len(enabled_tools)} 个启用工具")
            except Exception as e:
                logger.error(f"解析 {scan_type} 工具配置失败: {e}")
                raise
        
        logger.info(f"✓ FlowOrchestrator 初始化完成，{len(self.enabled_tools_by_type)} 个扫描类型有启用的工具")
    
    def _parse_config(self, engine_config: str) -> Dict:
        """
        解析 YAML 配置
        
        Args:
            engine_config: YAML 格式字符串
        
        Returns:
            dict: 解析后的配置字典
        
        Raises:
            ValueError: 配置为空或解析失败
        """
        if not engine_config:
            raise ValueError("引擎配置为空，请提供有效的 YAML 配置")
        
        try:
            config = yaml.safe_load(engine_config)
            if not config:
                raise ValueError("YAML 配置解析结果为空")
            
            logger.info(f"YAML 配置解析成功，检测到的 key: {list(config.keys())}")
            return config
            
        except yaml.YAMLError as e:
            raise ValueError(f"YAML 配置解析失败: {e}")
    
    def _detect_scan_types(self) -> List[str]:
        """
        检测配置中已启用的扫描类型（按 YAML 顺序）
        
        Returns:
            list: 已启用的扫描类型列表
        
        Raises:
            ValueError: 未检测到有效的扫描类型
        """
        # 保持 YAML 中的顺序，且只包含已启用的类型
        supported_scan_types = get_supported_scan_types()
        scan_types = [
            key for key in self.config.keys() 
            if key in supported_scan_types and self.is_scan_type_enabled(key)
        ]
        
        if not scan_types:
            raise ValueError(
                f"未检测到已启用的扫描类型。\n"
                f"配置中的 key: {list(self.config.keys())}\n"
                f"支持的扫描类型: {supported_scan_types}"
            )
        
        logger.info(f"检测到已启用的扫描类型（按顺序）: {scan_types}")
        return scan_types
    
    def is_scan_type_enabled(self, scan_type: str) -> bool:
        """
        判断指定扫描类型是否启用（存在配置且有启用的工具）
        
        Args:
            scan_type: 扫描类型
            
        Returns:
            bool: 是否启用
        """
        if scan_type not in self.config:
            return False
            
        scan_config = self.config.get(scan_type, {})
        
        # 子域名发现使用 passive_tools 结构
        if scan_type == 'subdomain_discovery':
            passive_tools = scan_config.get('passive_tools', {})
            for tool_config in passive_tools.values():
                if isinstance(tool_config, dict) and tool_config.get('enabled', False):
                    return True
            return False
        
        # 其他扫描类型：检查 tools
        tools = scan_config.get('tools', {})
        for tool_config in tools.values():
            if tool_config.get('enabled', False):
                return True
                
        return False

    def get_execution_stages(self):
        """
        迭代器：获取所有执行阶段
        
        Yields:
            tuple: (mode, enabled_flows)
            - mode: 执行模式（'sequential' 或 'parallel'）
            - enabled_flows: 该阶段中已启用的扫描类型列表
            
        Example:
            for mode, flows in orchestrator.get_execution_stages():
                if mode == 'sequential':
                    for flow in flows:
                        execute_flow(flow)
                else:  # parallel
                    execute_parallel(flows)
        """
        for stage in EXECUTION_STAGES:
            # 筛选出已启用的流程
            enabled_flows = [
                flow for flow in stage['flows'] 
                if flow in self.scan_types
            ]
            
            # 只返回有启用流程的阶段
            if enabled_flows:
                logger.debug(f"阶段 {stage['mode']}: {enabled_flows}")
                yield stage['mode'], enabled_flows

    def get_flow_function(self, scan_type: str) -> Optional[Callable]:
        """
        获取指定扫描类型的 Flow 函数（延迟导入）
        
        Args:
            scan_type: 扫描类型
        
        Returns:
            Callable: Flow 函数，如果未实现则返回 None
        """
        if scan_type == 'subdomain_discovery':
            from apps.scan.flows.subdomain_discovery_flow import subdomain_discovery_flow
            return subdomain_discovery_flow
        
        elif scan_type == 'port_scan':
            from apps.scan.flows.port_scan_flow import port_scan_flow
            return port_scan_flow
        
        elif scan_type == 'site_scan':
            from apps.scan.flows.site_scan_flow import site_scan_flow
            return site_scan_flow
        
        elif scan_type == 'directory_scan':
            from apps.scan.flows.directory_scan_flow import directory_scan_flow
            return directory_scan_flow

        elif scan_type == 'url_fetch':
            from apps.scan.flows.url_fetch import url_fetch_flow
            return url_fetch_flow
        
        elif scan_type == 'vuln_scan':
            from apps.scan.flows.vuln_scan import vuln_scan_flow
            return vuln_scan_flow
        
        else:
            logger.warning(f"未实现的扫描类型: {scan_type}")
            return None

