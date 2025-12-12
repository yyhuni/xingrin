# 已知问题与修复记录

> 最后更新: 2024-12-12

本文档记录后端代码审查中发现的问题及其修复状态。

---

## ✅ 已修复的 Bug

### 1. KeyError: `organization_names` 缺失

**严重程度**: 🔴 严重（会导致运行时错误）

**文件**: `backend/apps/targets/services/organization_service.py`

**问题描述**: 
`delete_organizations_two_phase` 方法返回的字典缺少 `organization_names` 字段，但 View 层 (`targets/views.py`) 访问了这个 key，导致删除组织时抛出 `KeyError`。

**影响范围**:
- `DELETE /api/organizations/{id}/` - 删除单个组织
- `POST /api/organizations/bulk-delete/` - 批量删除组织

**修复方案**:
在 `delete_organizations_two_phase` 方法中添加获取组织名称的逻辑，并在返回值中包含 `organization_names`。

```python
# 修复前
return {
    'soft_deleted_count': soft_count,
    'hard_delete_scheduled': True
}

# 修复后
org_names = [name for _, name in self.repo.get_names_by_ids(organization_ids)]
return {
    'soft_deleted_count': soft_count,
    'organization_names': org_names,
    'hard_delete_scheduled': True
}
```

**修复状态**: ✅ 已修复

---

### 2. KeyError: `target_names` 缺失

**严重程度**: 🔴 严重（会导致运行时错误）

**文件**: `backend/apps/targets/services/target_service.py`

**问题描述**: 
与上述问题类似，`delete_targets_two_phase` 方法返回的字典缺少 `target_names` 字段，但 View 层访问了这个 key。

**影响范围**:
- `DELETE /api/targets/{id}/` - 删除单个目标
- `POST /api/targets/bulk-delete/` - 批量删除目标

**修复方案**:
在 `delete_targets_two_phase` 方法中添加获取目标名称的逻辑，并在返回值中包含 `target_names`。

```python
# 修复前
return {
    'soft_deleted_count': soft_count,
    'hard_delete_scheduled': True
}

# 修复后
target_names = [name for _, name in self.repo.get_names_by_ids(target_ids)]
return {
    'soft_deleted_count': soft_count,
    'target_names': target_names,
    'hard_delete_scheduled': True
}
```

**修复状态**: ✅ 已修复

---

### 3. 重复方法定义: `get_by_ids`

**严重程度**: 🟡 中等（Python 会使用后一个定义覆盖前一个）

**文件**: `backend/apps/targets/repositories/django_target_repository.py`

**问题描述**: 
`get_by_ids` 方法在同一个类中定义了两次（行 36-48 和行 171-181），第二个定义会覆盖第一个。

**影响范围**:
- 代码冗余，可能导致混淆
- 第一个定义永远不会被调用

**修复方案**:
删除重复的第二个 `get_by_ids` 方法定义。

**修复状态**: ✅ 已修复

---

### 4. 类型注解不规范

**严重程度**: 🟢 低（不影响运行，但不符合类型检查规范）

**文件**: `backend/apps/scan/repositories/django_scan_repository.py`

**问题描述**: 
`update_status_if_match` 方法中 `stopped_at` 参数的类型注解不正确：

```python
# 错误写法
stopped_at: datetime = None

# 正确写法
stopped_at: datetime | None = None
```

**修复状态**: ✅ 已修复

---

## 🟡 代码风格问题（建议修复）

### 5. 裸异常捕获 (bare except)

**严重程度**: 🟢 低（代码风格问题）

**文件**: `backend/apps/scan/utils/command_executor.py`

**问题描述**: 
使用裸 `except:` 语句而不指定异常类型，这会捕获所有异常包括 `KeyboardInterrupt` 和 `SystemExit`。

```python
# 第 145-146 行
try:
    process.kill()
except:  # 应改为 except Exception:
    pass

# 第 323-325 行
try:
    log_file_handle.close()
except:  # 应改为 except Exception:
    pass
```

**建议修复**: 将 `except:` 改为 `except Exception:`

**修复状态**: ✅ 已修复

---

## 📋 代码质量总结

### 优点
- ✅ 整体代码架构良好，遵循分层设计原则（Views → Services → Repositories → Models）
- ✅ 异常处理较为完善
- ✅ 使用软删除+硬删除两阶段策略，用户体验好
- ✅ 日志记录充分，便于问题排查
- ✅ 事务保护适当（`transaction.atomic`）
- ✅ 并发安全考虑（`select_for_update`）
- ✅ 使用装饰器自动处理数据库连接健康检查

### 需要注意的模式

1. **Views 与 Services 返回值约定**
   - Views 期望的返回值字段必须与 Services 返回的一致
   - 建议使用 TypedDict 或 dataclass 定义返回类型

2. **方法重复定义**
   - Python 不会警告同名方法覆盖
   - 建议使用 IDE 或 linter 检查

---

## 💡 代码改进建议（非 Bug）

### 6. 使用通用 Exception 抛出异常

**严重程度**: 🟢 低（代码风格）

**文件**: `backend/apps/scan/services/scan_creation_service.py:297`

**问题描述**: 
使用 `raise Exception(message)` 抛出通用异常，不利于异常类型区分和处理。

```python
# 当前写法
raise Exception(message)

# 建议写法
raise RuntimeError(message)  # 或定义专用异常类
```

**修复状态**: ⏳ 建议优化

---

## 🔍 后续建议

1. **添加类型检查**: 使用 `mypy` 进行静态类型检查
2. **添加单元测试**: 覆盖关键业务逻辑
3. **使用 TypedDict**: 定义 Service 层返回值类型，避免 KeyError
4. **代码 Review**: 重点关注 Views 和 Services 之间的数据契约
