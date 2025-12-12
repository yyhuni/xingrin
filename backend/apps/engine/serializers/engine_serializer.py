"""
扫描引擎序列化器
"""
from rest_framework import serializers
from apps.engine.models import ScanEngine


class ScanEngineSerializer(serializers.ModelSerializer):
    """扫描引擎序列化器"""
    
    class Meta:
        model = ScanEngine
        fields = [
            'id',
            'name',
            'configuration',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        """自定义序列化输出"""
        data = super().to_representation(instance)
        # 确保 configuration 字段存在且不为 null
        if data.get('configuration') is None:
            data['configuration'] = ''
        return data
    
    def validate_name(self, value):
        """验证引擎名称"""
        if not value.strip():
            raise serializers.ValidationError("引擎名称不能为空")
        return value.strip()
    
    def validate_configuration(self, value):
        """验证 YAML 配置"""
        if value:
            # 可以在这里添加 YAML 格式验证
            import yaml
            try:
                yaml.safe_load(value)
            except yaml.YAMLError as e:
                raise serializers.ValidationError(f"YAML 格式错误: {str(e)}")
        return value
