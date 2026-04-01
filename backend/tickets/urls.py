from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.utils import extend_schema, OpenApiExample
from .views import (
    UserViewSet, ProjectViewSet, TicketViewSet,
    CommentViewSet, AuditLogViewSet,
    WorkspaceViewSet, WorkspaceMemberViewSet,
    ProjectInviteViewSet,
    TicketAttachmentViewSet, StatusDefinitionViewSet,
    ProjectAgentViewSet, PhaseViewSet, ProjectStatusPermissionViewSet,
    JoinView, ForgotPasswordView, ResetPasswordView, SendVerificationView, VerifyEmailView,
    DashboardView, ProjectsDashboardView, BlogPostViewSet,
    MediaFileViewSet,
)
from .billing import (
    CreateCheckoutSessionView, StripeWebhookView,
    CustomerPortalView, SubscriptionStatusView, ManageSeatsView,
    SyncSubscriptionView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'projects', ProjectViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'comments', CommentViewSet)
router.register(r'audit-logs', AuditLogViewSet)
router.register(r'workspaces', WorkspaceViewSet)
router.register(r'workspace-members', WorkspaceMemberViewSet)

router.register(r'attachments', TicketAttachmentViewSet)
router.register(r'status-definitions', StatusDefinitionViewSet)
router.register(r'project-agents', ProjectAgentViewSet)
router.register(r'project-invites', ProjectInviteViewSet)
router.register(r'project-status-permissions', ProjectStatusPermissionViewSet)
router.register(r'phases', PhaseViewSet)
router.register(r'blog', BlogPostViewSet, basename='blog')
router.register(r'media', MediaFileViewSet, basename='media')


# Schema overrides for SimpleJWT views
LoginView = extend_schema(
    tags=['auth'],
    summary="Login (obtain JWT)",
    description="Authenticate with username and password. Returns access and refresh JWT tokens.",
    examples=[
        OpenApiExample('Login request', value={'username': 'alice', 'password': 's3cret123'}, request_only=True),
        OpenApiExample('Login response', value={'access': 'eyJ...', 'refresh': 'eyJ...'}, response_only=True),
    ],
)(TokenObtainPairView)

RefreshView = extend_schema(
    tags=['auth'],
    summary="Refresh JWT token",
    description="Exchange a valid refresh token for a new access token.",
    examples=[
        OpenApiExample('Refresh request', value={'refresh': 'eyJ...refresh_token'}, request_only=True),
        OpenApiExample('Refresh response', value={'access': 'eyJ...new_access_token'}, response_only=True),
    ],
)(TokenRefreshView)


urlpatterns = [
    path('auth/join/', JoinView.as_view(), name='join'),
    path('auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', RefreshView.as_view(), name='token_refresh'),
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('auth/send-verification/', SendVerificationView.as_view(), name='send-verification'),
    path('auth/verify-email/', VerifyEmailView.as_view(), name='verify-email'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('projects-dashboard/', ProjectsDashboardView.as_view(), name='projects-dashboard'),
    path('billing/checkout/', CreateCheckoutSessionView.as_view(), name='billing-checkout'),
    path('billing/webhook/', StripeWebhookView.as_view(), name='billing-webhook'),
    path('billing/portal/', CustomerPortalView.as_view(), name='billing-portal'),
    path('billing/status/', SubscriptionStatusView.as_view(), name='billing-status'),
    path('billing/seats/', ManageSeatsView.as_view(), name='billing-seats'),
    path('billing/sync/', SyncSubscriptionView.as_view(), name='billing-sync'),

    path('', include(router.urls)),
]
