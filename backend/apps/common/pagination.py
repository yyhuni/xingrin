"""
自定义分页器，匹配前端响应格式
"""
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class BasePagination(PageNumberPagination):
    """
    基础分页器，统一返回格式
    
    响应格式：
    {
        "results": [...],
        "total": 100,
        "page": 1,
        "pageSize": 10,
        "totalPages": 10
    }
    """
    page_size = 10  # 默认每页 10 条
    page_size_query_param = 'pageSize'  # 允许客户端自定义每页数量
    max_page_size = 1000  # 最大每页数量限制
    
    def get_paginated_response(self, data):
        """自定义响应格式"""
        return Response({
            'results': data,  # 数据列表
            'total': self.page.paginator.count,  # 总记录数
            'page': self.page.number,  # 当前页码（从 1 开始）
            'page_size': self.page.paginator.per_page,  # 实际使用的每页大小
            'total_pages': self.page.paginator.num_pages  # 总页数
        })

