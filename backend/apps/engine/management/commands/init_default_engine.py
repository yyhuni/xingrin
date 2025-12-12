"""
初始化默认扫描引擎

用法：
  python manage.py init_default_engine          # 只创建不存在的引擎（不覆盖已有）
  python manage.py init_default_engine --force  # 强制覆盖所有引擎配置
  
  cd /root/my-vulun-scan/docker
  docker compose exec server python backend/manage.py init_default_engine --force

功能：
- 读取 engine_config_example.yaml 作为默认配置
- 创建 full scan（默认引擎）+ 各扫描类型的子引擎
- 默认不覆盖已有配置，加 --force 才会覆盖
"""

from django.core.management.base import BaseCommand
from pathlib import Path

import yaml

from apps.engine.models import ScanEngine


class Command(BaseCommand):
    help = '初始化默认扫描引擎配置（默认不覆盖已有，加 --force 强制覆盖）'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='强制覆盖已有的引擎配置',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        # 读取默认配置文件
        config_path = Path(__file__).resolve().parent.parent.parent.parent / 'scan' / 'configs' / 'engine_config_example.yaml'
        
        if not config_path.exists():
            self.stdout.write(self.style.ERROR(f'配置文件不存在: {config_path}'))
            return
        
        with open(config_path, 'r', encoding='utf-8') as f:
            default_config = f.read()

        # 解析 YAML 为字典，后续用于生成子引擎配置
        try:
            config_dict = yaml.safe_load(default_config) or {}
        except yaml.YAMLError as e:
            self.stdout.write(self.style.ERROR(f'引擎配置 YAML 解析失败: {e}'))
            return

        # 1) full scan：保留完整配置
        engine = ScanEngine.objects.filter(name='full scan').first()
        if engine:
            if force:
                engine.configuration = default_config
                engine.save()
                self.stdout.write(self.style.SUCCESS(f'✓ 扫描引擎 full scan 配置已更新 (ID: {engine.id})'))
            else:
                self.stdout.write(self.style.WARNING(f'  ⊘ full scan 已存在，跳过（使用 --force 覆盖）'))
        else:
            engine = ScanEngine.objects.create(
                name='full scan',
                configuration=default_config,
            )
            self.stdout.write(self.style.SUCCESS(f'✓ 扫描引擎 full scan 已创建 (ID: {engine.id})'))

        # 2) 为每个扫描类型生成一个「单一扫描类型」的子引擎
        #    例如：subdomain_discovery, port_scan, ...
        from apps.scan.configs.command_templates import get_supported_scan_types

        supported_scan_types = set(get_supported_scan_types())

        for scan_type, scan_cfg in config_dict.items():
            # 只处理受支持且结构为 {tools: {...}} 的扫描类型
            if scan_type not in supported_scan_types:
                continue
            if not isinstance(scan_cfg, dict):
                continue
            # subdomain_discovery 使用 4 阶段新结构（无 tools 字段），其他扫描类型仍要求有 tools
            if scan_type != 'subdomain_discovery' and 'tools' not in scan_cfg:
                continue

            # 构造只包含当前扫描类型配置的 YAML
            single_config = {scan_type: scan_cfg}
            try:
                single_yaml = yaml.safe_dump(
                    single_config,
                    sort_keys=False,
                    allow_unicode=True,
                )
            except yaml.YAMLError as e:
                self.stdout.write(self.style.ERROR(f'生成子引擎 {scan_type} 配置失败: {e}'))
                continue

            engine_name = f"{scan_type}"
            sub_engine = ScanEngine.objects.filter(name=engine_name).first()
            if sub_engine:
                if force:
                    sub_engine.configuration = single_yaml
                    sub_engine.save()
                    self.stdout.write(self.style.SUCCESS(f'  ✓ 子引擎 {engine_name} 配置已更新 (ID: {sub_engine.id})'))
                else:
                    self.stdout.write(self.style.WARNING(f'  ⊘ {engine_name} 已存在，跳过（使用 --force 覆盖）'))
            else:
                sub_engine = ScanEngine.objects.create(
                    name=engine_name,
                    configuration=single_yaml,
                )
                self.stdout.write(self.style.SUCCESS(f'  ✓ 子引擎 {engine_name} 已创建 (ID: {sub_engine.id})'))
