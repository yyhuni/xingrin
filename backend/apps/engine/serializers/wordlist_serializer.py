"""字典文件序列化器"""

from rest_framework import serializers

from apps.engine.models import Wordlist


class WordlistSerializer(serializers.ModelSerializer):
    """字典文件序列化器"""

    class Meta:
        model = Wordlist
        fields = [
            "id",
            "name",
            "description",
            "file_path",
            "file_size",
            "line_count",
            "file_hash",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "file_path",
            "file_size",
            "line_count",
            "file_hash",
            "created_at",
            "updated_at",
        ]
