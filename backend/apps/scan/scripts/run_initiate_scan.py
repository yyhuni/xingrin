#!/usr/bin/env python
"""
扫描任务启动脚本

用于动态扫描容器启动时执行。
必须在 Django 导入之前获取配置并设置环境变量。
"""
import argparse
from apps.common.container_bootstrap import fetch_config_and_setup_django


def main():
    # 1. 从配置中心获取配置并初始化 Django（必须在 Django 导入之前）
    fetch_config_and_setup_django()
    
    # 2. 解析命令行参数
    parser = argparse.ArgumentParser(description="执行扫描初始化 Flow")
    parser.add_argument("--scan_id", type=int, required=True, help="扫描任务 ID")
    parser.add_argument("--target_name", type=str, required=True, help="目标名称")
    parser.add_argument("--target_id", type=int, required=True, help="目标 ID")
    parser.add_argument("--scan_workspace_dir", type=str, required=True, help="扫描工作目录")
    parser.add_argument("--engine_name", type=str, required=True, help="引擎名称")
    parser.add_argument("--scheduled_scan_name", type=str, default=None, help="定时扫描任务名称（可选）")
    
    args = parser.parse_args()
    
    # 3. 现在可以安全导入 Django 相关模块
    from apps.scan.flows.initiate_scan_flow import initiate_scan_flow
    
    # 4. 执行 Flow
    result = initiate_scan_flow(
        scan_id=args.scan_id,
        target_name=args.target_name,
        target_id=args.target_id,
        scan_workspace_dir=args.scan_workspace_dir,
        engine_name=args.engine_name,
        scheduled_scan_name=args.scheduled_scan_name,
    )
    
    print(f"Flow 执行完成: {result}")


if __name__ == "__main__":
    main()
