"""
URL Fetch Flow 模块

提供 URL 获取相关的 Flow：
- url_fetch_flow: 主 Flow（按输入类型编排 + 统一后处理）
- domain_name_url_fetch_flow: 基于 domain_name（来自 target_name）输入的 URL 获取子 Flow（如 waymore）
- domains_url_fetch_flow: 基于 domains_file 输入的 URL 获取子 Flow（如 gau、waybackurls）
- sites_url_fetch_flow: 基于 sites_file 输入的 URL 获取子 Flow（如 katana 等爬虫）
"""

from .main_flow import url_fetch_flow
from .domain_name_url_fetch_flow import domain_name_url_fetch_flow
from .domains_url_fetch_flow import domains_url_fetch_flow
from .sites_url_fetch_flow import sites_url_fetch_flow

__all__ = [
    'url_fetch_flow',
    'domain_name_url_fetch_flow',
    'domains_url_fetch_flow',
    'sites_url_fetch_flow',
]
