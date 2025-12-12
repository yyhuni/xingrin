"""Wordlist 业务逻辑服务层（Service）

负责字典文件相关的业务逻辑处理
"""

import hashlib
import logging
import os
import time
from typing import Optional

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile

from apps.common.hash_utils import safe_calc_file_sha256
from apps.engine.models import Wordlist
from apps.engine.repositories import DjangoWordlistRepository


logger = logging.getLogger(__name__)


class WordlistService:
    """字典文件业务逻辑服务"""

    def __init__(self) -> None:
        """初始化服务，注入 Repository 依赖"""
        self.repo = DjangoWordlistRepository()

    def get_queryset(self):
        """获取字典列表查询集"""
        return self.repo.get_queryset()

    def get_wordlist(self, wordlist_id: int) -> Optional[Wordlist]:
        """根据 ID 获取字典"""
        return self.repo.get_by_id(wordlist_id)

    def get_wordlist_by_name(self, name: str) -> Optional[Wordlist]:
        name = (name or "").strip()
        if not name:
            return None
        return self.repo.get_by_name(name)

    def create_wordlist(
        self,
        name: str,
        description: str,
        uploaded_file: UploadedFile,
    ) -> Wordlist:
        """创建字典文件记录并保存物理文件"""

        name = (name or "").strip()
        if not name:
            raise ValidationError("字典名称不能为空")

        if self._exists_by_name(name):
            raise ValidationError("已存在同名字典")

        base_dir = getattr(settings, "WORDLISTS_BASE_PATH", "/opt/xingrin/wordlists")
        storage_dir = base_dir
        os.makedirs(storage_dir, exist_ok=True)

        # 按原始文件名保存（做最小清洗），同名上传时覆盖旧文件
        original_name = os.path.basename(uploaded_file.name or "wordlist.txt")
        # 仅清理路径分隔符，保留空格等字符，避免目录穿越
        safe_name = original_name.replace("/", "_").replace("\\", "_") or "wordlist.txt"
        # 如果没有扩展名，补一个 .txt，方便识别
        base, ext = os.path.splitext(safe_name)
        if not ext:
            safe_name = f"{base}.txt"

        full_path = os.path.join(storage_dir, safe_name)

        # 边写边算 hash
        hasher = hashlib.sha256()
        with open(full_path, "wb+") as dest:
            for chunk in uploaded_file.chunks():
                dest.write(chunk)
                hasher.update(chunk)
        file_hash = hasher.hexdigest()

        try:
            file_size = os.path.getsize(full_path)
        except OSError:
            file_size = 0

        line_count = 0
        try:
            with open(full_path, "rb") as f:
                for _ in f:
                    line_count += 1
        except OSError:
            logger.warning("统计字典行数失败: %s", full_path)

        wordlist = self.repo.create(
            name=name,
            description=description or "",
            file_path=full_path,
            file_size=file_size,
            line_count=line_count,
            file_hash=file_hash,
        )

        logger.info(
            "创建字典: id=%s, name=%s, size=%s, lines=%s, hash=%s",
            wordlist.id,
            wordlist.name,
            wordlist.file_size,
            wordlist.line_count,
            wordlist.file_hash[:16] + "..." if wordlist.file_hash else "N/A",
        )
        return wordlist

    def delete_wordlist(self, wordlist_id: int) -> bool:
        """删除字典记录及对应的物理文件"""
        wordlist: Optional[Wordlist] = self.repo.get_by_id(wordlist_id)
        if not wordlist:
            return False

        file_path = wordlist.file_path
        if file_path:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except OSError as exc:
                logger.warning("删除字典文件失败: %s - %s", file_path, exc)

        return self.repo.delete(wordlist_id)

    def _exists_by_name(self, name: str) -> bool:
        """判断是否存在同名的字典"""
        return self.repo.get_queryset().filter(name=name).exists()

    def get_wordlist_content(self, wordlist_id: int) -> Optional[str]:
        """获取字典文件内容"""
        wordlist = self.repo.get_by_id(wordlist_id)
        if not wordlist or not wordlist.file_path:
            return None

        try:
            with open(wordlist.file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except OSError as exc:
            logger.warning("读取字典文件失败: %s - %s", wordlist.file_path, exc)
            return None

    def update_wordlist_content(self, wordlist_id: int, content: str) -> Optional[Wordlist]:
        """更新字典文件内容并重新计算 hash"""
        wordlist = self.repo.get_by_id(wordlist_id)
        if not wordlist or not wordlist.file_path:
            return None

        try:
            # 写入新内容
            with open(wordlist.file_path, "w", encoding="utf-8") as f:
                f.write(content)

            # 重新计算统计信息
            file_size = os.path.getsize(wordlist.file_path)
            line_count = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
            file_hash = safe_calc_file_sha256(wordlist.file_path) or ""

            # 更新记录
            wordlist.file_size = file_size
            wordlist.line_count = line_count
            wordlist.file_hash = file_hash
            wordlist.save(update_fields=["file_size", "line_count", "file_hash", "updated_at"])

            logger.info(
                "更新字典内容: id=%s, name=%s, size=%s, lines=%s, hash=%s",
                wordlist.id,
                wordlist.name,
                wordlist.file_size,
                wordlist.line_count,
                wordlist.file_hash[:16] + "..." if wordlist.file_hash else "N/A",
            )
            return wordlist
        except OSError as exc:
            logger.error("写入字典文件失败: %s - %s", wordlist.file_path, exc)
            return None


__all__ = ["WordlistService"]
