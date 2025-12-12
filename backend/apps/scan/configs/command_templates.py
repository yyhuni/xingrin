"""
扫描工具命令模板（简化版，不使用 Jinja2）

使用 Python 原生字符串格式化，零依赖。
"""

from django.conf import settings

# ==================== 路径配置 ====================
SCAN_TOOLS_BASE_PATH = getattr(settings, 'SCAN_TOOLS_BASE_PATH', '/opt/xingrin/tools')

# ==================== 子域名发现 ====================

SUBDOMAIN_DISCOVERY_COMMANDS = {
    'subfinder': {
        # 默认使用所有数据源（更全面，略慢），并始终开启递归
        # -all       使用所有数据源
        # -recursive 对支持递归的源启用递归枚举（默认开启）
        'base': 'subfinder -d {domain} -all -recursive -o {output_file} -silent',
        'optional': {
            'threads': '-t {threads}',              # 控制并发 goroutine 数
        }
    },
    
    'amass_passive': {
        # 先执行被动枚举，将结果写入 amass 内部数据库，然后从数据库中导出纯域名（names）到 output_file
        # -silent 禁用进度条和其他输出
        'base': 'amass enum -passive -silent -d {domain} && amass subs -names -d {domain} > {output_file}'
    },
    
    'amass_active': {
        # 先执行主动枚举 + 爆破，将结果写入 amass 内部数据库，然后从数据库中导出纯域名（names）到 output_file
        # -silent 禁用进度条和其他输出
        'base': 'amass enum -active -silent -d {domain} -brute && amass subs -names -d {domain} > {output_file}'
    },
    
    'sublist3r': {
        'base': 'python3 {scan_tools_base}/Sublist3r/sublist3r.py -d {domain} -o {output_file}',
        'optional': {
            'threads': '-t {threads}'
        }
    },
    
    'assetfinder': {
        'base': 'assetfinder --subs-only {domain} > {output_file}',
    },
    
    # === 主动字典爆破 ===
    'subdomain_bruteforce': {
        # 使用字典对目标域名进行 DNS 爆破
        # -d 目标域名，-w 字典文件，-o 输出文件
        'base': 'puredns bruteforce {wordlist} {domain} -r /app/backend/resources/resolvers.txt --write {output_file} --quiet',
        'optional': {},
    },
    
    # === DNS 存活验证（最终统一验证）===
    'subdomain_resolve': {
        # 验证子域名是否能解析（存活验证）
        # 输入文件为候选子域列表，输出为存活子域列表
        'base': 'puredns resolve {input_file} -r /app/backend/resources/resolvers.txt --write {output_file} --wildcard-tests 50 --wildcard-batch 1000000 --quiet',
        'optional': {},
    },
    
    # === 变异生成 + 存活验证（流式管道，避免 OOM）===
    'subdomain_permutation_resolve': {
        # 流式管道：dnsgen 生成变异域名 | puredns resolve 验证存活
        # 不落盘中间文件，避免内存爆炸；不做通配符过滤
        'base': 'cat {input_file} | dnsgen - | puredns resolve -r /app/backend/resources/resolvers.txt --write {output_file} --wildcard-tests 50 --wildcard-batch 1000000 --quiet',
        'optional': {},
    },
}


# ==================== 端口扫描 ====================

PORT_SCAN_COMMANDS = {
    'naabu_active': {
        'base': 'naabu -exclude-cdn -warm-up-time 5 -verify -list {domains_file} -json -silent',
        'optional': {
            'threads': '-c {threads}',
            'ports': '-p {ports}',
            'top_ports': '-top-ports {top_ports}',
            'rate': '-rate {rate}'
        }
    },
    
    'naabu_passive': {
        'base': 'naabu -list {domains_file} -passive -json -silent'
    },
}


# ==================== 站点扫描 ====================

SITE_SCAN_COMMANDS = {
    'httpx': {
        'base': (
            'httpx -l {url_file} '
            '-status-code -content-type -content-length '
            '-location -title -server -body-preview '
            '-tech-detect -cdn -vhost '
            '-random-agent -no-color -json'
        ),
        'optional': {
            'threads': '-threads {threads}',
            'rate_limit': '-rate-limit {rate_limit}',
            'request_timeout': '-timeout {request_timeout}',
            'retries': '-retries {retries}'
        }
    },
}


# ==================== 目录扫描 ====================

DIRECTORY_SCAN_COMMANDS = {
    'ffuf': {
        'base': 'ffuf -u {url}/FUZZ -se -ac -sf -json -w {wordlist}',  
        'optional': {
            'delay': '-p {delay}',
            'threads': '-t {threads}',
            'request_timeout': '-timeout {request_timeout}',
            'match_codes': '-mc {match_codes}',
            'rate': '-rate {rate}'
        }
    },
}


# ==================== URL 获取 ====================

URL_FETCH_COMMANDS = {
    'waymore': {
        'base': 'waymore -i {domain_name} -mode U -oU {output_file}',
        'input_type': 'domain_name'
    },
    
    'katana': {
        'base': (
            'katana -list {sites_file} -o {output_file} '
            '-jc '                   # 开启 JavaScript 爬取 + 自动解析 .js 文件里的所有端点（最重要）
            '-xhr '                  # 额外从 JS 中提取 XHR/Fetch 请求的 API 路径（再多挖 10-20% 隐藏接口）
            '-kf all '               # 在每个目录下自动 fuzz 所有已知敏感文件（.env、.git、backup、config、ds_store 等 5000+ 条）
            '-fs rdn '               # 智能过滤相对重复+噪声路径（分页、?id=1/2/3 这类垃圾全干掉，输出极干净）
            '-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" '  # 固定一个正常 UA（Katana 默认会随机，但固定更低调）
            '-silent '               # 安静模式（终端不输出进度条，只出 URL）
        ),
        'optional': {
            'depth': '-d {depth}',                      # 爬取最大深度（平衡深度与时间，默认 3，推荐 5）
            'threads': '-c {threads}',                  # 全局并发数（极低并发最像真人，推荐 10）
            'rate_limit': '-rl {rate_limit}',           # 全局硬限速：每秒最多 N 个请求（WAF 几乎不报警，推荐 30）
            'random_delay': '-rd {random_delay}',       # 每次请求之间随机延迟 N 秒（再加一层人性化，推荐 1）
            'retry': '-retry {retry}',                  # 失败请求自动重试次数（网络抖动不丢包，推荐 2）
            'request_timeout': '-timeout {request_timeout}'  # 单请求超时秒数（防卡死，推荐 12）
        },
        'input_type': 'sites_file'
    },
    
    'uro': {
        'base': 'uro -i {input_file} -o {output_file}',
        'optional': {
            'whitelist': '-w {whitelist}',      # 只保留指定扩展名的 URL（空格分隔）
            'blacklist': '-b {blacklist}',      # 排除指定扩展名的 URL（空格分隔）
            'filters': '-f {filters}'           # 额外的过滤规则（空格分隔）
        }
    },
    
    'httpx': {
        'base': (
            'httpx -l {url_file} '
            '-status-code -content-type -content-length '
            '-location -title -server -body-preview '
            '-tech-detect -cdn -vhost '
            '-random-agent -no-color -json'
        ),
        'optional': {
            'threads': '-threads {threads}',
            'rate_limit': '-rate-limit {rate_limit}',
            'request_timeout': '-timeout {request_timeout}',
            'retries': '-retries {retries}'
        }
    },
}

VULN_SCAN_COMMANDS = {
    'dalfox_xss': {
        'base': (
            'dalfox --silence --no-color --no-spinner '
            '--skip-bav '
            'file {endpoints_file} '
            '--waf-evasion '
            '--format json'
        ),
        'optional': {
            'only_poc': '--only-poc {only_poc}',
            'ignore_return': '--ignore-return {ignore_return}',
            'blind_xss_server': '-b {blind_xss_server}',
            'delay': '--delay {delay}',
            'request_timeout': '--timeout {request_timeout}',
            # 是否追加 UA 头，由 user_agent 是否存在决定
            'user_agent': '--user-agent "{user_agent}"',
            'worker': '--worker {worker}',
        },
        'input_type': 'endpoints_file',
    },
    'nuclei': {
        # nuclei 漏洞扫描
        # -j: JSON 输出
        # -silent: 静默模式
        # -l: 输入 URL 列表文件
        # -t: 模板目录路径（支持多个仓库，多次 -t 由 template_args 直接拼接）
        'base': 'nuclei -j -silent -l {endpoints_file} {template_args}',
        'optional': {
            'concurrency': '-c {concurrency}',           # 并发数（默认 25）
            'rate_limit': '-rl {rate_limit}',            # 每秒请求数限制
            'request_timeout': '-timeout {request_timeout}',  # 请求超时秒数
            'bulk_size': '-bs {bulk_size}',              # 批量处理大小
            'retries': '-retries {retries}',             # 重试次数
            'severity': '-severity {severity}',          # 过滤严重性（info,low,medium,high,critical）
            'tags': '-tags {tags}',                      # 过滤标签
            'exclude_tags': '-etags {exclude_tags}',     # 排除标签
        },
        'input_type': 'endpoints_file',
    },
}


# ==================== 工具映射 ====================

COMMAND_TEMPLATES = {
    'subdomain_discovery': SUBDOMAIN_DISCOVERY_COMMANDS,
    'port_scan': PORT_SCAN_COMMANDS,
    'site_scan': SITE_SCAN_COMMANDS,
    'directory_scan': DIRECTORY_SCAN_COMMANDS,
    'url_fetch': URL_FETCH_COMMANDS,
    'vuln_scan': VULN_SCAN_COMMANDS,
}

# ==================== 扫描类型配置 ====================

# 执行阶段定义（按顺序执行）
EXECUTION_STAGES = [
    {
        'mode': 'sequential',
        'flows': ['subdomain_discovery', 'port_scan', 'site_scan']
    },
    {
        'mode': 'parallel',
        'flows': ['url_fetch', 'directory_scan']
    },
    {
        'mode': 'sequential',
        'flows': ['vuln_scan']
    },
]


def get_supported_scan_types():
    """
    获取支持的扫描类型
    
    Returns:
        list: 支持的扫描类型列表（从 COMMAND_TEMPLATES 的 keys 获取）
    """
    return list(COMMAND_TEMPLATES.keys())


def get_command_template(scan_type: str, tool_name: str) -> dict:
    """
    获取工具的命令模板
    
    Args:
        scan_type: 扫描类型
        tool_name: 工具名称
    
    Returns:
        命令模板字典，如果未找到则返回 None
    """
    templates = COMMAND_TEMPLATES.get(scan_type, {})
    return templates.get(tool_name)
