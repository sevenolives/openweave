from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Project, Ticket, Comment, AuditLog, ProjectAgent, Workspace, WorkspaceMember, WorkspaceInvite, BlogPost


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'owner', 'member_count', 'created_at')
    search_fields = ('name', 'slug')
    list_filter = ('created_at',)
    list_select_related = ('owner',)
    list_per_page = 50
    readonly_fields = ('created_at', 'updated_at')

    def member_count(self, obj):
        return obj.members.count()
    member_count.short_description = 'Members'


@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'user', 'joined_at')
    list_filter = ('joined_at',)
    search_fields = ('workspace__name', 'user__username', 'user__email')
    list_select_related = ('workspace', 'user')
    list_per_page = 50


@admin.register(WorkspaceInvite)
class WorkspaceInviteAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'token', 'created_by', 'is_active', 'use_count', 'max_uses', 'expires_at', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('workspace__name', 'token')
    list_select_related = ('workspace', 'created_by')
    list_per_page = 50
    readonly_fields = ('token', 'created_at')


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """
    Admin for User model (custom user).
    Following best practices with search, filters, and select_related.
    """
    list_display = ('username', 'email', 'name', 'user_type', 'role', 'is_active', 'date_joined')
    list_filter = ('user_type', 'role', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'name')
    list_per_page = 50
    
    # Extend the default UserAdmin fieldsets
    fieldsets = UserAdmin.fieldsets + (
        ('User Info', {
            'fields': ('name', 'user_type', 'role', 'skills')
        }),
    )
    
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('User Info', {
            'fields': ('user_type', 'role', 'skills')
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
    list_select_related = ('project', 'agent')
    list_per_page = 50


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    """
    Admin for Ticket model.
    """
    list_display = (
        'id', 'title', 'project', 'status', 'priority', 
        'assigned_to', 'created_by', 'created_at'
    )
    list_filter = ('status', 'priority', 'created_at', 'project')
    search_fields = ('title', 'description', 'project__name')
    list_select_related = ('project', 'assigned_to', 'created_by')
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
        return super().get_queryset(request).select_related(
            'project', 'assigned_to', 'created_by'
        )


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    """Admin for Comment model."""
    list_display = ('id', 'ticket', 'author', 'created_at', 'body_preview')
    list_filter = ('created_at',)
    search_fields = ('body', 'ticket__title', 'author__username')
    list_select_related = ('ticket', 'author')
    list_per_page = 50
    readonly_fields = ('created_at', 'updated_at')
    
    def body_preview(self, obj):
        return obj.body[:100] + '...' if len(obj.body) > 100 else obj.body
    body_preview.short_description = 'Body Preview'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('ticket', 'author')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin for AuditLog model."""
    list_display = ('id', 'entity_type', 'entity_id', 'action', 'performed_by', 'timestamp')
    list_filter = ('entity_type', 'action', 'timestamp')
    search_fields = ('entity_type', 'action', 'performed_by__username')
    list_select_related = ('performed_by',)
    list_per_page = 50
    readonly_fields = ('entity_type', 'entity_id', 'action', 'performed_by', 'old_value', 'new_value', 'timestamp')
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('performed_by')


from .models import StatusDefinition, StatusTransition

@admin.register(StatusDefinition)
class StatusDefinitionAdmin(admin.ModelAdmin):
    list_display = ['key', 'label', 'workspace', 'color', 'is_terminal', 'is_default', 'position']
    list_filter = ['workspace', 'is_terminal', 'is_default']
    ordering = ['workspace', 'position']

@admin.register(StatusTransition)
class StatusTransitionAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'from_status', 'to_status', 'actor_type']
    list_filter = ['workspace', 'actor_type']


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'slug', 'author', 'is_published', 'published_at', 'created_at']
    list_filter = ['is_published', 'created_at']
    search_fields = ['title', 'content', 'tags']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']
