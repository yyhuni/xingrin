"""
端口扫描相关类型定义

定义端口扫描流程中的数据结构，确保类型安全
"""

from typing import TypedDict


class PortScanRecord(TypedDict):
    """
    端口扫描记录类型定义
    
    说明：
        这是端口扫描的标准输出格式，包含：
        - host: 被扫描的域名
        - ip: 域名解析后的 IP 地址（扫描工具自动解析）
        - port: 发现的开放端口
    
    用途：
        - 解析器输出：parse_naabu_result_task
        - 保存器输入：save_ports_task
    
    注意：
        IP 是端口扫描的必然产物，因为：
        1. 扫描工具需要先解析域名到 IP
        2. 端口属于 IP，而非域名
        3. 同一域名可能有多个 IP
    """
    host: str   # 域名（如：www.example.com）
    ip: str     # IP 地址（如：1.1.1.1）
    port: int   # 端口号（如：80, 443, 22）
