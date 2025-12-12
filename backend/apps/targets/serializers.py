from rest_framework import serializers
from django.db import IntegrityError
from django.db.models import Count
from .models import Organization, Target
from apps.common.normalizer import normalize_target
from apps.common.validators import detect_target_type
from apps.asset.models import Vulnerability


class SimpleOrganizationSerializer(serializers.ModelSerializer):
    """
    简化版组织序列化器 - 用于嵌套在其他序列化器中
    
    注意事项:
    1. 只包含基本字段 (id, name)，不嵌套 targets
    2. 避免循环引用：Organization ↔ Target 是多对多关系
       如果双向嵌套会导致无限递归
    3. 适用场景：
       - 在 TargetSerializer 中显示所属组织列表
       - 在其他需要显示组织基本信息的地方
    """
    class Meta:
        model = Organization
        fields = ['id', 'name']


class TargetSerializer(serializers.ModelSerializer):
    """
    目标序列化器
    
    性能优化说明:
    1. 使用嵌套序列化器 SimpleOrganizationSerializer 显示关联的组织
    2. ⚠️ 重要：ViewSet 必须使用 prefetch_related('organizations')
       否则会产生 N+1 查询问题：
       - 没有预加载：100 个目标 = 1 + 100 = 101 次查询
       - 正确预加载：100 个目标 = 1 + 1 = 2 次查询
    
    已优化的视图:
    - TargetViewSet: queryset = Target.objects.prefetch_related('organizations')
    - OrganizationViewSet.targets(): queryset.prefetch_related('organizations')
    """
    organizations = SimpleOrganizationSerializer(many=True, read_only=True)
    
    class Meta:
        model = Target
        fields = ['id', 'name', 'type', 'created_at', 'last_scanned_at', 'organizations']
        read_only_fields = ['id', 'created_at', 'type']
    
    def create(self, validated_data):
        """创建目标时自动规范化、检测目标类型"""
        name = validated_data.get('name', '')
        try:
            # 1. 规范化
            normalized_name = normalize_target(name)
            # 2. 验证并检测类型
            target_type = detect_target_type(normalized_name)
            # 3. 写入
            validated_data['name'] = normalized_name
            validated_data['type'] = target_type
            
            return super().create(validated_data)
        except ValueError as e:
            raise serializers.ValidationError({'name': str(e)})
        except IntegrityError:
            # 处理唯一性约束冲突
            raise serializers.ValidationError({
                'name': f'目标 "{normalized_name}" 已存在'
            })
    
    def update(self, instance, validated_data):
        """更新目标时，如果 name 变化则重新规范化和检测类型"""
        # 如果 name 发生变化，重新规范化和检测类型
        if 'name' in validated_data and validated_data['name'] != instance.name:
            try:
                # 1. 规范化
                normalized_name = normalize_target(validated_data['name'])
                # 2. 验证并检测类型
                target_type = detect_target_type(normalized_name)
                # 3. 写入
                validated_data['name'] = normalized_name
                validated_data['type'] = target_type
            except ValueError as e:
                raise serializers.ValidationError({'name': str(e)})
        
        try:
            return super().update(instance, validated_data)
        except IntegrityError:
            # 处理唯一性约束冲突
            raise serializers.ValidationError({
                'name': f'目标 "{validated_data.get("name", instance.name)}" 已存在'
            })


class TargetDetailSerializer(serializers.ModelSerializer):
    """
    目标详情序列化器 - 包含统计数据
    
    用于单个目标详情页面（只读），包含各类资产的统计数量
    
    Note:
        - 此序列化器只用于 retrieve action（只读操作）
        - 不包含 create/update 方法，因为详情页不需要修改功能
        - 所有字段都是只读的，包括 name
    """
    organizations = SimpleOrganizationSerializer(many=True, read_only=True)
    summary = serializers.SerializerMethodField()
    
    class Meta:
        model = Target
        fields = ['id', 'name', 'type', 'created_at', 'last_scanned_at', 'organizations', 'summary']
        read_only_fields = ['id', 'name', 'type', 'created_at', 'last_scanned_at', 'summary']
    
    def get_summary(self, obj):
        """计算目标资产统计数据
        
        统计该目标下的资产数量：
        - subdomains: 子域名数量
        - websites: 网站数量
        - endpoints: 端点数量
        - ips: IP地址数量
        - directories: 目录数量
        - vulnerabilities: 漏洞统计（暂时返回 0，待后续实现）
        
        性能说明：
        - 使用 .count() 查询获取统计数据
        - 每个统计字段执行一次数据库查询
        - 不使用 annotate 预聚合的原因：多个 Count(distinct=True) 在大数据量时性能较差
        - 对于详情页单条记录，直接 .count() 查询性能可接受
        - ips 统计使用 distinct() 去重，因为 HostPortMapping 中同一 IP 可能有多个端口
        """
        # 基础资产统计（直接使用关联关系 count）
        subdomains_count = obj.subdomains.count()
        websites_count = obj.websites.count()
        endpoints_count = obj.endpoints.count()
        ips_count = obj.host_port_mappings.values('ip').distinct().count()
        directories_count = obj.directories.count()

        # 漏洞统计：按目标维度实时统计 Vulnerability 资产表
        vuln_qs = obj.vulnerabilities.all()

        total = vuln_qs.count()

        severity_stats = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
        }

        for row in vuln_qs.values('severity').annotate(count=Count('id')):
            sev = row['severity'] or ''
            count = row['count'] or 0
            if sev in severity_stats:
                severity_stats[sev] = count

        return {
            'subdomains': subdomains_count,
            'websites': websites_count,
            'endpoints': endpoints_count,
            'ips': ips_count,
            'directories': directories_count,
            'vulnerabilities': {
                'total': total,
                **severity_stats,
            }
        }


class OrganizationSerializer(serializers.ModelSerializer):
    # 使用 IntegerField 接收由 annotate 预计算的 target_count
    # 避免 N+1 查询问题（在 ViewSet 的 get_queryset 中使用 annotate 预计算）
    target_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Organization
        fields = ['id', 'name', 'description', 'created_at', 'target_count']
        read_only_fields = ['id', 'created_at', 'target_count']


class BatchCreateTargetSerializer(serializers.Serializer):
    """
    批量创建目标的序列化器
    
    安全限制：
    - 最多支持 1000 个目标的批量创建
    - 防止恶意用户提交大量数据导致服务器过载
    """
    
    # 批量创建的最大数量限制
    MAX_BATCH_SIZE = 1000
    
    # 目标列表
    targets = serializers.ListField(
        child=serializers.DictField(),
        help_text='目标列表，每个目标包含 name 字段（type 会自动检测）'
    )
    
    # 可选：关联的组织ID
    organization_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='可选：关联到指定组织的ID'
    )
    
    def validate_targets(self, value):
        """验证目标列表"""
        if not value:
            raise serializers.ValidationError("目标列表不能为空")
        
        # 检查数量限制，防止服务器过载
        if len(value) > self.MAX_BATCH_SIZE:
            raise serializers.ValidationError(
                f"批量创建最多支持 {self.MAX_BATCH_SIZE} 个目标，当前提交了 {len(value)} 个"
            )
        
        # 验证每个目标的必填字段
        for idx, target in enumerate(value):
            if 'name' not in target:
                raise serializers.ValidationError(f"第 {idx + 1} 个目标缺少 name 字段")
            if not target['name']:
                raise serializers.ValidationError(f"第 {idx + 1} 个目标的 name 不能为空")
        
        return value
    
