"""
远程节点部署脚本服务

脚本文件位置：backend/scripts/worker-deploy/
- bootstrap.sh: 环境初始化（安装基础依赖）
- install.sh: 安装 Docker + 拉取镜像
- uninstall.sh: 卸载脚本
- start-agent.sh: 启动 agent 容器
- agent.sh: 心跳上报（在容器内运行）

新架构说明：
- 远程节点只需安装 Docker 和运行 agent
- 扫描任务由主服务器通过 SSH docker run 执行
"""

from pathlib import Path

# 脚本目录
SCRIPTS_DIR = Path(__file__).parent.parent.parent.parent / "scripts" / "worker-deploy"


def _read_script(filename: str) -> str:
    """读取脚本文件内容"""
    script_path = SCRIPTS_DIR / filename
    if script_path.exists():
        return script_path.read_text()
    else:
        raise FileNotFoundError(f"脚本文件不存在: {script_path}")


def get_bootstrap_script() -> str:
    """获取环境初始化脚本"""
    return _read_script("bootstrap.sh")


def get_deploy_script() -> str:
    """获取安装脚本（安装 Docker + 拉取镜像）"""
    return _read_script("install.sh")


def get_uninstall_script() -> str:
    """获取卸载脚本"""
    return _read_script("uninstall.sh")


def get_start_agent_script(
    heartbeat_api_url: str = None,
    worker_id: int = None
) -> str:
    """
    获取 agent 启动脚本
    
    :param heartbeat_api_url: 心跳上报地址
    :param worker_id: Worker ID
    """
    script = _read_script("start-agent.sh")
    
    # 只需替换两个变量
    script = script.replace("{{HEARTBEAT_API_URL}}", heartbeat_api_url or '')
    script = script.replace("{{WORKER_ID}}", str(worker_id) if worker_id else '')
    
    return script
