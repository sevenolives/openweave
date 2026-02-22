from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiExample
from drf_spectacular.types import OpenApiTypes
from .models import User, Project, Ticket, Comment, AuditLog, ProjectAgent
from .serializers import (
    UserSerializer, ProjectSerializer, TicketSerializer,
    CommentSerializer, AuditLogSerializer,
)
from .permissions import (
    IsAdminAgent, IsAdminOrReadOnly, IsAdminOrOwner,
)
from .filters import (
    TicketFilter, UserFilter, ProjectFilter, CommentFilter, AuditLogFilter
)


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
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['username', 'email', 'created_at', 'is_active']
    ordering = ['username']
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_permissions(self):
        if self.action == 'create':
            return []
        return [permissions.IsAuthenticated()]

    @extend_schema(summary="Get current user profile", responses={200: UserSerializer})
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @extend_schema(
        summary="Register new user",
        request=UserSerializer,
        responses={201: UserSerializer, 400: OpenApiTypes.OBJECT},
    )
    @action(detail=False, methods=['post'])
    def register(self, request):
        """User registration endpoint."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
