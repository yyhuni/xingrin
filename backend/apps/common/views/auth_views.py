"""
认证相关视图
使用 Django 内置认证系统，支持 Session 认证
"""
import logging
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """
    用户登录
    POST /api/auth/login/
    """
    authentication_classes = []  # 禁用认证（绕过 CSRF）
    permission_classes = [AllowAny]
    
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response(
                {'error': '请提供用户名和密码'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            logger.info(f"用户 {username} 登录成功")
            return Response({
                'message': '登录成功',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'isStaff': user.is_staff,
                    'isSuperuser': user.is_superuser,
                }
            })
        else:
            logger.warning(f"用户 {username} 登录失败：用户名或密码错误")
            return Response(
                {'error': '用户名或密码错误'},
                status=status.HTTP_401_UNAUTHORIZED
            )


@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    """
    用户登出
    POST /api/auth/logout/
    """
    authentication_classes = []  # 禁用认证（绕过 CSRF）
    permission_classes = [AllowAny]
    
    def post(self, request):
        # 从 session 获取用户名用于日志
        user_id = request.session.get('_auth_user_id')
        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(pk=user_id)
                username = user.username
                logout(request)
                logger.info(f"用户 {username} 已登出")
            except User.DoesNotExist:
                logout(request)
        else:
            logout(request)
        return Response({'message': '已登出'})


@method_decorator(csrf_exempt, name='dispatch')
class MeView(APIView):
    """
    获取当前用户信息
    GET /api/auth/me/
    """
    authentication_classes = []  # 禁用认证（绕过 CSRF）
    permission_classes = [AllowAny]
    
    def get(self, request):
        # 从 session 获取用户
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        user_id = request.session.get('_auth_user_id')
        if user_id:
            try:
                user = User.objects.get(pk=user_id)
                return Response({
                    'authenticated': True,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'isStaff': user.is_staff,
                        'isSuperuser': user.is_superuser,
                    }
                })
            except User.DoesNotExist:
                pass
        
        return Response({
            'authenticated': False,
            'user': None
        })


@method_decorator(csrf_exempt, name='dispatch')
class ChangePasswordView(APIView):
    """
    修改密码
    POST /api/auth/change-password/
    """
    authentication_classes = []  # 禁用认证（绕过 CSRF）
    permission_classes = [AllowAny]  # 手动检查登录状态
    
    def post(self, request):
        # 手动检查登录状态（从 session 获取用户）
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        user_id = request.session.get('_auth_user_id')
        if not user_id:
            return Response(
                {'error': '请先登录'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': '用户不存在'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # CamelCaseParser 将 oldPassword -> old_password
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not old_password or not new_password:
            return Response(
                {'error': '请提供旧密码和新密码'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not user.check_password(old_password):
            return Response(
                {'error': '旧密码错误'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.set_password(new_password)
        user.save()
        
        # 更新 session，避免用户被登出
        update_session_auth_hash(request, user)
        
        logger.info(f"用户 {user.username} 已修改密码")
        return Response({'message': '密码修改成功'})
