"""
Custom permission classes for Agent Desk RBAC.
"""
from rest_framework import permissions
from .models import Agent, ProjectAgent


class IsAdminAgent(permissions.BasePermission):
    """
    Permission that only allows admin agents to access.
    """
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and 
            hasattr(request.user, 'role') and 
            request.user.role == 'ADMIN'
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission that allows admins full access, members read-only.
    """
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
            
        if request.method in permissions.SAFE_METHODS:
            return True
            
        return (
            hasattr(request.user, 'role') and 
            request.user.role == 'ADMIN'
        )


class IsAdminOrOwner(permissions.BasePermission):
    """
    Permission that allows admins full access, members can only modify their own items.
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
            
        # Admins can access anything
        if hasattr(request.user, 'role') and request.user.role == 'ADMIN':
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
            
        # Admins can assign to anyone
        if hasattr(request.user, 'role') and request.user.role == 'ADMIN':
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
    Permission for managing project agents - admin only.
    """
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            hasattr(request.user, 'role') and 
            request.user.role == 'ADMIN'
        )