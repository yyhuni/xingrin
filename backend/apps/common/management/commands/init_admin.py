"""
初始化 admin 用户
用法: python manage.py init_admin [--password <password>]
"""
import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

DEFAULT_USERNAME = 'admin'
DEFAULT_PASSWORD = 'admin'  # 默认密码，建议首次登录后修改


class Command(BaseCommand):
    help = '初始化 admin 用户'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default=os.getenv('ADMIN_PASSWORD', DEFAULT_PASSWORD),
            help='admin 用户密码 (默认: admin 或 ADMIN_PASSWORD 环境变量)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='强制重置密码（如果用户已存在）'
        )

    def handle(self, *args, **options):
        password = options['password']
        force = options['force']

        try:
            user = User.objects.get(username=DEFAULT_USERNAME)
            if force:
                user.set_password(password)
                user.save()
                self.stdout.write(
                    self.style.SUCCESS(f'✓ admin 用户密码已重置')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'⚠ admin 用户已存在，跳过创建（使用 --force 重置密码）')
                )
        except User.DoesNotExist:
            User.objects.create_superuser(
                username=DEFAULT_USERNAME,
                email='admin@localhost',
                password=password
            )
            self.stdout.write(
                self.style.SUCCESS(f'✓ admin 用户创建成功')
            )
            self.stdout.write(
                self.style.WARNING(f'  用户名: {DEFAULT_USERNAME}')
            )
            self.stdout.write(
                self.style.WARNING(f'  密码: {password}')
            )
            self.stdout.write(
                self.style.WARNING(f'  ⚠ 请首次登录后修改密码!')
            )
