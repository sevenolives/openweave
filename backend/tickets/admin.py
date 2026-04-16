from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib import messages
from django.db import transaction
from django.template.response import TemplateResponse
from .models import (
    User, Project, Ticket, Comment, AuditLog, Workspace,
    WorkspaceMember, WorkspaceMemberProject, BlogPost,
    TicketAttachment, MediaFile, Subscription, StatusDefinition,
    ProjectStatusPermission, CommunityRating, StateTemplate,
    TransitionException,
)


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


def approve_members(modeladmin, request, queryset):
    updated = queryset.filter(is_approved=False).update(is_approved=True)
    modeladmin.message_user(request, f"Approved {updated} member(s).", messages.SUCCESS)
approve_members.short_description = "Approve selected members"

def reject_members(modeladmin, request, queryset):
    pending = queryset.filter(is_approved=False)
    count = pending.count()
    for member in pending:
        user = member.user
        member.delete()
        if user.user_type == 'BOT' and not WorkspaceMember.objects.filter(user=user).exists():
            user.delete()
    modeladmin.message_user(request, f"Rejected and removed {count} pending member(s).", messages.SUCCESS)
reject_members.short_description = "Reject and remove selected pending members"

@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'user', 'is_approved', 'joined_at')
    list_filter = ('is_approved', 'joined_at')
    search_fields = ('workspace__name', 'user__username', 'user__email')
    list_select_related = ('workspace', 'user')
    list_per_page = 50
    actions = [approve_members, reject_members]


def merge_users(modeladmin, request, queryset):
    """
    Admin action: merge duplicate users into one.
    The admin chooses which user to keep via radio button on the confirmation page.
    Reassigns all related objects from duplicates to the primary, then deletes duplicates.
    """
    if queryset.count() < 2:
        modeladmin.message_user(request, "Select at least 2 users to merge.", messages.WARNING)
        return

    users = list(queryset.order_by('date_joined'))

    if request.POST.get('confirm_merge'):
        primary_id = request.POST.get('primary_user_id')
        if not primary_id:
            modeladmin.message_user(request, "No primary user selected.", messages.ERROR)
            return
        primary = User.objects.get(pk=primary_id)
        duplicates = [u for u in users if u.pk != primary.pk]
        with transaction.atomic():
            for dup in duplicates:
                Ticket.objects.filter(assigned_to=dup).update(assigned_to=primary)
                Ticket.objects.filter(created_by=dup).update(created_by=primary)
                Comment.objects.filter(author=dup).update(author=primary)
                AuditLog.objects.filter(performed_by=dup).update(performed_by=primary)
                TicketAttachment.objects.filter(uploaded_by=dup).update(uploaded_by=primary)
                MediaFile.objects.filter(uploaded_by=dup).update(uploaded_by=primary)
                BlogPost.objects.filter(author=dup).update(author=primary)
                TransitionException.objects.filter(user=dup).update(user=primary)
                TransitionException.objects.filter(created_by=dup).update(created_by=primary)
                StateTemplate.objects.filter(created_by=dup).update(created_by=primary)
                CommunityRating.objects.filter(user=dup).update(user=primary)

                for ws in Workspace.objects.filter(owner=dup):
                    ws.owner = primary
                    ws.save(update_fields=['owner'])

                for wm in WorkspaceMember.objects.filter(user=dup):
                    existing = WorkspaceMember.objects.filter(workspace=wm.workspace, user=primary).first()
                    if existing:
                        for wmp in WorkspaceMemberProject.objects.filter(member=wm):
                            if not WorkspaceMemberProject.objects.filter(member=existing, project=wmp.project).exists():
                                wmp.member = existing
                                wmp.save(update_fields=['member'])
                            else:
                                wmp.delete()
                        wm.delete()
                    else:
                        wm.user = primary
                        wm.save(update_fields=['user'])

                for sd in StatusDefinition.objects.filter(allowed_users=dup):
                    sd.allowed_users.add(primary)
                    sd.allowed_users.remove(dup)

                for psp in ProjectStatusPermission.objects.filter(allowed_users=dup):
                    psp.allowed_users.add(primary)
                    psp.allowed_users.remove(dup)

                dup.delete()

        dup_names = ', '.join(f'{d.username} (#{d.id})' for d in duplicates)
        modeladmin.message_user(
            request,
            f"Merged {dup_names} into {primary.username} (#{primary.id}).",
            messages.SUCCESS,
        )
        return

    context = {
        **modeladmin.admin_site.each_context(request),
        'title': 'Confirm user merge',
        'all_users': users,
        'queryset': queryset,
        'opts': modeladmin.model._meta,
        'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
    }
    return TemplateResponse(request, 'admin/merge_users_confirmation.html', context)

merge_users.short_description = "Merge selected users"


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
    actions = [merge_users]

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
    list_display = ('name', 'about_text', 'created_at', 'updated_at', 'agent_count')
    search_fields = ('name', 'about_text')
    list_filter = ('created_at',)
    list_per_page = 50
    readonly_fields = ('created_at', 'updated_at')
    
    def agent_count(self, obj):
        return obj.workspace_member_projects.count()
    agent_count.short_description = 'Agents'



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


from .models import StatusTransition

@admin.register(StatusDefinition)
class StatusDefinitionAdmin(admin.ModelAdmin):
    list_display = ['key', 'label', 'workspace', 'color', 'is_default', 'position']
    list_filter = ['workspace', 'is_default']
    ordering = ['workspace', 'position']

@admin.register(StatusTransition)
class StatusTransitionAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'from_status', 'to_status', 'actor_type']
    list_filter = ['workspace', 'actor_type']


@admin.register(TransitionException)
class TransitionExceptionAdmin(admin.ModelAdmin):
    list_display = ['workspace', 'from_status', 'to_status', 'exception_type', 'user', 'created_by', 'created_at']
    list_filter = ['workspace', 'exception_type']
    list_select_related = ('workspace', 'from_status', 'to_status', 'user', 'created_by')


@admin.register(TicketAttachment)
class TicketAttachmentAdmin(admin.ModelAdmin):
    list_display = ['id', 'ticket', 'filename', 'uploaded_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['filename', 'ticket__title', 'uploaded_by__username']
    list_select_related = ('ticket', 'uploaded_by')
    list_per_page = 50
    readonly_fields = ['created_at']


@admin.register(MediaFile)
class MediaFileAdmin(admin.ModelAdmin):
    list_display = ['id', 'filename', 'media_type', 'workspace', 'ticket', 'uploaded_by', 'size', 'created_at']
    list_filter = ['media_type', 'created_at', 'workspace']
    search_fields = ['filename', 'uploaded_by__username', 'workspace__name']
    list_select_related = ('workspace', 'ticket', 'uploaded_by')
    list_per_page = 50
    readonly_fields = ['id', 'content_type', 'size', 'created_at']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'plan', 'status', 'stripe_customer_id', 'current_period_end', 'created_at')
    list_filter = ('plan', 'status')
    search_fields = ('workspace__name', 'stripe_customer_id', 'stripe_subscription_id')
    list_select_related = ('workspace',)
    list_per_page = 50
    readonly_fields = ('created_at', 'updated_at')


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'slug', 'author', 'is_published', 'published_at', 'created_at']
    list_filter = ['is_published', 'created_at']
    search_fields = ['title', 'content', 'tags']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WorkspaceMemberProject)
class WorkspaceMemberProjectAdmin(admin.ModelAdmin):
    list_display = ['member', 'project', 'role', 'joined_at']
    list_filter = ['role']
    search_fields = ['member__user__username', 'project__name']
    raw_id_fields = ['member', 'project']


# Deprecated: CommunityTemplate, CommunityRating, StateTemplate, StateTemplateItem
# Tables exist in DB but are not used. Community features use live workspace data.
