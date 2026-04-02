"""
Custom permission classes for Agent Desk RBAC.

Workspace owner = root user. Has all admin privileges everywhere.
"""
from rest_framework import permissions
from .models import User, ProjectAgent, Workspace, WorkspaceMember, WorkspaceMemberProject


def is_admin_or_owner(user, workspace=None):
    """Check if user is a superuser or a workspace owner.
    
    When workspace is provided, checks ownership of that specific workspace.
    When workspace is None, falls back to checking ownership of any workspace (legacy).
    """
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    if workspace is not None:
        return Workspace.objects.filter(id=workspace.id, owner=user).exists()
    # No workspace context = no admin privileges
    return False


class IsAdminAgent(permissions.BasePermission):
    """
    Permission that only allows admin agents or workspace owners to access.
    """
    def has_permission(self, request, view):
        return is_admin_or_owner(request.user)


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission that allows authenticated users read access.
    Write access is allowed through — view-level checks (check_object_permissions,
    perform_create) enforce workspace-specific ownership.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
            
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Allow write requests through; view-level checks enforce workspace ownership
        return True


class IsAdminOrOwner(permissions.BasePermission):
    """
    Permission that allows admins full access, members can only modify their own items.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
            
        # Admins and workspace owners can access anything
        if is_admin_or_owner(request.user):
            return True
            
        # For tickets, check if user is the creator or assignee
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user or obj.assigned_to == request.user
            
        # For other objects, check if user owns it
        if hasattr(obj, 'author'):
            return obj.author == request.user
            
        return False


class CanAssignTicket(permissions.BasePermission):
    """
    Permission for ticket assignment - agents can self-assign, admins can reassign to anyone.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
            
        # Get the target agent from request data
        target_agent_id = request.data.get('agent_id')
        if not target_agent_id:
            return False
            
        try:
            target_agent_id = int(target_agent_id)
        except (ValueError, TypeError):
            return False
            
        # Admins and workspace owners can assign to anyone
        if is_admin_or_owner(request.user):
            return True
            
        # Members can only self-assign
        return target_agent_id == request.user.id


class IsProjectMember(permissions.BasePermission):
    """
    Permission that checks if the user is a member of the project.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
            
        # For list views, check if user belongs to any project
        if view.action in ['list', 'create']:
            return True
            
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
            
        # Get project from object
        project = None
        if hasattr(obj, 'project'):
            project = obj.project
        elif hasattr(obj, 'id') and obj.__class__.__name__ == 'Project':
            project = obj
            
        if not project:
            return False
            
        # Check if user is a member of this project
        return ProjectAgent.objects.filter(
            project=project,
            agent=request.user
        ).exists()


class CanManageProjectAgents(permissions.BasePermission):
    """
    Permission for managing project agents - admin or workspace owner.
    """
    def has_permission(self, request, view):
        return is_admin_or_owner(request.user)

def is_workspace_owner(user, workspace):
    """Check if user owns this workspace (not superuser, just owner)."""
    if not user.is_authenticated or not workspace:
        return False
    return workspace.owner_id == user.id


def user_has_project_access(user, project):
    """
    Check if a user has access to a project.
    Workspace owners have implicit access. Project members have explicit access.
    """
    if not user.is_authenticated or not project:
        return False
    if is_admin_or_owner(user, project.workspace):
        return True
    return WorkspaceMemberProject.objects.filter(
        member__user=user, project=project
    ).exists()


def project_access_q(user, prefix=''):
    """
    Return Q object for filtering by project access.
    Use this in querysets to filter to only projects the user can access.
    
    Args:
        user: The user to check access for
        prefix: Field prefix for the relationship (e.g. 'project' for direct project access, or 'ticket__project' for nested queries)
    """
    from django.db.models import Q
    if not user.is_authenticated:
        return Q(pk=-1)  # No access
    if user.is_superuser:
        return Q()  # Access all
    
    # Build field names with prefix
    if prefix:
        member_field = f'{prefix}__workspace_member_projects__member__user'
        workspace_field = f'{prefix}__workspace_id'
    else:
        member_field = 'workspace_member_projects__member__user'
        workspace_field = 'workspace_id'
    
    owned_ws = Workspace.objects.filter(owner=user).values_list('id', flat=True)
    return Q(**{member_field: user}) | Q(**{workspace_field + '__in': owned_ws})
