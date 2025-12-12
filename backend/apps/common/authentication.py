from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    前后端分离项目使用的 Session 认证
    禁用 CSRF 检查，因为 CSRF 主要防护的是同源页面表单提交
    前后端分离项目通过 CORS 控制跨域访问，不需要 CSRF
    """

    def enforce_csrf(self, request):
        # 不执行 CSRF 检查
        return
