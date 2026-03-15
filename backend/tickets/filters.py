"""
Filters for API endpoints to enable search and filtering capabilities.
"""
import django_filters
from django.db.models import Q
from .models import Ticket, User, Project, Comment, AuditLog, WorkspaceMember, WorkspaceInvite, Workspace


def _workspace_q(value, prefix=''):
    """Build a Q that matches workspace by slug or numeric ID (backwards compat)."""
    slug_field = f'{prefix}workspace__slug' if prefix else 'workspace__slug'
    id_field = f'{prefix}workspace__id' if prefix else 'workspace__id'
    if value.isdigit():
        return Q(**{id_field: int(value)}) | Q(**{slug_field: value})
    return Q(**{slug_field: value})


class TicketFilter(django_filters.FilterSet):
    """
    FilterSet for Ticket model with search and filtering capabilities.
    """
    # Search across title and description
    search = django_filters.CharFilter(method='search_tickets', label='Search')
    
    # Filter by assigned agent
    assigned_to = django_filters.ModelChoiceFilter(
        queryset=User.objects.filter(is_active=True),
        field_name='assigned_to'
    )
    
    # Filter by created by agent
    created_by = django_filters.ModelChoiceFilter(
        queryset=User.objects.filter(is_active=True),
        field_name='created_by'
    )
    
    # Filter by project slug
    project = django_filters.CharFilter(method='filter_by_project_slug', label='Project slug')
    
    # Filter by workspace slug (via project)
    workspace = django_filters.CharFilter(method='filter_by_workspace_slug', label='Workspace slug')
    
    # Date range filters
    created_after = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='gte'
    )
    created_before = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='lte'
    )
    
    # Filter by whether ticket is assigned or unassigned
    is_assigned = django_filters.BooleanFilter(method='filter_assignment')
    
    # Filter by overdue tickets (for future enhancement)
    is_overdue = django_filters.BooleanFilter(method='filter_overdue')

    class Meta:
        model = Ticket
        fields = {
            'status': ['exact', 'in'],
            'priority': ['exact', 'in'],
            'ticket_type': ['exact', 'in'],
            'created_at': ['exact', 'gte', 'lte'],
            'updated_at': ['exact', 'gte', 'lte'],
        }

    def filter_by_project_slug(self, queryset, name, value):
        if value:
            return queryset.filter(project__slug__iexact=value)
        return queryset

    def filter_by_workspace_slug(self, queryset, name, value):
        if value:
            return queryset.filter(_workspace_q(value, prefix='project__'))
        return queryset

    def search_tickets(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(title__icontains=value) |
            Q(description__icontains=value) |
            Q(assigned_to__username__icontains=value) |
            Q(assigned_to__email__icontains=value) |
            Q(created_by__username__icontains=value) |
            Q(project__name__icontains=value)
        ).distinct()

    def filter_assignment(self, queryset, name, value):
        if value is True:
            return queryset.filter(assigned_to__isnull=False)
        elif value is False:
            return queryset.filter(assigned_to__isnull=True)
        return queryset

    def filter_overdue(self, queryset, name, value):
        if value is True:
            from datetime import timedelta
            from django.utils import timezone
            week_ago = timezone.now() - timedelta(days=7)
            return queryset.filter(
                status='IN_PROGRESS',
                updated_at__lt=week_ago
            )
        return queryset


class UserFilter(django_filters.FilterSet):
    """
    FilterSet for User model.
    """
    search = django_filters.CharFilter(method='search_users', label='Search')
    
    user_type = django_filters.ChoiceFilter(
        choices=User.USER_TYPES,
        field_name='user_type'
    )
    
    is_active = django_filters.BooleanFilter(field_name='is_active')
    
    # Filter by workspace slug
    workspace = django_filters.CharFilter(method='filter_by_workspace', label='Workspace slug')
    
    # Filter by project slug
    project = django_filters.CharFilter(method='filter_by_project', label='Project slug')

    class Meta:
        model = User
        fields = ['user_type', 'is_active']

    def search_users(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(username__icontains=value) |
            Q(email__icontains=value) |
            Q(name__icontains=value)
        ).distinct()

    def filter_by_workspace(self, queryset, name, value):
        if value:
            q = Q(slug=value) if not value.isdigit() else Q(id=int(value)) | Q(slug=value)
            ws = Workspace.objects.filter(q).first()
            if not ws:
                return queryset.none()
            return queryset.filter(
                Q(workspace_memberships__workspace=ws) |
                Q(owned_workspaces=ws)
            ).distinct()
        return queryset

    def filter_by_project(self, queryset, name, value):
        if value:
            try:
                project = Project.objects.get(slug__iexact=value)
                ws_id = project.workspace_id
                return queryset.filter(
                    Q(projectagent__project=project) |
                    Q(owned_workspaces__id=ws_id)
                ).distinct()
            except Project.DoesNotExist:
                return queryset.none()
        return queryset


class ProjectFilter(django_filters.FilterSet):
    """
    FilterSet for Project model.
    """
    search = django_filters.CharFilter(method='search_projects', label='Search')
    
    # Filter by workspace slug
    workspace = django_filters.CharFilter(method='filter_by_workspace', label='Workspace slug')
    
    # Filter by agent membership
    agent = django_filters.ModelChoiceFilter(
        queryset=User.objects.filter(is_active=True),
        method='filter_by_agent'
    )

    class Meta:
        model = Project
        fields = ['name']

    def search_projects(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value) |
            Q(description__icontains=value)
        ).distinct()

    def filter_by_workspace(self, queryset, name, value):
        if value:
            return queryset.filter(_workspace_q(value))
        return queryset

    def filter_by_agent(self, queryset, name, value):
        if value:
            return queryset.filter(agents=value).distinct()
        return queryset


class CommentFilter(django_filters.FilterSet):
    """
    FilterSet for Comment model.
    """
    search = django_filters.CharFilter(method='search_comments', label='Search')
    
    # Filter by ticket slug (e.g., OW-22)
    ticket = django_filters.CharFilter(method='filter_by_ticket', label='Ticket slug or ID')
    
    ticket__project = django_filters.CharFilter(
        method='filter_by_project_slug',
        label='Project slug (via ticket)'
    )
    
    author = django_filters.ModelChoiceFilter(
        queryset=User.objects.filter(is_active=True),
        field_name='author'
    )
    
    created_after = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='gte'
    )
    created_before = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='lte'
    )

    class Meta:
        model = Comment
        fields = ['ticket', 'ticket__project', 'author']

    def filter_by_ticket(self, queryset, name, value):
        if not value:
            return queryset
        # Try numeric ID first for backward compat, then ticket slug
        if value.isdigit():
            return queryset.filter(ticket_id=int(value))
        # Ticket slug like OW-22
        parts = value.rsplit('-', 1)
        if len(parts) == 2 and parts[1].isdigit():
            return queryset.filter(
                ticket__project__slug__iexact=parts[0],
                ticket__ticket_number=int(parts[1])
            )
        return queryset.none()

    def filter_by_project_slug(self, queryset, name, value):
        if value:
            return queryset.filter(ticket__project__slug__iexact=value)
        return queryset

    def search_comments(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(body__icontains=value)


class AuditLogFilter(django_filters.FilterSet):
    """
    FilterSet for AuditLog model.
    """
    entity_type = django_filters.ChoiceFilter(
        choices=[
            ('Ticket', 'Ticket'),
            ('Project', 'Project'),
            ('Comment', 'Comment'),
            ('Agent', 'Agent'),
        ],
        field_name='entity_type'
    )
    
    entity_id = django_filters.NumberFilter(field_name='entity_id')
    
    action = django_filters.CharFilter(field_name='action', lookup_expr='icontains')
    
    performed_by = django_filters.ModelChoiceFilter(
        queryset=User.objects.filter(is_active=True),
        field_name='performed_by'
    )
    
    timestamp_after = django_filters.DateTimeFilter(
        field_name='timestamp',
        lookup_expr='gte'
    )
    timestamp_before = django_filters.DateTimeFilter(
        field_name='timestamp',
        lookup_expr='lte'
    )

    class Meta:
        model = AuditLog
        fields = ['entity_type', 'entity_id', 'action', 'performed_by']


class WorkspaceMemberFilter(django_filters.FilterSet):
    """FilterSet for WorkspaceMember model."""
    workspace = django_filters.CharFilter(method='filter_by_workspace', label='Workspace slug')

    class Meta:
        model = WorkspaceMember
        fields = ['workspace']

    def filter_by_workspace(self, queryset, name, value):
        if value:
            return queryset.filter(_workspace_q(value))
        return queryset


class WorkspaceInviteFilter(django_filters.FilterSet):
    """FilterSet for WorkspaceInvite model."""
    workspace = django_filters.CharFilter(method='filter_by_workspace', label='Workspace slug')

    class Meta:
        model = WorkspaceInvite
        fields = ['workspace']

    def filter_by_workspace(self, queryset, name, value):
        if value:
            return queryset.filter(_workspace_q(value))
        return queryset
