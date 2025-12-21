#!/usr/bin/env python
"""
扫描任务启动脚本

用于动态扫描容器启动时执行。
必须在 Django 导入之前获取配置并设置环境变量。
"""
import argparse
import sys
import os
import traceback


def diagnose_prefect_environment():
    """诊断 Prefect 运行环境，输出详细信息用于排查问题"""
    print("\n" + "="*60)
    print("Prefect 环境诊断")
    print("="*60)
    
    # 1. 检查 Prefect 相关环境变量
    print("\n[诊断] Prefect 环境变量:")
    prefect_vars = [
        'PREFECT_HOME',
        'PREFECT_API_URL',
        'PREFECT_SERVER_EPHEMERAL_ENABLED',
        'PREFECT_SERVER_EPHEMERAL_STARTUP_TIMEOUT_SECONDS',
        'PREFECT_SERVER_DATABASE_CONNECTION_URL',
        'PREFECT_LOGGING_LEVEL',
        'PREFECT_DEBUG_MODE',
    ]
    for var in prefect_vars:
        value = os.environ.get(var, 'NOT SET')
        print(f"  {var}={value}")
    
    # 2. 检查 PREFECT_HOME 目录
    prefect_home = os.environ.get('PREFECT_HOME', os.path.expanduser('~/.prefect'))
    print(f"\n[诊断] PREFECT_HOME 目录: {prefect_home}")
    if os.path.exists(prefect_home):
        print(f"  ✓ 目录存在")
        print(f"  可写: {os.access(prefect_home, os.W_OK)}")
        try:
            files = os.listdir(prefect_home)
            print(f"  文件列表: {files[:10]}{'...' if len(files) > 10 else ''}")
        except Exception as e:
            print(f"  ✗ 无法列出文件: {e}")
    else:
        print(f"  目录不存在，尝试创建...")
        try:
            os.makedirs(prefect_home, exist_ok=True)
            print(f"  ✓ 创建成功")
        except Exception as e:
            print(f"  ✗ 创建失败: {e}")
    
    # 3. 检查 uvicorn 是否可用
    print(f"\n[诊断] uvicorn 可用性:")
    import shutil
    uvicorn_path = shutil.which('uvicorn')
    if uvicorn_path:
        print(f"  ✓ uvicorn 路径: {uvicorn_path}")
    else:
        print(f"  ✗ uvicorn 不在 PATH 中")
        print(f"  PATH: {os.environ.get('PATH', 'NOT SET')}")
    
    # 4. 检查 Prefect 版本
    print(f"\n[诊断] Prefect 版本:")
    try:
        import prefect
        print(f"  ✓ prefect=={prefect.__version__}")
    except Exception as e:
        print(f"  ✗ 无法导入 prefect: {e}")
    
    # 5. 检查 SQLite 支持
    print(f"\n[诊断] SQLite 支持:")
    try:
        import sqlite3
        print(f"  ✓ sqlite3 版本: {sqlite3.sqlite_version}")
        # 测试创建数据库
        test_db = os.path.join(prefect_home, 'test.db')
        conn = sqlite3.connect(test_db)
        conn.execute('CREATE TABLE IF NOT EXISTS test (id INTEGER)')
        conn.close()
        os.remove(test_db)
        print(f"  ✓ SQLite 读写测试通过")
    except Exception as e:
        print(f"  ✗ SQLite 测试失败: {e}")
    
    # 6. 检查端口绑定能力
    print(f"\n[诊断] 端口绑定测试:")
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
        sock.close()
        print(f"  ✓ 可以绑定 127.0.0.1 端口 (测试端口: {port})")
    except Exception as e:
        print(f"  ✗ 端口绑定失败: {e}")
    
    # 7. 检查内存情况
    print(f"\n[诊断] 系统资源:")
    try:
        import psutil
        mem = psutil.virtual_memory()
        print(f"  内存总量: {mem.total / 1024 / 1024:.0f} MB")
        print(f"  可用内存: {mem.available / 1024 / 1024:.0f} MB")
        print(f"  内存使用率: {mem.percent}%")
    except ImportError:
        print(f"  psutil 未安装，跳过内存检查")
    except Exception as e:
        print(f"  ✗ 资源检查失败: {e}")
    
    print("\n" + "="*60)
    print("诊断完成")
    print("="*60 + "\n")


def main():
    print("="*60)
    print("run_initiate_scan.py 启动")
    print(f"  Python: {sys.version}")
    print(f"  CWD: {os.getcwd()}")
    print(f"  SERVER_URL: {os.environ.get('SERVER_URL', 'NOT SET')}")
    print("="*60)
    
    # 1. 从配置中心获取配置并初始化 Django（必须在 Django 导入之前）
    print("[1/4] 从配置中心获取配置...")
    try:
        from apps.common.container_bootstrap import fetch_config_and_setup_django
        fetch_config_and_setup_django()
        print("[1/4] ✓ 配置获取成功")
    except Exception as e:
        print(f"[1/4] ✗ 配置获取失败: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    # 2. 解析命令行参数
    print("[2/4] 解析命令行参数...")
    parser = argparse.ArgumentParser(description="执行扫描初始化 Flow")
    parser.add_argument("--scan_id", type=int, required=True, help="扫描任务 ID")
    parser.add_argument("--target_name", type=str, required=True, help="目标名称")
    parser.add_argument("--target_id", type=int, required=True, help="目标 ID")
    parser.add_argument("--scan_workspace_dir", type=str, required=True, help="扫描工作目录")
    parser.add_argument("--engine_name", type=str, required=True, help="引擎名称")
    parser.add_argument("--scheduled_scan_name", type=str, default=None, help="定时扫描任务名称（可选）")
    
    args = parser.parse_args()
    print(f"[2/4] ✓ 参数解析成功:")
    print(f"       scan_id: {args.scan_id}")
    print(f"       target_name: {args.target_name}")
    print(f"       target_id: {args.target_id}")
    print(f"       scan_workspace_dir: {args.scan_workspace_dir}")
    print(f"       engine_name: {args.engine_name}")
    print(f"       scheduled_scan_name: {args.scheduled_scan_name}")
    
    # 2.5. 运行 Prefect 环境诊断（仅在 DEBUG 模式下）
    if os.environ.get('DEBUG', '').lower() == 'true':
        diagnose_prefect_environment()
    
    # 3. 现在可以安全导入 Django 相关模块
    print("[3/4] 导入 initiate_scan_flow...")
    try:
        from apps.scan.flows.initiate_scan_flow import initiate_scan_flow
        print("[3/4] ✓ 导入成功")
    except Exception as e:
        print(f"[3/4] ✗ 导入失败: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    # 4. 执行 Flow
    print("[4/4] 执行 initiate_scan_flow...")
    try:
        result = initiate_scan_flow(
            scan_id=args.scan_id,
            target_name=args.target_name,
            target_id=args.target_id,
            scan_workspace_dir=args.scan_workspace_dir,
            engine_name=args.engine_name,
            scheduled_scan_name=args.scheduled_scan_name,
        )
        print("[4/4] ✓ Flow 执行完成")
        print(f"结果: {result}")
    except Exception as e:
        print(f"[4/4] ✗ Flow 执行失败: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
