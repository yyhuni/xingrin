"""
Worker 负载服务（Redis）

存储结构：
- worker:load:{worker_id} - Hash: {cpu, mem, updated}
- TTL: 60 秒（超时自动清理）
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

import redis
from django.conf import settings

logger = logging.getLogger(__name__)


class WorkerLoadService:
    """Worker 负载数据服务（基于 Redis）"""
    
    # Key 前缀
    KEY_PREFIX = "worker:load:"
    
    # 数据过期时间（秒）- 超过此时间未更新视为离线
    # 心跳间隔 3 秒，TTL 设为 15 秒（5 次心跳容错）
    TTL_SECONDS = 15
    
    def __init__(self):
        self._redis: Optional[redis.Redis] = None
    
    @property
    def redis(self) -> redis.Redis:
        """懒加载 Redis 连接"""
        if self._redis is None:
            self._redis = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True,
            )
        return self._redis
    
    def _key(self, worker_id: int) -> str:
        """生成 Redis key"""
        return f"{self.KEY_PREFIX}{worker_id}"
    
    def update_load(self, worker_id: int, cpu_percent: float, memory_percent: float) -> bool:
        """
        更新 Worker 负载数据
        
        Args:
            worker_id: Worker ID
            cpu_percent: CPU 使用率
            memory_percent: 内存使用率
        
        Returns:
            是否成功
        """
        try:
            key = self._key(worker_id)
            data = {
                "cpu": cpu_percent,
                "mem": memory_percent,
                "updated": datetime.now().isoformat(),
            }
            
            # 使用 pipeline 原子操作
            pipe = self.redis.pipeline()
            pipe.hset(key, mapping=data)
            pipe.expire(key, self.TTL_SECONDS)
            pipe.execute()
            
            return True
        except Exception as e:
            logger.error(f"更新 Worker 负载失败 - ID: {worker_id}: {e}")
            return False
    
    def get_load(self, worker_id: int) -> Optional[Dict[str, Any]]:
        """
        获取 Worker 负载数据
        
        Returns:
            {"cpu": float, "mem": float, "updated": str} 或 None
        """
        try:
            key = self._key(worker_id)
            data = self.redis.hgetall(key)
            
            if not data:
                return None
            
            return {
                "cpu": float(data.get("cpu", 0)),
                "mem": float(data.get("mem", 0)),
                "updated": data.get("updated", ""),
            }
        except Exception as e:
            logger.error(f"获取 Worker 负载失败 - ID: {worker_id}: {e}")
            return None
    
    def get_all_loads(self, worker_ids: list[int]) -> Dict[int, Dict[str, Any]]:
        """
        批量获取 Worker 负载数据
        
        Args:
            worker_ids: Worker ID 列表
        
        Returns:
            {worker_id: {"cpu": float, "mem": float}} 字典
        """
        result = {}
        
        try:
            pipe = self.redis.pipeline()
            for worker_id in worker_ids:
                pipe.hgetall(self._key(worker_id))
            
            responses = pipe.execute()
            
            for worker_id, data in zip(worker_ids, responses):
                if data:
                    result[worker_id] = {
                        "cpu": float(data.get("cpu", 0)),
                        "mem": float(data.get("mem", 0)),
                    }
        except Exception as e:
            logger.error(f"批量获取 Worker 负载失败: {e}")
        
        return result
    
    def delete_load(self, worker_id: int) -> bool:
        """删除 Worker 负载数据"""
        try:
            self.redis.delete(self._key(worker_id))
            return True
        except Exception as e:
            logger.error(f"删除 Worker 负载失败 - ID: {worker_id}: {e}")
            return False
    
    def is_online(self, worker_id: int) -> bool:
        """检查 Worker 是否在线（Redis 中有数据且未过期）"""
        return self.redis.exists(self._key(worker_id)) > 0


# 单例
worker_load_service = WorkerLoadService()
