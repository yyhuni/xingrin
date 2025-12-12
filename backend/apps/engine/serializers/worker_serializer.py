"""
Worker 节点序列化器
"""
from rest_framework import serializers
from apps.engine.models import WorkerNode


class WorkerNodeSerializer(serializers.ModelSerializer):
    """
    Worker 节点序列化器
    
    优化：通过 context['loads'] 传入批量查询的 Redis 数据，避免 N+1 查询
    """
    
    # 密码只写（不返回给前端）
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    # 状态（数据库存储 + Redis 心跳补充判断）
    status = serializers.SerializerMethodField()
    
    # 负载数据（从 Redis 读取）
    info = serializers.SerializerMethodField()
    
    class Meta:
        model = WorkerNode
        fields = ['id', 'name', 'ip_address', 'ssh_port', 'username', 'status', 
                  'is_local', 'info', 'created_at', 'updated_at', 'password']
        read_only_fields = ['id', 'status', 'is_local', 'info', 'created_at', 'updated_at']
    
    def _get_load_from_context(self, worker_id: int) -> dict | None:
        """从 context 获取预加载的负载数据"""
        loads = self.context.get('loads', {})
        return loads.get(worker_id)
    
    def get_status(self, obj) -> str:
        """
        获取状态（前后端统一）：
        - pending/deploying: 直接返回数据库值
        - online/offline: 通过 Redis 心跳动态判断
        """
        # pending 和 deploying 直接返回
        if obj.status in ('pending', 'deploying'):
            return obj.status
        
        # online/offline 通过 Redis 心跳判断
        # 优先从 context 获取（批量查询）
        load = self._get_load_from_context(obj.id)
        if load is not None:
            return 'online'
        
        # 回退：单独查询 Redis
        from apps.engine.services.worker_load_service import worker_load_service
        if worker_load_service.is_online(obj.id):
            return 'online'
        return 'offline'
    
    def get_info(self, obj) -> dict | None:
        """获取负载数据
        
        注意：返回的字典键名使用 camelCase，因为 djangorestframework_camel_case
        只转换序列化器字段名，不会递归转换 SerializerMethodField 返回的嵌套字典
        """
        # 优先从 context 获取（批量查询）
        load = self._get_load_from_context(obj.id)
        if load is not None:
            return {
                'cpuPercent': load.get('cpu', 0),
                'memoryPercent': load.get('mem', 0),
            }
        
        # 回退：单独查询 Redis
        from apps.engine.services.worker_load_service import worker_load_service
        load = worker_load_service.get_load(obj.id)
        if load:
            return {
                'cpuPercent': load.get('cpu', 0),
                'memoryPercent': load.get('mem', 0),
            }
        return None
    
    def create(self, validated_data):
        """创建时保存密码"""
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """更新时，如果密码为空则不更新密码"""
        password = validated_data.get('password', '')
        if not password:
            validated_data.pop('password', None)
        return super().update(instance, validated_data)
