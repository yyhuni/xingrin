"""
WebSocket Consumer - Worker 交互式终端 (使用 PTY)
"""

import json
import logging
import asyncio
import os
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async

from django.conf import settings

from apps.engine.services import WorkerService

logger = logging.getLogger(__name__)


class WorkerDeployConsumer(AsyncWebsocketConsumer):
    """
    Worker 交互式终端 WebSocket Consumer
    
    使用 paramiko invoke_shell 实现真正的交互式终端
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ssh_client = None
        self.shell = None
        self.worker = None
        self.read_task = None
        self.worker_service = WorkerService()
    
    async def connect(self):
        """连接时加入对应 Worker 的组并自动建立 SSH 连接"""
        self.worker_id = self.scope['url_route']['kwargs']['worker_id']
        self.group_name = f'worker_deploy_{self.worker_id}'
        
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        
        logger.info(f"终端已连接 - Worker: {self.worker_id}")
        
        # 自动建立 SSH 连接
        await self._auto_ssh_connect()
    
    async def disconnect(self, close_code):
        """断开时清理资源"""
        if self.read_task:
            self.read_task.cancel()
        if self.shell:
            try:
                self.shell.close()
            except Exception:
                pass
        if self.ssh_client:
            try:
                self.ssh_client.close()
            except Exception:
                pass
        
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"终端已断开 - Worker: {self.worker_id}")
    
    async def receive(self, text_data=None, bytes_data=None):
        """接收客户端消息"""
        if bytes_data:
            # 二进制数据直接发送到 shell
            if self.shell:
                await asyncio.to_thread(self.shell.send, bytes_data)
            return
        
        if not text_data:
            return
            
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')
            
            if msg_type == 'resize':
                cols = data.get('cols', 80)
                rows = data.get('rows', 24)
                if self.shell:
                    await asyncio.to_thread(self.shell.resize_pty, cols, rows)
                    
            elif msg_type == 'input':
                # 终端输入
                if self.shell:
                    text = data.get('data', '')
                    await asyncio.to_thread(self.shell.send, text)
                    
            elif msg_type == 'deploy':
                # 执行部署脚本（后台运行）
                await self._run_deploy_script()
                
            elif msg_type == 'attach':
                # 查看部署进度（attach 到 tmux 会话）
                await self._attach_deploy_session()
                
            elif msg_type == 'uninstall':
                # 执行卸载脚本（后台运行）
                await self._run_uninstall_script()
                
        except json.JSONDecodeError:
            # 可能是普通文本输入
            if self.shell and text_data:
                await asyncio.to_thread(self.shell.send, text_data)
        except Exception as e:
            logger.error(f"处理消息错误: {e}")
    
    async def _auto_ssh_connect(self):
        """自动从数据库读取密码并连接"""
        logger.info(f"[SSH] 开始自动连接 - Worker ID: {self.worker_id}")
        # 通过服务层获取 Worker 节点
        # thread_sensitive=False 确保在新线程中运行，避免数据库连接问题
        self.worker = await sync_to_async(self.worker_service.get_worker, thread_sensitive=False)(self.worker_id)
        logger.info(f"[SSH] Worker 查询结果: {self.worker}")

        if not self.worker:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Worker 不存在'
            }))
            return
            
        if not self.worker.password:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '未配置 SSH 密码，请先编辑节点信息'
            }))
            return
            
        # 使用默认终端大小
        await self._ssh_connect(self.worker.password, 80, 24)
    
    async def _ssh_connect(self, password: str, cols: int = 80, rows: int = 24):
        """建立 SSH 连接并启动交互式 shell (使用 tmux 持久化会话)"""
        try:
            import paramiko
        except ImportError:
            await self.send(text_data=json.dumps({
                'type': 'error', 
                'message': '服务器缺少 paramiko 库'
            }))
            return
        
        # self.worker 已在 _auto_ssh_connect 中查询
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            await asyncio.to_thread(
                ssh.connect,
                self.worker.ip_address,
                port=self.worker.ssh_port,
                username=self.worker.username,
                password=password,
                timeout=30
            )
            
            self.ssh_client = ssh
            
            # 启动交互式 shell（连接时不做 tmux 安装，仅提供普通 shell）
            self.shell = await asyncio.to_thread(
                ssh.invoke_shell,
                term='xterm-256color',
                width=cols,
                height=rows
            )
            
            # 发送连接成功消息
            logger.info(f"[SSH] 准备发送 connected 消息 - Worker: {self.worker_id}")
            await self.send(text_data=json.dumps({
                'type': 'connected'
            }))
            logger.info(f"[SSH] connected 消息已发送 - Worker: {self.worker_id}")
            
            # 启动读取任务
            self.read_task = asyncio.create_task(self._read_shell_output())
            
            logger.info(f"[SSH] Shell 已连接，读取任务已启动 - Worker: {self.worker_id}")
            
        except paramiko.AuthenticationException:
            logger.error(f"[SSH] 认证失败 - Worker: {self.worker_id}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '认证失败，密码错误'
            }))
        except Exception as e:
            logger.error(f"[SSH] 连接失败 - Worker: {self.worker_id}, Error: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'连接失败: {str(e)}'
            }))
    
    async def _read_shell_output(self):
        """持续读取 shell 输出并发送到客户端"""
        try:
            while self.shell and not self.shell.closed:
                if self.shell.recv_ready():
                    data = await asyncio.to_thread(self.shell.recv, 4096)
                    if data:
                        await self.send(bytes_data=data)
                else:
                    await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"读取 shell 输出错误: {e}")
    
    async def _run_deploy_script(self):
        """运行部署脚本（在 tmux 会话中执行，支持断线续连）
        
        流程：
        1. 通过 SFTP 上传脚本到远程服务器
        2. 使用 exec_command 静默执行（不在交互式终端回显）
        3. 通过 WebSocket 发送结果到前端显示
        """
        if not self.ssh_client:
            return
        
        from apps.engine.services.deploy_service import (
            get_bootstrap_script, 
            get_deploy_script, 
            get_start_agent_script
        )
        
        # 优先使用 settings 中配置的对外访问主机（PUBLIC_HOST）拼接 Django URL
        public_host = getattr(settings, 'PUBLIC_HOST', '').strip()
        server_port = getattr(settings, 'SERVER_PORT', '8888')

        if not public_host:
            error_msg = (
                "未配置 PUBLIC_HOST，请在 docker/.env 中设置对外访问 IP/域名 "
                "(PUBLIC_HOST) 并重启服务后再执行远程部署"
            )
            logger.error(error_msg)
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': error_msg,
            }))
            return

        django_host = f"{public_host}:{server_port}"   # Django / 心跳上报使用
        heartbeat_api_url = f"http://{django_host}"  # 基础 URL，agent 会加 /api/...

        session_name = f'xingrin_deploy_{self.worker_id}'
        remote_script_path = '/tmp/xingrin_deploy.sh'
        
        # 获取外置脚本内容
        bootstrap_script = get_bootstrap_script()
        deploy_script = get_deploy_script()
        start_script = get_start_agent_script(
            heartbeat_api_url=heartbeat_api_url,
            worker_id=self.worker_id
        )
        
        # 合并脚本
        combined_script = f"""#!/bin/bash
set -e

# ==================== 阶段 1: 环境初始化 ====================
{bootstrap_script}

# ==================== 阶段 2: 安装 Docker ====================
{deploy_script}

# ==================== 阶段 3: 启动 Agent ====================
{start_script}

echo "SUCCESS"
"""
        
        # 更新状态为 deploying
        await sync_to_async(self.worker_service.update_status)(self.worker_id, 'deploying')
        
        # 发送开始提示
        start_msg = "\r\n\033[36m[XingRin] 正在准备部署...\033[0m\r\n"
        await self.send(bytes_data=start_msg.encode())
        
        try:
            # 1. 上传脚本
            sftp = await asyncio.to_thread(self.ssh_client.open_sftp)
            with sftp.file(remote_script_path, 'w') as f:
                f.write(combined_script)
            sftp.chmod(remote_script_path, 0o755)
            await asyncio.to_thread(sftp.close)
            
            # 2. 静默执行部署命令（使用 exec_command，不会回显到终端）
            deploy_cmd = f"""
# 确保 tmux 安装
if ! command -v tmux >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -qq && sudo apt-get install -y -qq tmux >/dev/null 2>&1
    fi
fi

# 检查脚本是否存在
if [ ! -f "{remote_script_path}" ]; then
    echo "SCRIPT_NOT_FOUND"
    exit 1
fi

# 启动 tmux 会话
if command -v tmux >/dev/null 2>&1; then
    tmux kill-session -t {session_name} 2>/dev/null || true
    # 使用 bash 执行脚本，确保环境正确
    tmux new-session -d -s {session_name} "bash {remote_script_path}; echo '部署完成，按回车退出'; read"
    # 验证会话是否创建成功
    sleep 0.5
    if tmux has-session -t {session_name} 2>/dev/null; then
        echo "SUCCESS"
    else
        echo "SESSION_CREATE_FAILED"
    fi
else
    echo "TMUX_NOT_FOUND"
fi
"""
            stdin, stdout, stderr = await asyncio.to_thread(
                self.ssh_client.exec_command, deploy_cmd
            )
            result = await asyncio.to_thread(stdout.read)
            result = result.decode().strip()
            
            # 3. 发送结果到前端终端显示
            if "SUCCESS" in result:
                # 部署任务已在后台启动，保持 deploying 状态
                # 只有当心跳上报成功后才会变成 deployed（通过 heartbeat API 自动更新）
                success_msg = (
                    "\r\n\033[32m✓ 部署任务已在后台启动\033[0m\r\n"
                    f"\033[90m  会话: {session_name}\033[0m\r\n"
                    "\r\n"
                    "\033[36m点击 [查看进度] 按钮查看部署输出\033[0m\r\n"
                    f"\033[90m或手动执行: tmux attach -t {session_name}\033[0m\r\n"
                    "\r\n"
                )
            else:
                # 获取更多错误信息
                err = await asyncio.to_thread(stderr.read)
                err_msg = err.decode().strip() if err else ""
                success_msg = f"\r\n\033[31m✗ 部署启动失败\033[0m\r\n\033[90m结果: {result}\r\n错误: {err_msg}\033[0m\r\n"
            
            await self.send(bytes_data=success_msg.encode())
            
        except Exception as e:
            error_msg = f"\033[31m✗ 部署失败: {str(e)}\033[0m\r\n"
            await self.send(bytes_data=error_msg.encode())
            logger.error(f"部署脚本执行失败: {e}")
    
    async def _run_uninstall_script(self):
        """在远程主机上执行 Worker 卸载脚本

        逻辑：
        1. 通过服务层读取本地 worker-uninstall.sh 内容
        2. 上传到远程 /tmp/xingrin_uninstall.sh 并赋予执行权限
        3. 使用 exec_command 以 bash 执行脚本
        4. 将执行结果摘要写回前端终端
        """
        if not self.ssh_client:
            return

        from apps.engine.services.deploy_service import get_uninstall_script

        uninstall_script = get_uninstall_script()
        remote_script_path = '/tmp/xingrin_uninstall.sh'

        start_msg = "\r\n\033[36m[XingRin] 正在执行 Worker 卸载...\033[0m\r\n"
        await self.send(bytes_data=start_msg.encode())

        try:
            # 上传卸载脚本
            sftp = await asyncio.to_thread(self.ssh_client.open_sftp)
            with sftp.file(remote_script_path, 'w') as f:
                f.write(uninstall_script)
            sftp.chmod(remote_script_path, 0o755)
            await asyncio.to_thread(sftp.close)

            # 执行卸载脚本
            cmd = f"bash {remote_script_path}"
            stdin, stdout, stderr = await asyncio.to_thread(
                self.ssh_client.exec_command, cmd
            )
            out = await asyncio.to_thread(stdout.read)
            err = await asyncio.to_thread(stderr.read)

            # 转换换行符为终端格式 (\n -> \r\n)
            output_text = out.decode().strip().replace('\n', '\r\n') if out else ""
            error_text = err.decode().strip().replace('\n', '\r\n') if err else ""

            # 简单判断是否成功（退出码 + 关键字）
            exit_status = stdout.channel.recv_exit_status()
            if exit_status == 0:
                # 卸载成功，重置状态为 pending
                await sync_to_async(self.worker_service.update_status)(self.worker_id, 'pending')
                # 删除 Redis 中的心跳数据
                from apps.engine.services.worker_load_service import worker_load_service
                worker_load_service.delete_load(self.worker_id)
                # 发送状态更新到前端
                await self.send(text_data=json.dumps({
                    'type': 'status',
                    'status': 'pending'  # 卸载后变为待部署状态
                }))
                msg = "\r\n\033[32m✓ 节点卸载完成\033[0m\r\n"
                if output_text:
                    msg += f"\033[90m{output_text}\033[0m\r\n"
            else:
                msg = "\r\n\033[31m✗ Worker 卸载失败\033[0m\r\n"
                if output_text:
                    msg += f"\033[90m输出: {output_text}\033[0m\r\n"
                if error_text:
                    msg += f"\033[90m错误: {error_text}\033[0m\r\n"

            await self.send(bytes_data=msg.encode())

        except Exception as e:
            error_msg = f"\033[31m✗ 卸载执行异常: {str(e)}\033[0m\r\n"
            await self.send(bytes_data=error_msg.encode())
            logger.error(f"卸载脚本执行失败: {e}")
    
    async def _attach_deploy_session(self):
        """Attach 到部署会话查看进度"""
        if not self.shell or not self.ssh_client:
            return
        
        session_name = f'xingrin_deploy_{self.worker_id}'
        
        # 先静默检查会话是否存在
        check_cmd = f"tmux has-session -t {session_name} 2>/dev/null && echo EXISTS || echo NOT_EXISTS"
        stdin, stdout, stderr = await asyncio.to_thread(
            self.ssh_client.exec_command, check_cmd
        )
        result = await asyncio.to_thread(stdout.read)
        result = result.decode().strip()
        
        if "EXISTS" in result:
            # 会话存在，直接 attach
            await asyncio.to_thread(self.shell.send, f"tmux attach -t {session_name}\n")
        else:
            # 会话不存在，发送提示
            msg = "\r\n\033[33m没有正在运行的部署任务\033[0m\r\n\033[90m请先点击 [执行部署] 按钮启动部署\033[0m\r\n\r\n"
            await self.send(bytes_data=msg.encode())
    
    # Channel Layer 消息处理
    async def terminal_output(self, event):
        if self.shell:
            await asyncio.to_thread(self.shell.send, event['content'])
    
    async def deploy_status(self, event):
        await self.send(text_data=json.dumps({
            'type': 'status',
            'status': event['status'],
            'message': event.get('message', '')
        }))
