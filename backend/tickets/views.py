from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers as drf_serializers
from .models import User, Project, Ticket, Comment, AuditLog, ProjectAgent, Workspace, WorkspaceMember, WorkspaceInvite, TicketAttachment
from .serializers import (
    UserSerializer, ProjectSerializer, TicketSerializer,
    CommentSerializer, AuditLogSerializer,
    WorkspaceSerializer, WorkspaceMemberSerializer, WorkspaceInviteSerializer,
    JoinRequestSerializer, TicketAttachmentSerializer,
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


# Reusable error response schema
_error_detail = inline_serializer('ErrorDetail', fields={'detail': drf_serializers.CharField()})


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

    @extend_schema(
        summary="Register or join a workspace",
        description=(
            "Unified endpoint for user registration and workspace joining. Supports 4 cases:\n\n"
            "**Case 1 — Register human (no workspace):** Send `{username, name, password}`. "
            "Returns `{user, access, refresh}` (HTTP 201).\n\n"
            "**Case 2 — Register human + join workspace:** Send `{username, name, password, workspace_invite_token}`. "
            "Returns `{user, workspace, access, refresh}` (HTTP 201).\n\n"
            "**Case 3 — Register bot + join workspace:** Send `{username, name, workspace_invite_token}` (no password). "
            "Returns `{user, workspace, api_token}` (HTTP 201).\n\n"
            "**Case 4 — Authenticated user joins workspace:** Send `{workspace_invite_token}` with a valid JWT. "
            "Returns `{workspace}` (HTTP 200).\n\n"
            "**Errors:** 400 for missing fields, username taken, expired/maxed invite, already a member. "
            "404 for invalid invite token."
        ),
        request=JoinRequestSerializer,
        responses={
            201: OpenApiTypes.OBJECT,
            200: OpenApiTypes.OBJECT,
            400: _error_detail,
            404: _error_detail,
        },
        examples=[
            OpenApiExample(
                'Case 1: Register human',
                value={'username': 'alice', 'name': 'Alice', 'password': 's3cret123'},
                request_only=True,
            ),
            OpenApiExample(
                'Case 1: Response',
                value={
                    'user': {'id': 1, 'username': 'alice', 'email': '', 'name': 'Alice', 'user_type': 'HUMAN', 'role': 'MEMBER', 'skills': [], 'is_active': True},
                    'access': 'eyJ...access_token',
                    'refresh': 'eyJ...refresh_token',
                },
                response_only=True, status_codes=['201'],
            ),
            OpenApiExample(
                'Case 2: Register human + join workspace',
                value={'username': 'bob', 'name': 'Bob', 'password': 's3cret123', 'workspace_invite_token': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'},
                request_only=True,
            ),
            OpenApiExample(
                'Case 2: Response',
                value={
                    'user': {'id': 2, 'username': 'bob', 'email': '', 'name': 'Bob', 'user_type': 'HUMAN', 'role': 'MEMBER', 'skills': [], 'is_active': True},
                    'workspace': {'id': 1, 'name': 'Acme', 'slug': 'acme', 'owner': 1, 'member_count': 2, 'created_at': '2025-01-01T00:00:00Z'},
                    'access': 'eyJ...access_token',
                    'refresh': 'eyJ...refresh_token',
                },
                response_only=True, status_codes=['201'],
            ),
            OpenApiExample(
                'Case 3: Register bot',
                value={'username': 'support-bot', 'name': 'Support Bot', 'workspace_invite_token': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'},
                request_only=True,
            ),
            OpenApiExample(
                'Case 3: Response',
                value={
                    'api_token': 'abc123tokenkey',
                    'workspace': {'id': 1, 'name': 'Acme', 'slug': 'acme', 'owner': 1, 'member_count': 3, 'created_at': '2025-01-01T00:00:00Z'},
                    'user': {'id': 3, 'username': 'support-bot', 'email': '', 'name': 'Support Bot', 'user_type': 'BOT', 'role': 'MEMBER', 'skills': [], 'is_active': True},
                },
                response_only=True, status_codes=['201'],
            ),
            OpenApiExample(
                'Case 4: Join workspace (authed)',
                value={'workspace_invite_token': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'},
                request_only=True,
            ),
            OpenApiExample(
                'Case 4: Response',
                value={'workspace': {'id': 1, 'name': 'Acme', 'slug': 'acme', 'owner': 1, 'member_count': 4, 'created_at': '2025-01-01T00:00:00Z'}},
                response_only=True, status_codes=['200'],
            ),
            OpenApiExample(
                'Error: username taken',
                value={'detail': 'Username already taken.'},
                response_only=True, status_codes=['400'],
            ),
            OpenApiExample(
                'Error: invite expired',
                value={'detail': 'Invite has expired.'},
                response_only=True, status_codes=['400'],
            ),
            OpenApiExample(
                'Error: invalid invite',
                value={'detail': 'Invalid or inactive invite.'},
                response_only=True, status_codes=['404'],
            ),
        ],
    )
    def post(self, request):
        invite_token = request.data.get('workspace_invite_token')
        username = request.data.get('username')
        name = request.data.get('name')
        password = request.data.get('password')
        description = request.data.get('description', '')

        invite = None
        if invite_token:
            try:
                invite = WorkspaceInvite.objects.get(token=invite_token, is_active=True)
            except (WorkspaceInvite.DoesNotExist, ValueError, Exception):
                return Response({'detail': 'Invalid or inactive invite.'}, status=status.HTTP_400_BAD_REQUEST)
            if invite.expires_at and invite.expires_at < timezone.now():
                return Response({'detail': 'Invite has expired.'}, status=status.HTTP_400_BAD_REQUEST)
            if invite.max_uses and invite.use_count >= invite.max_uses:
                return Response({'detail': 'Invite has reached maximum uses.'}, status=status.HTTP_400_BAD_REQUEST)

        # Case 4: Authenticated user joining a workspace
        if request.user and request.user.is_authenticated:
            if not invite:
                return Response({'detail': 'workspace_invite_token is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if invite.workspace.owner_id == request.user.id:
                return Response({'detail': 'You are the owner of this workspace.'}, status=status.HTTP_400_BAD_REQUEST)
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
            user = User(username=username, name=name, user_type='HUMAN', description=description)
            user.set_password(password)
            user.save()
        else:
            user = User(username=username, name=name, user_type='BOT', description=description)
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


@extend_schema(tags=['users'])
class UserViewSet(viewsets.ModelViewSet):
    """User operations."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = UserFilter
    search_fields = ['username', 'email', 'name']
    ordering_fields = ['username', 'email', 'created_at', 'is_active']
    ordering = ['username']
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        """Filter users to only those in the same workspaces as the requesting user."""
        user = self.request.user
        if user.is_superuser:
            return User.objects.all()
        from django.db.models import Q
        # Get all workspace IDs the user belongs to (as member or owner)
        member_ws = WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        owned_ws = Workspace.objects.filter(owner=user).values_list('id', flat=True)
        ws_ids = list(set(list(member_ws) + list(owned_ws)))
        if not ws_ids:
            return User.objects.filter(id=user.id)
        # Users who are members or owners of those workspaces
        return User.objects.filter(
            Q(workspace_memberships__workspace_id__in=ws_ids) |
            Q(owned_workspaces__id__in=ws_ids) |
            Q(id=user.id)
        ).distinct()

    @extend_schema(
        summary="List users",
        description="List users. Requires `workspace` or `project` filter. Supports search by username/email/name.",
        parameters=[
            OpenApiParameter(name='workspace', description='Filter by workspace ID (required)', type=int),
            OpenApiParameter(name='project', description='Filter by project ID', type=int),
            OpenApiParameter(name='search', description='Search in username, email, name', type=str),
            OpenApiParameter(name='user_type', description='Filter by user_type (HUMAN, BOT)', type=str),
            OpenApiParameter(name='role', description='Filter by role (ADMIN, MEMBER)', type=str),
            OpenApiParameter(name='is_active', description='Filter by active status', type=bool),
        ],
    )
    def list(self, request, *args, **kwargs):
        workspace_id = request.query_params.get('workspace')
        project_id = request.query_params.get('project')
        if not workspace_id and not project_id:
            return Response({'detail': 'workspace or project filter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        # Verify user has access to the workspace
        if workspace_id:
            user = request.user
            if not user.is_superuser:
                is_member = WorkspaceMember.objects.filter(workspace_id=workspace_id, user=user).exists()
                is_owner = Workspace.objects.filter(id=workspace_id, owner=user).exists()
                if not is_member and not is_owner:
                    return Response({'detail': 'You do not have access to this workspace.'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    @extend_schema(exclude=True)
    def retrieve(self, request, *args, **kwargs):
        """Individual user retrieval disabled. Use /users/me/ or /workspace-members/."""
        return Response({'detail': 'Use /users/me/ for your profile or /workspace-members/ for member info.'}, status=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Get current user profile",
        description="Returns the profile of the currently authenticated user.",
        responses={200: UserSerializer},
    )
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Get or update current user profile."""
        if request.method == 'PATCH':
            # Users can update their own name, email, description, skills
            allowed_fields = {'name', 'email', 'description', 'skills'}
            data = {k: v for k, v in request.data.items() if k in allowed_fields}
            serializer = self.get_serializer(request.user, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @extend_schema(
        summary="Update user",
        description="Update user fields. Admin only. Editable fields: name, email, role, skills, is_active.",
        responses={200: UserSerializer, 400: _error_detail},
        examples=[
            OpenApiExample(
                'Update role',
                value={'role': 'ADMIN'},
                request_only=True,
            ),
        ],
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)


@extend_schema(tags=['projects'])
class ProjectViewSet(viewsets.ModelViewSet):
    """CRUD operations for projects."""
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
        qs = Project.objects.all()
        user = self.request.user
        if user.is_superuser or user.role == 'ADMIN':
            return qs
        # Show projects in workspaces the user belongs to (as member or owner)
        from django.db.models import Q
        member_ws = list(WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True))
        owned_ws = list(Workspace.objects.filter(owner=user).values_list('id', flat=True))
        ws_ids = list(set(member_ws + owned_ws))
        if ws_ids:
            return qs.filter(
                Q(workspace_id__in=ws_ids) | Q(agents=user)
            ).distinct()
        return qs.filter(agents=user).distinct()

    @extend_schema(
        summary="List projects",
        description="List all projects with their agents. Supports search by name/description and filtering by workspace.",
        parameters=[
            OpenApiParameter(name='search', description='Search in name, description', type=str),
            OpenApiParameter(name='workspace', description='Filter by workspace ID', type=int),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Create project",
        description="Create a new project. Admin only. Optionally assign agents via agent_ids.",
        responses={201: ProjectSerializer, 400: _error_detail},
        examples=[
            OpenApiExample(
                'Create project',
                value={'name': 'Billing', 'description': 'Billing support', 'workspace': 1, 'agent_ids': [2, 3]},
                request_only=True,
            ),
        ],
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(summary="Get project detail", description="Retrieve a project with its agents list.")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Update project",
        description="Update project name, description, or agents (via agent_ids). Admin only.",
        responses={200: ProjectSerializer, 400: _error_detail},
        examples=[
            OpenApiExample('Update agents', value={'agent_ids': [2, 3, 4]}, request_only=True),
        ],
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(summary="Delete project", description="Delete a project. Admin only. Project must have no tickets.", responses={204: None, 400: _error_detail})
    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        if project.tickets.exists():
            return Response({'detail': 'Cannot delete a project that still has tickets. Delete or move all tickets first.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

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
    """CRUD operations for tickets."""
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TicketFilter
    search_fields = ['title', 'description', 'assigned_to__username', 'project__name']
    ordering_fields = ['id', 'title', 'status', 'priority', 'created_at', 'updated_at']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Ticket.objects.select_related('project', 'assigned_to', 'created_by')
        user = self.request.user
        if user.is_superuser or user.role == 'ADMIN':
            return qs.all()
        from django.db.models import Q
        member_ws = WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        owned_ws = Workspace.objects.filter(owner=user).values_list('id', flat=True)
        ws_ids = list(set(list(member_ws) + list(owned_ws)))
        return qs.filter(
            Q(project__agents=user) | Q(project__workspace_id__in=ws_ids)
        ).distinct()

    @extend_schema(
        summary="List tickets",
        description="List tickets. Filterable by project, status, priority, assigned_to. Searchable by title, description, assigned_to username, project name.",
        parameters=[
            OpenApiParameter(name='project', description='Filter by project ID', type=int),
            OpenApiParameter(name='status', description='Filter by status (OPEN, IN_PROGRESS, RESOLVED, CLOSED, BLOCKED)', type=str),
            OpenApiParameter(name='priority', description='Filter by priority (LOW, MEDIUM, HIGH, CRITICAL)', type=str),
            OpenApiParameter(name='assigned_to', description='Filter by assigned user ID', type=int),
            OpenApiParameter(name='search', description='Search in title, description, assigned_to username, project name', type=str),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Create ticket",
        description="Create a new ticket. You must be a member of the project (or ADMIN). created_by is set automatically.",
        responses={201: TicketSerializer, 400: _error_detail, 403: _error_detail},
        examples=[
            OpenApiExample(
                'Create ticket',
                value={'project': 1, 'title': 'Login broken', 'description': 'Cannot log in with valid creds', 'priority': 'HIGH'},
                request_only=True,
            ),
        ],
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(summary="Get ticket detail", description="Retrieve full ticket details including project, assigned_to, and created_by.")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Update ticket",
        description=(
            "Update ticket fields: title, description, status, priority, assigned_to, project. "
            "Status transitions: OPEN → IN_PROGRESS → RESOLVED → CLOSED, BLOCKED ↔ IN_PROGRESS. "
            "assigned_to must be a member of the project."
        ),
        responses={200: TicketSerializer, 400: _error_detail},
        examples=[
            OpenApiExample('Update status', value={'status': 'IN_PROGRESS'}, request_only=True),
            OpenApiExample('Assign ticket', value={'assigned_to': 2, 'status': 'IN_PROGRESS'}, request_only=True),
        ],
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(summary="Delete ticket", description="Delete a ticket. Admin only.", responses={204: None, 403: _error_detail})
    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'ADMIN':
            return Response({'detail': 'Only admins can delete tickets.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

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
        from django.core.exceptions import ValidationError as DjangoValidationError
        instance = serializer.instance
        user = self.request.user

        # Non-admin users can only update tickets assigned to them
        if user.role != 'ADMIN' and not user.is_superuser:
            if instance.assigned_to_id != user.id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only work on tickets assigned to you.")

        instance._performed_by = user
        try:
            serializer.save()
        except DjangoValidationError as e:
            raise drf_serializers.ValidationError(e.message_dict if hasattr(e, 'message_dict') else {'detail': e.messages})


@extend_schema(tags=['attachments'])
class TicketAttachmentViewSet(viewsets.ModelViewSet):
    """Upload, list, and delete file attachments on tickets."""
    queryset = TicketAttachment.objects.all()
    serializer_class = TicketAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = TicketAttachment.objects.select_related('uploaded_by', 'ticket')
        user = self.request.user
        if user.is_superuser or user.role == 'ADMIN':
            return qs.all()
        from django.db.models import Q
        member_ws = WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        owned_ws = Workspace.objects.filter(owner=user).values_list('id', flat=True)
        ws_ids = list(set(list(member_ws) + list(owned_ws)))
        return qs.filter(
            Q(ticket__project__agents=user) | Q(ticket__project__workspace_id__in=ws_ids)
        ).distinct()

    @extend_schema(
        summary="Upload attachment",
        description="Upload a file attachment to a ticket. Use multipart/form-data with 'file' and 'ticket' fields.",
    )
    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            import traceback
            return Response({'detail': str(e), 'trace': traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get('file')
        if not uploaded_file:
            raise drf_serializers.ValidationError({'file': 'No file provided.'})
        import logging
        logger = logging.getLogger(__name__)
        try:
            serializer.save(
                uploaded_by=self.request.user,
                filename=uploaded_file.name,
            )
        except Exception as e:
            logger.exception("Attachment upload failed")
            raise

    @extend_schema(summary="List attachments", description="List attachments. Filter by ?ticket={id}.")
    def list(self, request, *args, **kwargs):
        ticket_id = request.query_params.get('ticket')
        if ticket_id:
            self.queryset = self.get_queryset().filter(ticket_id=ticket_id)
        return super().list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if request.user.role != 'ADMIN' and obj.uploaded_by != request.user:
            return Response({'detail': 'You can only delete your own attachments.'}, status=status.HTTP_403_FORBIDDEN)
        obj.file.delete(save=False)
        return super().destroy(request, *args, **kwargs)


@extend_schema(tags=['comments'])
class CommentViewSet(viewsets.ModelViewSet):
    """CRUD operations for comments."""
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = CommentFilter
    search_fields = ['body']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = Comment.objects.select_related('ticket', 'author')
        user = self.request.user
        if user.is_superuser or user.role == 'ADMIN':
            return qs.all()
        from django.db.models import Q
        member_ws = WorkspaceMember.objects.filter(user=user).values_list('workspace_id', flat=True)
        owned_ws = Workspace.objects.filter(owner=user).values_list('id', flat=True)
        ws_ids = list(set(list(member_ws) + list(owned_ws)))
        return qs.filter(
            Q(ticket__project__agents=user) | Q(ticket__project__workspace_id__in=ws_ids)
        ).distinct()

    @extend_schema(
        summary="List comments",
        description="List comments. Filter by ticket ID with ?ticket={id}.",
        parameters=[
            OpenApiParameter(name='ticket', description='Filter by ticket ID', type=int),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Create comment",
        description="Create a comment on a ticket. You must be a member of the ticket's project (or ADMIN). Author is set automatically.",
        responses={201: CommentSerializer, 400: _error_detail, 403: _error_detail},
        examples=[
            OpenApiExample('Create comment', value={'ticket': 1, 'body': 'Looking into this now.'}, request_only=True),
        ],
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(summary="Get comment detail", description="Retrieve a single comment.")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Update comment",
        description="Update comment body. Only the author or admin can update.",
        responses={200: CommentSerializer, 400: _error_detail},
        examples=[OpenApiExample('Update body', value={'body': 'Updated note.'}, request_only=True)],
    )
    def partial_update(self, request, *args, **kwargs):
        obj = self.get_object()
        if request.user.role != 'ADMIN' and obj.author != request.user:
            return Response({'detail': 'You can only edit your own comments.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(summary="Delete comment", description="Delete a comment. Only the author or admin can delete.", responses={204: None, 403: _error_detail})
    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if request.user.role != 'ADMIN' and obj.author != request.user:
            return Response({'detail': 'You can only delete your own comments.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        ticket = serializer.validated_data.get('ticket')
        if not ProjectAgent.objects.filter(
            project=ticket.project, agent=self.request.user
        ).exists() and self.request.user.role != 'ADMIN':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be a member of this project to comment on its tickets.")
        serializer.save(author=self.request.user)


@extend_schema(tags=['audit'])
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail."""
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AuditLogFilter
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        return AuditLog.objects.select_related('performed_by').all()

    @extend_schema(
        summary="List audit logs",
        description="List audit log entries. Filterable by entity_type, entity_id, action, performed_by.",
        parameters=[
            OpenApiParameter(name='entity_type', description='Filter by entity type (Ticket, Project, etc.)', type=str),
            OpenApiParameter(name='entity_id', description='Filter by entity ID', type=int),
            OpenApiParameter(name='action', description='Filter by action (CREATE, UPDATE, DELETE, STATUS_CHANGE)', type=str),
            OpenApiParameter(name='performed_by', description='Filter by user ID', type=int),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(summary="Get audit log entry", description="Retrieve a single audit log entry.")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)


@extend_schema(tags=['workspaces'])
class WorkspaceViewSet(viewsets.ModelViewSet):
    """CRUD operations for workspaces."""
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAdminOrReadOnly]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        from django.db.models import Q
        return Workspace.objects.filter(
            Q(members__user=self.request.user) | Q(owner=self.request.user)
        ).distinct()

    @extend_schema(summary="List workspaces", description="List workspaces the current user belongs to.")
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Create workspace",
        description="Create a new workspace. The creator is automatically added as ADMIN and a default invite link is created.",
        responses={201: WorkspaceSerializer, 400: _error_detail},
        examples=[
            OpenApiExample('Create workspace', value={'name': 'Acme Corp', 'slug': 'acme-corp'}, request_only=True),
        ],
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(summary="Get workspace detail", description="Retrieve workspace details.")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Update workspace",
        description="Update workspace name or slug. Only workspace admins or owner can update.",
        responses={200: WorkspaceSerializer, 400: _error_detail},
        examples=[OpenApiExample('Update name', value={'name': 'Acme Inc'}, request_only=True)],
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(summary="Delete workspace", description="Delete a workspace. Admin or owner only.", responses={204: None})
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        with transaction.atomic():
            workspace = serializer.save(owner=self.request.user)
            # Owner is on the workspace record — NOT in the members table
            WorkspaceInvite.objects.create(workspace=workspace, created_by=self.request.user)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            # Owner always has full access
            if obj.owner == request.user:
                return
            membership = WorkspaceMember.objects.filter(workspace=obj, user=request.user, role='ADMIN').first()
            if not membership:
                self.permission_denied(request)


@extend_schema(tags=['members'])
class WorkspaceMemberViewSet(viewsets.ModelViewSet):
    """Manage workspace members."""
    queryset = WorkspaceMember.objects.all()
    serializer_class = WorkspaceMemberSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = WorkspaceMemberFilter
    http_method_names = ['get', 'delete', 'head', 'options']

    @extend_schema(
        summary="List workspace members",
        description="List members of a workspace. Filter by workspace ID.",
        parameters=[
            OpenApiParameter(name='workspace', description='Filter by workspace ID (required)', type=int),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(exclude=True)
    def retrieve(self, request, *args, **kwargs):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Remove workspace member",
        description="Remove a member from a workspace. Only workspace admins can remove members. Workspace owner cannot be removed.",
        responses={204: None, 400: _error_detail, 403: _error_detail},
    )
    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.user_id == obj.workspace.owner_id:
            return Response({'detail': 'Cannot remove the workspace owner.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        from django.db.models import Q
        return WorkspaceMember.objects.select_related('user', 'workspace').filter(
            Q(workspace__members__user=self.request.user) | Q(workspace__owner=self.request.user)
        ).distinct()

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            # Owner always has full access
            if obj.workspace.owner == request.user:
                return
            membership = WorkspaceMember.objects.filter(workspace=obj.workspace, user=request.user, role='ADMIN').first()
            if not membership:
                self.permission_denied(request)


@extend_schema(tags=['invites'])
class WorkspaceInviteViewSet(viewsets.ModelViewSet):
    """Manage workspace invite links."""
    queryset = WorkspaceInvite.objects.all()
    serializer_class = WorkspaceInviteSerializer
    permission_classes = [IsAdminOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_class = WorkspaceInviteFilter
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    @extend_schema(
        summary="List invites",
        description="List invite links for a workspace. Filter by workspace ID.",
        parameters=[
            OpenApiParameter(name='workspace', description='Filter by workspace ID', type=int),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(exclude=True)
    def retrieve(self, request, *args, **kwargs):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    @extend_schema(
        summary="Create invite",
        description="Create a workspace invite link. Only workspace admins can create invites.",
        responses={201: WorkspaceInviteSerializer, 400: _error_detail, 403: _error_detail},
        examples=[
            OpenApiExample('Create invite', value={'workspace': 1, 'max_uses': 10, 'expires_at': '2025-12-31T23:59:59Z'}, request_only=True),
            OpenApiExample('Unlimited invite', value={'workspace': 1}, request_only=True),
        ],
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def get_queryset(self):
        from django.db.models import Q
        return WorkspaceInvite.objects.filter(
            Q(workspace__members__user=self.request.user) | Q(workspace__owner=self.request.user)
        ).distinct()

    def perform_create(self, serializer):
        workspace = serializer.validated_data['workspace']
        # Owner or admin can create invites
        if workspace.owner == self.request.user:
            serializer.save(created_by=self.request.user)
            return
        membership = WorkspaceMember.objects.filter(workspace=workspace, user=self.request.user, role='ADMIN').first()
        if not membership:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace admins or owner can create invites.")
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        workspace = instance.workspace
        if workspace.owner != self.request.user:
            membership = WorkspaceMember.objects.filter(workspace=workspace, user=self.request.user, role='ADMIN').first()
            if not membership:
                raise PermissionDenied("Only workspace admins or owner can delete invites.")
        instance.delete()


class DashboardView(APIView):
    """Dashboard stats for a workspace."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=['dashboard'],
        summary="Get dashboard stats",
        parameters=[
            OpenApiParameter(name='workspace', description='Workspace ID', type=int, required=True),
        ],
        responses={200: inline_serializer('DashboardStats', fields={
            'total_tickets': drf_serializers.IntegerField(),
            'open': drf_serializers.IntegerField(),
            'in_progress': drf_serializers.IntegerField(),
            'in_testing': drf_serializers.IntegerField(),
            'blocked': drf_serializers.IntegerField(),
            'resolved': drf_serializers.IntegerField(),
            'closed': drf_serializers.IntegerField(),
            'resolved_today': drf_serializers.IntegerField(),
            'total_projects': drf_serializers.IntegerField(),
            'total_members': drf_serializers.IntegerField(),
            'my_tickets': drf_serializers.IntegerField(),
            'recent_tickets': TicketSerializer(many=True),
            'my_assigned': TicketSerializer(many=True),
        })},
    )
    def get(self, request):
        from django.db.models import Q, Count
        from django.utils import timezone

        workspace_id = request.query_params.get('workspace')
        if not workspace_id:
            return Response({'detail': 'workspace parameter required'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify access
        ws_id = int(workspace_id)
        has_access = (
            Workspace.objects.filter(id=ws_id, owner=request.user).exists() or
            WorkspaceMember.objects.filter(workspace_id=ws_id, user=request.user).exists()
        )
        if not has_access and not request.user.is_superuser:
            return Response({'detail': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        tickets = Ticket.objects.filter(project__workspace_id=ws_id)
        today = timezone.now().date()

        stats = tickets.aggregate(
            total=Count('id'),
            open=Count('id', filter=Q(status='OPEN')),
            in_progress=Count('id', filter=Q(status='IN_PROGRESS')),
            in_testing=Count('id', filter=Q(status='IN_TESTING')),
            blocked=Count('id', filter=Q(status='BLOCKED')),
            resolved=Count('id', filter=Q(status='RESOLVED')),
            closed=Count('id', filter=Q(status='CLOSED')),
            resolved_today=Count('id', filter=Q(resolved_at__date=today)),
        )

        total_projects = Project.objects.filter(workspace_id=ws_id).count()
        total_members = WorkspaceMember.objects.filter(workspace_id=ws_id).count() + 1  # +1 for owner

        my_assigned = tickets.filter(assigned_to=request.user).exclude(
            status__in=['CLOSED', 'RESOLVED']
        ).select_related('project', 'assigned_to', 'created_by').order_by('-updated_at')[:5]

        recent = tickets.select_related('project', 'assigned_to', 'created_by').order_by('-updated_at')[:8]

        return Response({
            'total_tickets': stats['total'],
            'open': stats['open'],
            'in_progress': stats['in_progress'],
            'in_testing': stats['in_testing'],
            'blocked': stats['blocked'],
            'resolved': stats['resolved'],
            'closed': stats['closed'],
            'resolved_today': stats['resolved_today'],
            'total_projects': total_projects,
            'total_members': total_members,
            'my_tickets': tickets.filter(assigned_to=request.user).exclude(status__in=['CLOSED']).count(),
            'recent_tickets': TicketSerializer(recent, many=True).data,
            'my_assigned': TicketSerializer(my_assigned, many=True).data,
        })
