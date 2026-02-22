from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    AgentViewSet, ProjectViewSet, TicketViewSet, 
    CommentViewSet, AuditLogViewSet, ProjectAgentViewSet,
    CustomTokenObtainView
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r'agents', AgentViewSet)
router.register(r'projects', ProjectViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'comments', CommentViewSet)
router.register(r'audit-logs', AuditLogViewSet)
router.register(r'project-agents', ProjectAgentViewSet)

urlpatterns = [
    # Auth endpoints
    path('auth/login/', CustomTokenObtainView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Include all router URLs
    path('', include(router.urls)),
]
