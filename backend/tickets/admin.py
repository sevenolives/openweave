from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Agent, Project, Ticket, Comment, AuditLog, ProjectAgent


@admin.register(Agent)
class AgentAdmin(UserAdmin):
    """
    Admin for Agent model (custom user).
    Following best practices with search, filters, and select_related.
    """
    list_display = ('username', 'email', 'first_name', 'last_name', 'agent_type', 'role', 'is_active', 'date_joined')
    list_filter = ('agent_type', 'role', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    list_per_page = 50
    
    # Extend the default UserAdmin fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ('Agent Info', {
            'fields': ('agent_type', 'role', 'skills')
        }),
    )
    
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Agent Info', {
            'fields': ('agent_type', 'role', 'skills')
        }),
    )


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    """Admin for Project model."""
    list_display = ('name', 'description', 'created_at', 'updated_at', 'agent_count')
    search_fields = ('name', 'description')
    list_filter = ('created_at',)
    list_per_page = 50
    readonly_fields = ('created_at', 'updated_at')
    
    def agent_count(self, obj):
        return obj.agents.count()
    agent_count.short_description = 'Agents'


@admin.register(ProjectAgent)
class ProjectAgentAdmin(admin.ModelAdmin):
    """Admin for ProjectAgent join table."""
    list_display = ('project', 'agent', 'joined_at')
    list_filter = ('joined_at',)
    search_fields = ('project__name', 'agent__username', 'agent__email')
    list_select_related = ('project', 'agent')  # Prevent N+1 queries
    list_per_page = 50


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    """
    Admin for Ticket model.
    Following best practices with select_related for ForeignKey fields.
    """
    list_display = (
        'id', 'title', 'project', 'status', 'priority', 
        'assigned_to', 'created_by', 'created_at'
    )
    list_filter = ('status', 'priority', 'created_at', 'project')
    search_fields = ('title', 'description', 'project__name')
    list_select_related = ('project', 'assigned_to', 'created_by')  # Prevent N+1 queries
    list_per_page = 50
    readonly_fields = ('created_at', 'updated_at', 'resolved_at', 'closed_at')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('project', 'title', 'description')
        }),
        ('Status & Assignment', {
            'fields': ('status', 'priority', 'assigned_to')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at', 'resolved_at', 'closed_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related(
            'project', 'assigned_to', 'created_by'
        )


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    """Admin for Comment model."""
    list_display = ('id', 'ticket', 'author', 'created_at', 'body_preview')
    list_filter = ('created_at',)
    search_fields = ('body', 'ticket__title', 'author__username')
    list_select_related = ('ticket', 'author')  # Prevent N+1 queries
    list_per_page = 50
    readonly_fields = ('created_at', 'updated_at')
    
    def body_preview(self, obj):
        return obj.body[:100] + '...' if len(obj.body) > 100 else obj.body
    body_preview.short_description = 'Body Preview'
    
    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related('ticket', 'author')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin for AuditLog model."""
    list_display = ('id', 'entity_type', 'entity_id', 'action', 'performed_by', 'timestamp')
    list_filter = ('entity_type', 'action', 'timestamp')
    search_fields = ('entity_type', 'action', 'performed_by__username')
    list_select_related = ('performed_by',)  # Prevent N+1 queries
    list_per_page = 50
    readonly_fields = ('entity_type', 'entity_id', 'action', 'performed_by', 'old_value', 'new_value', 'timestamp')
    
    def has_add_permission(self, request):
        """Audit logs should not be manually created."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Audit logs should not be modified."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Audit logs should not be deleted."""
        return False
    
    def get_queryset(self, request):
        """Optimize queryset with select_related."""
        return super().get_queryset(request).select_related('performed_by')