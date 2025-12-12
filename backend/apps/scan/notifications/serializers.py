"""通知序列化器"""

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id',
            'category',
            'title',
            'message',
            'level',
            'is_read',
            'created_at',
            'read_at',
        ]
