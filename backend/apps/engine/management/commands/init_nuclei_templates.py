"""初始化 Nuclei 模板仓库

项目安装后执行此命令，自动创建官方模板仓库记录。

使用方式：
    python manage.py init_nuclei_templates           # 只创建记录
    python manage.py init_nuclei_templates --sync    # 创建并同步（git clone）
"""

import logging
from django.core.management.base import BaseCommand

from apps.engine.models import NucleiTemplateRepo
from apps.engine.services import NucleiTemplateRepoService

logger = logging.getLogger(__name__)


# 默认仓库配置
DEFAULT_REPOS = [
    {
        "name": "nuclei-templates",
        "repo_url": "https://github.com/projectdiscovery/nuclei-templates.git",
        "description": "Nuclei 官方模板仓库，包含数千个漏洞检测模板",
    },
]


class Command(BaseCommand):
    help = "初始化 Nuclei 模板仓库（创建官方模板仓库记录）"

    def add_arguments(self, parser):
        parser.add_argument(
            "--sync",
            action="store_true",
            help="创建后立即同步（git clone），首次需要较长时间",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="强制重新创建（删除已存在的同名仓库）",
        )

    def handle(self, *args, **options):
        do_sync = options.get("sync", False)
        force = options.get("force", False)

        service = NucleiTemplateRepoService()
        created = 0
        skipped = 0
        synced = 0

        for repo_config in DEFAULT_REPOS:
            name = repo_config["name"]
            repo_url = repo_config["repo_url"]

            # 检查是否已存在
            existing = NucleiTemplateRepo.objects.filter(name=name).first()

            if existing:
                if force:
                    self.stdout.write(self.style.WARNING(
                        f"[{name}] 强制模式，删除已存在的仓库记录"
                    ))
                    service.remove_local_path_dir(existing)
                    existing.delete()
                else:
                    self.stdout.write(self.style.SUCCESS(
                        f"[{name}] 已存在，跳过创建"
                    ))
                    skipped += 1

                    # 如果需要同步且已存在，也执行同步
                    if do_sync and existing.id:
                        try:
                            result = service.refresh_repo(existing.id)
                            self.stdout.write(self.style.SUCCESS(
                                f"[{name}] 同步完成: {result.get('action', 'unknown')}, "
                                f"commit={result.get('commitHash', 'N/A')[:8]}"
                            ))
                            synced += 1
                        except Exception as e:
                            self.stdout.write(self.style.ERROR(
                                f"[{name}] 同步失败: {e}"
                            ))
                    continue

            # 创建新仓库记录
            try:
                repo = NucleiTemplateRepo.objects.create(
                    name=name,
                    repo_url=repo_url,
                )
                self.stdout.write(self.style.SUCCESS(
                    f"[{name}] 创建成功: id={repo.id}"
                ))
                created += 1

                # 初始化本地路径
                service.ensure_local_path(repo)

                # 如果需要同步
                if do_sync:
                    try:
                        self.stdout.write(self.style.WARNING(
                            f"[{name}] 正在同步（首次可能需要几分钟）..."
                        ))
                        result = service.refresh_repo(repo.id)
                        self.stdout.write(self.style.SUCCESS(
                            f"[{name}] 同步完成: {result.get('action', 'unknown')}, "
                            f"commit={result.get('commitHash', 'N/A')[:8]}"
                        ))
                        synced += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(
                            f"[{name}] 同步失败: {e}"
                        ))

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"[{name}] 创建失败: {e}"
                ))

        self.stdout.write(self.style.SUCCESS(
            f"\n初始化完成: 创建 {created}, 跳过 {skipped}, 同步 {synced}"
        ))
