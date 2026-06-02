from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib import messages
from django.db import transaction
from django.template.response import TemplateResponse
from django.utils.translation import gettext as _
from django.contrib.admin.models import LogEntry, ADDITION, CHANGE, DELETION
from django.contrib.contenttypes.models import ContentType
from .models import (
    User, Project, Ticket, Comment, Workspace,
    WorkspaceMember, WorkspaceMemberProject, BlogPost,
    TicketAttachment, MediaFile, Subscription, StatusDefinition,
    ProjectStatusPermission, CommunityRating, StateTemplate, StateTemplateItem,
    TransitionException, Phase, Tag, OTP, CommunityTemplate,
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
                LogEntry.objects.filter(user=dup).update(user=primary)
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



class TicketAttachmentInline(admin.TabularInline):
    model = TicketAttachment
    fields = ('filename', 'file', 'uploaded_by', 'created_at')
    readonly_fields = ('created_at',)
    extra = 0
    fk_name = 'comment'


class TicketAttachmentTicketInline(admin.TabularInline):
    model = TicketAttachment
    fields = ('comment', 'filename', 'file', 'uploaded_by', 'created_at')
    readonly_fields = ('created_at',)
    extra = 0
    fk_name = 'ticket'


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
    inlines = [TicketAttachmentTicketInline]

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

    def history_view(self, request, object_id, extra_context=None):
        ticket_ct = ContentType.objects.get_for_model(Ticket)
        audit_entries = LogEntry.objects.filter(
            content_type=ticket_ct, object_id=str(object_id)
        ).select_related('user').order_by('-action_time')
        context = {
            **self.admin_site.each_context(request),
            'title': _('Change history: Ticket #%s') % object_id,
            'audit_entries': audit_entries,
            'object_id': object_id,
            'opts': self.model._meta,
            'preserved_filters': self.get_preserved_filters(request),
            **(extra_context or {}),
        }
        return TemplateResponse(
            request,
            'admin/tickets/ticket/history.html',
            context,
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
    inlines = [TicketAttachmentInline]

    def body_preview(self, obj):
        return obj.body[:100] + '...' if len(obj.body) > 100 else obj.body
    body_preview.short_description = 'Body Preview'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('ticket', 'author')

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if isinstance(instance, TicketAttachment) and not instance.ticket_id:
                instance.ticket = formset.instance.ticket
            instance.save()
        formset.save_m2m()
        for obj in formset.deleted_objects:
            obj.delete()


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    """Read-only admin view for Django's built-in audit trail."""
    list_display = ('action_time', 'user', 'content_type', 'object_repr', 'action_flag_display')
    list_filter = ('action_flag', 'content_type', 'action_time')
    search_fields = ('object_repr', 'user__username')
    list_select_related = ('user', 'content_type')
    list_per_page = 50
    readonly_fields = ('action_time', 'user', 'content_type', 'object_id', 'object_repr', 'action_flag', 'change_message')

    def action_flag_display(self, obj):
        return {ADDITION: 'CREATE', CHANGE: 'UPDATE', DELETION: 'DELETE'}.get(obj.action_flag, str(obj.action_flag))
    action_flag_display.short_description = 'Action'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


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
    list_display = ['id', 'ticket', 'comment', 'filename', 'uploaded_by', 'created_at']
    list_filter = ['created_at']
    search_fields = ['filename', 'ticket__title', 'uploaded_by__username']
    list_select_related = ('ticket', 'comment', 'uploaded_by')
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


@admin.register(Phase)
class PhaseAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'status', 'position', 'started_at', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['name', 'project__name']
    list_select_related = ('project',)
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']
    readonly_fields = ['created_at']


@admin.register(ProjectStatusPermission)
class ProjectStatusPermissionAdmin(admin.ModelAdmin):
    list_display = ['project', 'status_definition']
    list_select_related = ('project', 'status_definition')
    search_fields = ['project__name', 'status_definition__label']


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ['email', 'purpose', 'used', 'created_at', 'expires_at']
    list_filter = ['purpose', 'used']
    search_fields = ['email']
    readonly_fields = ['created_at']

    def has_add_permission(self, request):
        return False


@admin.register(CommunityTemplate)
class CommunityTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'workspace', 'is_published', 'avg_rating', 'sync_count', 'created_at']
    list_filter = ['is_published']
    search_fields = ['name', 'slug', 'workspace__name']
    list_select_related = ('workspace',)
    readonly_fields = ['rating_sum', 'rating_count', 'sync_count', 'created_at', 'updated_at']


@admin.register(CommunityRating)
class CommunityRatingAdmin(admin.ModelAdmin):
    list_display = ['user', 'template', 'score', 'created_at']
    list_filter = ['score']
    list_select_related = ('user', 'template')
    search_fields = ['user__username', 'template__name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(StateTemplate)
class StateTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'workspace', 'is_published', 'sync_count', 'created_at']
    list_filter = ['is_published']
    search_fields = ['name', 'workspace__name']
    list_select_related = ('workspace', 'created_by')
    readonly_fields = ['sync_count', 'created_at', 'updated_at']


@admin.register(StateTemplateItem)
class StateTemplateItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'key', 'template', 'order', 'is_default', 'color']
    list_filter = ['is_default']
    search_fields = ['name', 'key', 'template__name']
    list_select_related = ('template',)
