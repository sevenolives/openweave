"""
Filters for API endpoints to enable search and filtering capabilities.
"""
import django_filters
from django.db.models import Q
from .models import Ticket, User, Project, Comment, AuditLog, WorkspaceMember, WorkspaceInvite


class TicketFilter(django_filters.FilterSet):
    """
    FilterSet for Ticket model with search and filtering capabilities.
    """
    # Search across title and description
    search = django_filters.CharFilter(method='search_tickets', label='Search')
    
    # status and priority use Meta.fields for exact + __in lookups
    
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
    
    # Filter by project
    project = django_filters.ModelChoiceFilter(
        queryset=Project.objects.all(),
        field_name='project'
    )
    
    # Filter by workspace (via project)
    workspace = django_filters.NumberFilter(field_name='project__workspace_id')
    
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
            'id': ['exact'],
            'status': ['exact', 'in'],
            'priority': ['exact', 'in'],
            'ticket_type': ['exact', 'in'],
            'approved_status': ['exact', 'in'],
            'created_at': ['exact', 'gte', 'lte'],
            'updated_at': ['exact', 'gte', 'lte'],
        }

    def search_tickets(self, queryset, name, value):
        """
        Search across ticket title, description, and related fields.
        """
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
        """
        Filter by whether ticket is assigned or not.
        """
        if value is True:
            return queryset.filter(assigned_to__isnull=False)
        elif value is False:
            return queryset.filter(assigned_to__isnull=True)
        return queryset

    def filter_overdue(self, queryset, name, value):
        """
        Filter overdue tickets (placeholder for future SLA implementation).
        """
        # This would be enhanced with SLA fields in the future
        if value is True:
            # For now, consider tickets older than 7 days in IN_PROGRESS as overdue
            from datetime import datetime, timedelta
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
    
    # Filter by workspace membership
    workspace = django_filters.NumberFilter(method='filter_by_workspace', label='Workspace ID')
    
    # Filter by project membership
    project = django_filters.ModelChoiceFilter(
        queryset=Project.objects.all(),
        method='filter_by_project'
    )

    class Meta:
        model = User
        fields = ['user_type', 'is_active']

    def search_users(self, queryset, name, value):
        """
        Search across username, email, and name fields.
        """
        if not value:
            return queryset
            
        return queryset.filter(
            Q(username__icontains=value) |
            Q(email__icontains=value) |
            Q(name__icontains=value)
        ).distinct()

    def filter_by_workspace(self, queryset, name, value):
        """
        Filter users by workspace membership (members + owner).
        """
        if value:
            return queryset.filter(
                Q(workspace_memberships__workspace_id=value) |
                Q(owned_workspaces__id=value)
            ).distinct()
        return queryset

    def filter_by_project(self, queryset, name, value):
        """
        Filter users by project membership + workspace admins/owner.
        Workspace admins and owners are always assignable to any project.
        """
        if value:
            ws_id = value.workspace_id
            return queryset.filter(
                Q(projectagent__project=value) |
                Q(owned_workspaces__id=ws_id)
            ).distinct()
        return queryset


class ProjectFilter(django_filters.FilterSet):
    """
    FilterSet for Project model.
    """
    search = django_filters.CharFilter(method='search_projects', label='Search')
    
    # Filter by agent membership
    agent = django_filters.ModelChoiceFilter(
        queryset=User.objects.filter(is_active=True),
        method='filter_by_agent'
    )

    class Meta:
        model = Project
        fields = ['name']

    def search_projects(self, queryset, name, value):
        """
        Search across project name and description.
        """
        if not value:
            return queryset
            
        return queryset.filter(
            Q(name__icontains=value) |
            Q(description__icontains=value)
        ).distinct()

    def filter_by_agent(self, queryset, name, value):
        """
        Filter projects by agent membership.
        """
        if value:
            return queryset.filter(agents=value).distinct()
        return queryset


class CommentFilter(django_filters.FilterSet):
    """
    FilterSet for Comment model.
    """
    search = django_filters.CharFilter(method='search_comments', label='Search')
    
    ticket = django_filters.ModelChoiceFilter(
        queryset=Ticket.objects.all(),
        field_name='ticket'
    )
    
    ticket__project = django_filters.NumberFilter(
        field_name='ticket__project_id',
        label='Project ID (via ticket)'
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

    def search_comments(self, queryset, name, value):
        """
        Search within comment body.
        """
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
    workspace = django_filters.NumberFilter(field_name='workspace')

    class Meta:
        model = WorkspaceMember
        fields = ['workspace']


class WorkspaceInviteFilter(django_filters.FilterSet):
    """FilterSet for WorkspaceInvite model."""
    workspace = django_filters.NumberFilter(field_name='workspace')

    class Meta:
        model = WorkspaceInvite
        fields = ['workspace']