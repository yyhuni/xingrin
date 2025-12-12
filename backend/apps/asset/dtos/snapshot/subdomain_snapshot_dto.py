"""SubdomainSnapshot DTO"""

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.asset.dtos import SubdomainDTO


@dataclass
class SubdomainSnapshotDTO:
    """
    子域名快照 DTO
    
    用于传递快照数据，包含完整的业务上下文信息。
    快照表记录每次扫描的历史数据。
    """
    name: str
    scan_id: int  # 必填：快照必须关联扫描任务
    target_id: int  # 必填：目标ID（用于转换为资产 DTO）
    
    def to_asset_dto(self) -> 'SubdomainDTO':
        """
        转换为资产 DTO（用于保存到资产表）
        
        Returns:
            SubdomainDTO: 资产 DTO（不包含 scan_id）
        
        Note:
            资产表只存储核心数据，扫描上下文（scan_id）不保存到资产表。
            target_id 已经包含在 DTO 中，无需额外传参。
        """
        from apps.asset.dtos import SubdomainDTO
        return SubdomainDTO(name=self.name, target_id=self.target_id)
