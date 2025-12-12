---
trigger: always_on
---

## 标准分层架构调用顺序

按照 **DDD（领域驱动设计）和清洁架构**原则，调用顺序应该是：

```
HTTP请求 → Views → Tasks → Services → Repositories → Models

```

---

### 📊 完整的调用链路图

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Request (前端)                       │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Views (HTTP 层)                                             │
│  - 参数验证                                                   │
│  - 权限检查                                                   │
│  - 调用 Tasks/Services                                       │
│  - 返回 HTTP 响应                                            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓ (异步)                    ↓ (同步)
┌──────────────────┐        ┌──────────────────┐
│  Tasks (任务层)   │        │  Services (业务层)│
│  - 异步执行       │        │  - 业务逻辑       │
│  - 后台作业       │───────>│  - 事务管理       │
│  - 通知发送       │        │  - 数据验证       │
└──────────────────┘        └────────┬─────────┘
                                     ↓
                         ┌──────────────────────┐
                         │ Repositories (存储层) │
                         │  - 数据访问           │
                         │  - 查询封装           │
                         │  - 批量操作           │
                         └────────┬─────────────┘
                                  ↓
                         ┌──────────────────────┐
                         │  Models (模型层)      │
                         │  - ORM 定义           │
                         │  - 数据结构           │
                         │  - 关系映射           │
                         └──────────────────────┘

```

---

### 🔄 具体调用示例

### **场景 1：同步删除（Views → Services → Repositories → Models）**

```python
# 1. Views 层 (views.py)
def some_sync_delete(self, request):
    # 参数验证
    target_ids = request.data.get('ids')

    # 调用 Service 层
    service = TargetService()
    result = service.bulk_delete_targets(target_ids)

    # 返回响应
    return Response({'message': 'deleted'})

# 2. Services 层 (services/target_service.py)
class TargetService:
    def bulk_delete_targets(self, target_ids):
        # 业务逻辑验证
        logger.info("准备删除...")

        # 调用 Repository 层
        deleted_count = self.repo.bulk_delete_by_ids(target_ids)

        # 返回结果
        return deleted_count

# 3. Repositories 层 (repositories/django_target_repository.py)
class DjangoTargetRepository:
    def bulk_delete_by_ids(self, target_ids):
        # 数据访问操作
        return Target.objects.filter(id__in=target_ids).delete()

# 4. Models 层 (models.py)
class Target(models.Model):
    # ORM 定义
    name = models.CharField(...)

```

---

### **场景 2：异步删除（Views → Tasks → Services → Repositories → Models）**

```python
# 1. Views 层 (views.py)
def destroy(self, request, *args, **kwargs):
    target = self.get_object()

    # 调用 Tasks 层（异步）
    async_bulk_delete_targets([target.id], [target.name])

    # 立即返回 202
    return Response(status=202)

# 2. Tasks 层 (tasks/target_tasks.py)
def async_bulk_delete_targets(target_ids, target_names):
    def _delete():
        # 发送通知
        create_notification("删除中...")

        # 调用 Service 层
        service = TargetService()
        result = service.bulk_delete_targets(target_ids)

        # 发送完成通知
        create_notification("删除成功")

    # 后台线程执行
    threading.Thread(target=_delete).start()

# 3. Services 层 (services/target_service.py)
class TargetService:
    def bulk_delete_targets(self, target_ids):
        # 业务逻辑
        return self.repo.bulk_delete_by_ids(target_ids)

# 4. Repositories 层 (repositories/django_target_repository.py)
class DjangoTargetRepository:
    def bulk_delete_by_ids(self, target_ids):
        # 数据访问
        return Target.objects.filter(id__in=target_ids).delete()

# 5. Models 层 (models.py)
class Target(models.Model):
    # ORM 定义
    ...

```

---

### 📋 各层职责清单

| 层级 | 职责 | 不应该做 |
| --- | --- | --- |
| **Views** | HTTP 请求处理、参数验证、权限检查 | ❌ 直接访问 Models<br>❌ 业务逻辑 |
| **Tasks** | 异步执行、后台作业、通知发送 | ❌ 直接访问 Models<br>❌ HTTP 响应 |
| **Services** | 业务逻辑、事务管理、数据验证 | ❌ 直接写 SQL<br>❌ HTTP 相关 |
| **Repositories** | 数据访问、查询封装、批量操作 | ❌ 业务逻辑<br>❌ 通知发送 |
| **Models** | ORM 定义、数据结构、关系映射 | ❌ 业务逻辑<br>❌ 复杂查询 |

---

### ✅ 最佳实践原则

1. **单向依赖**：只能向下调用，不能向上调用
    
    ```
    Views → Tasks → Services → Repositories → Models
    (上层)                                      (下层)
    
    ```
    
2. **层级隔离**：相邻层交互，禁止跨层
    - ✅ Views → Services
    - ✅ Tasks → Services
    - ✅ Services → Repositories
    - ❌ Views → Repositories（跨层）
    - ❌ Tasks → Models（跨层）
3. **依赖注入**：通过构造函数注入依赖
    
    ```python
    class TargetService:
        def __init__(self):
            self.repo = DjangoTargetRepository()  # 注入
    
    ```
    
4. **接口抽象**：使用 Protocol 定义接口
    
    ```python
    class TargetRepository(Protocol):
        def bulk_delete_by_ids(self, ids): ...
    
    ```