from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiExample
from drf_spectacular.types import OpenApiTypes
from .models import User, Project, Ticket, Comment, AuditLog, ProjectAgent, Workspace, WorkspaceMember, WorkspaceInvite
from .serializers import (
    UserSerializer, ProjectSerializer, TicketSerializer,
    CommentSerializer, AuditLogSerializer,
    WorkspaceSerializer, WorkspaceMemberSerializer, WorkspaceInviteSerializer,
    JoinRequestSerializer,
)
from .permissions import (
    IsAdminAgent, IsAdminOrReadOnly, IsAdminOrOwner,
)
from .filters import (
    TicketFilter, UserFilter, ProjectFilter, CommentFilter, AuditLogFilter,
    WorkspaceMemberFilter, WorkspaceInviteFilter,
)
from django.utils import timezone


def _jwt_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


@extend_schema(tags=['auth'])
class JoinView(APIView):
    """
    POST /api/auth/join/ — unified entry point for registration and workspace joining.

    Case 1: {username, name, password} → create HUMAN user, return JWT
    Case 2: {username, name, password, workspace_invite_token} → create HUMAN + join workspace, return JWT + workspace
    Case 3: {username, name, workspace_invite_token} → create BOT + join workspace, return {api_token, workspace, user}
    Case 4: Authenticated user + {workspace_invite_token} → join existing user to workspace, return {workspace}
    """
    permission_classes = [AllowAny]

    @extend_schema(request=JoinRequestSerializer)
    def post(self, request):
        invite_token = request.data.get('workspace_invite_token')
        username = request.data.get('username')
        name = request.data.get('name')
        password = request.data.get('password')

        invite = None
        if invite_token:
            try:
                invite = WorkspaceInvite.objects.get(token=invite_token, is_active=True)
            except WorkspaceInvite.DoesNotExist:
                return Response({'detail': 'Invalid or inactive invite.'}, status=status.HTTP_404_NOT_FOUND)
            if invite.expires_at and invite.expires_at < timezone.now():
                return Response({'detail': 'Invite has expired.'}, status=status.HTTP_400_BAD_REQUEST)
            if invite.max_uses and invite.use_count >= invite.max_uses:
                return Response({'detail': 'Invite has reached maximum uses.'}, status=status.HTTP_400_BAD_REQUEST)

        # Case 4: Authenticated user joining a workspace
        if request.user and request.user.is_authenticated:
            if not invite:
                return Response({'detail': 'workspace_invite_token is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if WorkspaceMember.objects.filter(workspace=invite.workspace, user=request.user).exists():
                return Response({'detail': 'Already a member of this workspace.'}, status=status.HTTP_400_BAD_REQUEST)
            WorkspaceMember.objects.create(workspace=invite.workspace, user=request.user, role='MEMBER')
            invite.use_count += 1
            invite.save()
            return Response({'workspace': WorkspaceSerializer(invite.workspace).data}, status=status.HTTP_200_OK)

        # Cases 1-3: Creating a new user
        if not username or not name:
            return Response({'detail': 'username and name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already taken.'}, status=status.HTTP_400_BAD_REQUEST)

        is_bot = not password
        if is_bot and not invite:
            return Response({'detail': 'Bot users require a workspace_invite_token.'}, status=status.HTTP_400_BAD_REQUEST)

        if password:
            user = User(username=username, name=name, user_type='HUMAN')
            user.set_password(password)
            user.save()
        else:
            user = User(username=username, name=name, user_type='BOT')
            user.set_unusable_password()
            user.save()

        workspace_data = None
        if invite:
            if WorkspaceMember.objects.filter(workspace=invite.workspace, user=user).exists():
                return Response({'detail': 'Already a member of this workspace.'}, status=status.HTTP_400_BAD_REQUEST)
            WorkspaceMember.objects.create(workspace=invite.workspace, user=user, role='MEMBER')
            invite.use_count += 1
            invite.save()
            workspace_data = WorkspaceSerializer(invite.workspace).data

        if is_bot:
            # Case 3
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'api_token': token.key,
                'workspace': workspace_data,
                'user': UserSerializer(user).data,
            }, status=status.HTTP_201_CREATED)

        # Case 1 or 2
        tokens = _jwt_tokens_for_user(user)
        response_data = {'user': UserSerializer(user).data, **tokens}
        if workspace_data:
            response_data['workspace'] = workspace_data
        return Response(response_data, status=status.HTTP_201_CREATED)


class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for users.

    - **GET /users/** — list all users (searchable, filterable)
    - **POST /users/** — register a new user (public)
    - **GET /users/{id}/** — retrieve user details
    - **PATCH /users/{id}/** — update user fields
    - **GET /users/me/** — current authenticated user profile
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = UserFilter
    search_fields = ['username', 'email', 'name']
    ordering_fields = ['username', 'email', 'created_at', 'is_active']
    ordering = ['username']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    @extend_schema(summary="Get current user profile", responses={200: UserSerializer})
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for projects.

    - **GET /projects/** — list projects (searchable, filterable)
    - **POST /projects/** — create a project (admin only)
    - **GET /projects/{id}/** — retrieve project with agents list
    - **PATCH /projects/{id}/** — update name, description, or agents list (send agent_ids)
    - **DELETE /projects/{id}/** — delete project (admin only)
    """
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProjectFilter
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['name']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Project.objects.prefetch_related('agents').all()

    def perform_create(self, serializer):
        with transaction.atomic():
            project = serializer.save()
            AuditLog.objects.create(
                entity_type='Project',
                entity_id=project.id,
                action='CREATE',
                performed_by=self.request.user,
                old_value=None,
                new_value={'name': project.name, 'description': project.description}
            )


@extend_schema(tags=['tickets'])
class TicketViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for tickets.

    - **GET /tickets/** — list tickets (filterable by project, status, priority, assigned_to)
    - **POST /tickets/** — create a ticket
    - **GET /tickets/{id}/** — retrieve ticket details
    - **PATCH /tickets/{id}/** — update any field: title, description, status, priority, assigned_to, project
    - **DELETE /tickets/{id}/** — delete ticket (admin only)
    """
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [IsAdminOrOwner]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TicketFilter
    search_fields = ['title', 'description', 'assigned_to__username', 'project__name']
    ordering_fields = ['id', 'title', 'status', 'priority', 'created_at', 'updated_at']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Ticket.objects.select_related('project', 'assigned_to', 'created_by').all()

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        if not ProjectAgent.objects.filter(
            project=project, agent=self.request.user
        ).exists() and self.request.user.role != 'ADMIN':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be a member of this project to create tickets in it.")
        serializer.save(created_by=self.request.user)

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAdminAgent()]
        elif self.action in ['create', 'list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsAdminOrOwner()]

    def perform_update(self, serializer):
        instance = serializer.instance
        instance._performed_by = self.request.user
        serializer.save()


class CommentViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for comments.

    - **GET /comments/** — list comments (filterable by ?ticket={id})
    - **POST /comments/** — create a comment (send ticket and body)
    - **GET /comments/{id}/** — retrieve comment
    - **PATCH /comments/{id}/** — update comment body
    - **DELETE /comments/{id}/** — delete comment
    """
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [IsAdminOrOwner]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = CommentFilter
    search_fields = ['body']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Comment.objects.select_related('ticket', 'author').all()

    def perform_create(self, serializer):
        ticket = serializer.validated_data.get('ticket')
        if not ProjectAgent.objects.filter(
            project=ticket.project, agent=self.request.user
        ).exists() and self.request.user.role != 'ADMIN':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be a member of this project to comment on its tickets.")
        serializer.save(author=self.request.user)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only audit trail.

    - **GET /audit-logs/** — list audit entries (filterable by entity_type, entity_id, action)
    - **GET /audit-logs/{id}/** — retrieve single audit entry
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AuditLogFilter
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        return AuditLog.objects.select_related('performed_by').all()


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for workspaces.

    - **GET /workspaces/** — list workspaces the current user is a member of
    - **POST /workspaces/** — create a workspace (auto-adds creator as ADMIN, creates invite link)
    - **GET /workspaces/{id}/** — retrieve workspace details
    - **PATCH /workspaces/{id}/** — update workspace name/slug
    - **DELETE /workspaces/{id}/** — delete workspace
    """
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Workspace.objects.filter(members__user=self.request.user)

    def perform_create(self, serializer):
        with transaction.atomic():
            workspace = serializer.save(owner=self.request.user)
            WorkspaceMember.objects.create(workspace=workspace, user=self.request.user, role='ADMIN')
            WorkspaceInvite.objects.create(workspace=workspace, created_by=self.request.user)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            membership = WorkspaceMember.objects.filter(workspace=obj, user=request.user).first()
            if not membership or (membership.role != 'ADMIN' and obj.owner != request.user):
                self.permission_denied(request)


class WorkspaceMemberViewSet(viewsets.ModelViewSet):
    """
    Manage workspace members.

    - **GET /workspace-members/?workspace={id}** — list members of a workspace
    - **PATCH /workspace-members/{id}/** — update member role (admin only)
    - **DELETE /workspace-members/{id}/** — remove member (admin only)
    """
    queryset = WorkspaceMember.objects.all()
    serializer_class = WorkspaceMemberSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = WorkspaceMemberFilter
    http_method_names = ['get', 'delete', 'head', 'options']

    def get_queryset(self):
        return WorkspaceMember.objects.select_related('user', 'workspace').filter(
            workspace__members__user=self.request.user
        ).distinct()

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            membership = WorkspaceMember.objects.filter(workspace=obj.workspace, user=request.user, role='ADMIN').first()
            if not membership:
                self.permission_denied(request)


class WorkspaceInviteViewSet(viewsets.ModelViewSet):
    """
    Manage workspace invite links.

    - **GET /invites/?workspace={id}** — list invites for a workspace
    - **POST /invites/** — create an invite (admin only)
    """
    queryset = WorkspaceInvite.objects.all()
    serializer_class = WorkspaceInviteSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = WorkspaceInviteFilter
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return WorkspaceInvite.objects.filter(
            workspace__members__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        workspace = serializer.validated_data['workspace']
        membership = WorkspaceMember.objects.filter(workspace=workspace, user=self.request.user, role='ADMIN').first()
        if not membership:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace admins can create invites.")
        serializer.save(created_by=self.request.user)
