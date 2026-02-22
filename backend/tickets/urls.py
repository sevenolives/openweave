from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    UserViewSet, ProjectViewSet, TicketViewSet,
    CommentViewSet, AuditLogViewSet,
    WorkspaceViewSet, WorkspaceMemberViewSet, WorkspaceInviteViewSet,
    RegisterView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'projects', ProjectViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'comments', CommentViewSet)
router.register(r'audit-logs', AuditLogViewSet)
router.register(r'workspaces', WorkspaceViewSet)
router.register(r'workspace-members', WorkspaceMemberViewSet)
router.register(r'invites', WorkspaceInviteViewSet)

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
]
