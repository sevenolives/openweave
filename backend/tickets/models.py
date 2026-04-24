from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
import json
import uuid


class User(AbstractUser):
    """
    Custom user model extending AbstractUser (not AbstractBaseUser per best practices).
    Represents both human agents and bot agents.
    """
    USER_TYPES = [
        ('HUMAN', 'Human'),
        ('BOT', 'Bot'),
    ]
    
    ROLES = [
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
    ]
    
    NOTIFICATION_PREFERENCES = [
        ('ALL', 'All Notifications'),
        ('CRITICAL', 'Critical Only (High/Critical Priority + Blocked Tickets)'),
        ('NONE', 'No Notifications'),
    ]
    
    name = models.CharField(max_length=255)
    user_type = models.CharField(max_length=10, choices=USER_TYPES, default='HUMAN')
    role = models.CharField(max_length=10, choices=ROLES, default='MEMBER')
    skills = models.JSONField(default=list, blank=True, help_text="List of skill tags")
    description = models.TextField(blank=True, default='', help_text="What this user/bot can do")
    notification_preference = models.CharField(
        max_length=10, 
        choices=NOTIFICATION_PREFERENCES, 
        default='ALL',
        help_text="Email notification preference level"
    )
    is_active = models.BooleanField(default=True)
    email_verified = models.BooleanField(default=False, help_text="Whether the user's email has been verified")
    created_in_workspace = models.ForeignKey('Workspace', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_bots', help_text='Workspace where this bot was created (bots only)')
    
    # Keep the username field as per best practices
    # Email is already included in AbstractUser
    
    def save(self, *args, **kwargs):
        if self.username:
            self.username = self.username.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.get_user_type_display()})"

    class Meta:
        db_table = 'users'


class Workspace(models.Model):
    """
    A workspace groups projects, members, and invite links for multi-tenant isolation.
    """
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    owner = models.ForeignKey("User", on_delete=models.CASCADE, related_name='owned_workspaces')
    restrict_status_to_assigned = models.BooleanField(default=False,
        help_text='If enabled, only the assigned user (or admin/owner) can change ticket status.')
    is_public = models.BooleanField(default=False, help_text="Whether this workspace can be viewed publicly")
    description = models.TextField(blank=True, default='', help_text="Public description of what this workspace does")
    website = models.URLField(max_length=500, blank=True, default='', help_text="Public website URL — shown on community profile as a backlink")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'workspaces'
        ordering = ['name']


class WorkspaceMember(models.Model):
    """
    Membership join table between Workspace and User.
    Everyone is a member. Owner is derived from Workspace.owner FK.
    Roles are decided at the project level (WorkspaceMemberProject.role).
    Bot members require owner approval (is_approved=False until approved).
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name='workspace_memberships')
    is_approved = models.BooleanField(default=True, help_text='Whether this member has been approved by the workspace owner. Bots start as unapproved.')
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} in {self.workspace.name}"

    class Meta:
        db_table = 'workspace_members'
        ordering = ['-joined_at']
        unique_together = ('workspace', 'user')
        ordering = ['joined_at']




class StatusDefinition(models.Model):
    """
    A status that tickets can have, defined per workspace.
    Editable state machine — workspace-level, inheritable by projects.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='status_definitions')
    key = models.CharField(max_length=30, help_text="Immutable key, e.g. IN_PROGRESS")
    label = models.CharField(max_length=50, help_text="Display label, e.g. 'In Progress'")
    color = models.CharField(max_length=30, default='gray', help_text="Color token, e.g. 'blue', 'red', '#ff0000'")
    is_terminal = models.BooleanField(default=False, help_text="Deprecated — terminal state concept removed")
    is_default = models.BooleanField(default=False, help_text="Default status for new tickets")
    description = models.CharField(max_length=200, blank=True, default='', help_text="Optional description of what this status means")
    is_archived = models.BooleanField(default=False, help_text="Archived statuses cannot be used for new transitions")
    position = models.PositiveIntegerField(default=0, help_text="Display order")
    allowed_users = models.ManyToManyField('User', blank=True, related_name='enterable_statuses',
        help_text='Deprecated — use ProjectStatusPermission instead. Kept for backwards compat.')
    allowed_from = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='can_lead_to',
        help_text='If empty, can transition from any state. If set, only these source states are allowed.')
    class Meta:
        db_table = 'status_definitions'
        unique_together = ('workspace', 'key')
        ordering = ['position']

    def __str__(self):
        return f"{self.label} ({self.key}) — {self.workspace.name}"


class ProjectStatusPermission(models.Model):
    """
    Project-level override for who can enter a status.
    If no entry exists for a project+status, anyone on the project can enter.
    If an entry exists, only the listed users can enter that status on that project.
    """
    project = models.ForeignKey('Project', on_delete=models.CASCADE, related_name='status_permissions')
    status_definition = models.ForeignKey(StatusDefinition, on_delete=models.CASCADE, related_name='project_permissions')
    allowed_users = models.ManyToManyField('User', blank=True, related_name='project_enterable_statuses',
        help_text='Users allowed to move tickets into this status on this project. Empty = remove override (anyone can enter).')

    class Meta:
        db_table = 'project_status_permissions'
        unique_together = ('project', 'status_definition')

    def __str__(self):
        return f"{self.project.slug} — {self.status_definition.label}"


class StatusTransition(models.Model):
    """
    Allowed transition between two statuses for a given actor type.
    """
    ACTOR_TYPES = [
        ('BOT', 'Bot'),
        ('HUMAN', 'Human'),
        ('ALL', 'All'),
    ]
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='status_transitions')
    from_status = models.ForeignKey(StatusDefinition, on_delete=models.CASCADE, related_name='transitions_from')
    to_status = models.ForeignKey(StatusDefinition, on_delete=models.CASCADE, related_name='transitions_to')
    actor_type = models.CharField(max_length=10, choices=ACTOR_TYPES, default='ALL')

    class Meta:
        db_table = 'status_transitions'
        unique_together = ('workspace', 'from_status', 'to_status', 'actor_type')
        ordering = ['from_status__position', 'to_status__position']

    def __str__(self):
        return f"{self.from_status.key} → {self.to_status.key} ({self.actor_type})"


class TransitionException(models.Model):
    """
    Exception to allow specific users/types to bypass blocked transitions.
    If user is NULL, applies to all humans/bots of that exception_type.
    """
    workspace = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='transition_exceptions')
    from_status = models.ForeignKey('StatusDefinition', on_delete=models.CASCADE, related_name='exception_from')
    to_status = models.ForeignKey('StatusDefinition', on_delete=models.CASCADE, related_name='exception_to')
    exception_type = models.CharField(max_length=10, choices=[('human', 'Human'), ('bot', 'Bot')])
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, blank=True, null=True, related_name='transition_exceptions')
    reason = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_exceptions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'transition_exceptions'
        unique_together = ['workspace', 'from_status', 'to_status', 'exception_type', 'user']
        ordering = ['-created_at']

    def __str__(self):
        user_str = self.user.username if self.user else 'ALL'
        return f"Exception: {self.from_status.key} → {self.to_status.key} ({self.exception_type}, {user_str})"


class Project(models.Model):
    """
    Groups related tickets and agents.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='projects', null=True, blank=True)
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=10, blank=True, help_text="Short prefix for ticket slugs, e.g. SA")
    invite_uuid = models.UUIDField(unique=True, default=uuid.uuid4, help_text="Public UUID used as the invite link for this project")
    about_text = models.TextField(blank=True, help_text="What this project is about")
    process_text = models.TextField(blank=True, default='', help_text="Process guidelines for bots — conventions, rules, workflow")
    current_phase = models.ForeignKey('Phase', on_delete=models.SET_NULL, null=True, blank=True, related_name='active_in_project', help_text="The currently active phase")
    is_public = models.BooleanField(default=False, help_text="Whether this project is visible on the public community profile")
    url = models.URLField(blank=True, null=True, help_text="Project website URL")
    logo = models.URLField(blank=True, null=True, help_text="Project logo URL")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            # Auto-generate slug from name: take uppercase initials or first 4 chars
            words = self.name.split()
            if len(words) >= 2:
                self.slug = ''.join(w[0] for w in words[:4]).upper()
            else:
                self.slug = self.name[:4].upper().replace(' ', '')
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name
    
    class Meta:
        db_table = 'projects'
        ordering = ['name']


class Phase(models.Model):
    """
    A phase within a project. Helps bots and humans understand what stage
    the project is in and what the goals are.
    """
    PHASE_STATUSES = [
        ('INACTIVE', 'Inactive'),
        ('ACTIVE', 'Active'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='phases')
    name = models.CharField(max_length=100, help_text="Phase name, e.g. 'MVP', 'Beta Launch'")
    description = models.TextField(blank=True, help_text="Goals and scope of this phase")
    status = models.CharField(max_length=20, choices=PHASE_STATUSES, default='INACTIVE', help_text="Phase status")
    position = models.PositiveIntegerField(default=0, help_text="Display order")
    started_at = models.DateTimeField(null=True, blank=True, help_text="When this phase started")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'phases'
        ordering = ['position']
        unique_together = ('project', 'name')

    def __str__(self):
        icons = {'INACTIVE': '⬜', 'ACTIVE': '🟢'}
        return f"{icons.get(self.status, '⬜')} {self.name} — {self.project.name}"


class WorkspaceMemberProject(models.Model):
    """
    Project membership as detail of workspace membership.
    """
    PROJECT_ROLES = [
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
    ]
    member = models.ForeignKey(WorkspaceMember, on_delete=models.CASCADE, related_name='project_memberships')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='workspace_member_projects')
    role = models.CharField(max_length=10, choices=PROJECT_ROLES, default='MEMBER')
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'workspace_member_projects'
        unique_together = ('member', 'project')
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.member.user.username} → {self.project.name} ({self.role})"


class Tag(models.Model):
    """Global tag for categorising tickets."""
    name = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(blank=True, default=dict, help_text='Extensible metadata (category, severity, etc)')

    class Meta:
        db_table = 'tags'
        ordering = ['name']

    def __str__(self):
        return self.name


class Ticket(models.Model):
    """
    A unit of work assigned to exactly one agent at a time.
    Status flow: OPEN → IN_PROGRESS → IN_TESTING → REVIEW → COMPLETED
    Can move to BLOCKED from IN_PROGRESS and back.
    """
    # Status is stored as the key string from StatusDefinition.
    # Validation against allowed statuses and transitions happens in the serializer.
    
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]

    TICKET_TYPE_CHOICES = [
        ('BUG', 'Bug'),
        ('FEATURE', 'Feature'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tickets')
    ticket_number = models.PositiveIntegerField(null=True, blank=True, help_text="Project-scoped ticket number")
    title = models.CharField(max_length=500)
    description = models.TextField()
    status = models.CharField(max_length=30, default='OPEN')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    ticket_type = models.CharField(max_length=20, choices=TICKET_TYPE_CHOICES, default='BUG')
    approved_status = models.CharField(max_length=20, default='UNAPPROVED', help_text="Deprecated — approval gates removed")
    
    # Phase association
    phase = models.ForeignKey('Phase', on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    
    # Assignment - one agent or null
    assigned_to = models.ForeignKey(
        "User", 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='assigned_tickets'
    )
    
    tags = models.JSONField(blank=True, default=list, help_text="List of tag strings (e.g., ['oauth', 'security'])")
    tag_refs = models.ManyToManyField('Tag', blank=True, related_name='tickets', help_text='Denormalized M2M for querying/stats')

    created_by = models.ForeignKey("User", on_delete=models.CASCADE, related_name='created_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_status = self.status

    @property
    def ticket_slug(self):
        """Return project-scoped slug like SA-1."""
        if self.project and self.ticket_number:
            return f"{self.project.slug}-{self.ticket_number}"
        return f"#{self.pk}" if self.pk else None

    def save(self, *args, **kwargs):
        if not self.ticket_number and self.project_id:
            from django.db.models import Max
            max_num = Ticket.objects.filter(project_id=self.project_id).aggregate(m=Max('ticket_number'))['m'] or 0
            self.ticket_number = max_num + 1
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"#{self.pk} - {self.title}"
    
    class Meta:
        db_table = 'tickets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status'], name='idx_ticket_status'),
            models.Index(fields=['project', 'status'], name='idx_ticket_project_status'),
            models.Index(fields=['assigned_to'], name='idx_ticket_assigned_to'),
            models.Index(fields=['created_at'], name='idx_ticket_created_at'),
            models.Index(fields=['resolved_at'], name='idx_ticket_resolved_at'),
        ]


class TicketAttachment(models.Model):
    """
    A file attached to a ticket.
    """
    ticket = models.ForeignKey('Ticket', on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='ticket_attachments/%Y/%m/')
    filename = models.CharField(max_length=255, help_text="Original filename")
    uploaded_by = models.ForeignKey('User', on_delete=models.CASCADE, related_name='uploaded_attachments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.filename} on Ticket #{self.ticket_id}"

    class Meta:
        db_table = 'ticket_attachments'
        ordering = ['-created_at']


class Comment(models.Model):
    """
    A timestamped message on a ticket from any agent.
    """
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey("User", on_delete=models.CASCADE)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Comment by {self.author.username} on {self.ticket}"
    
    class Meta:
        db_table = 'comments'
        ordering = ['created_at']


class AuditLog(models.Model):
    """
    Audit trail for all changes to entities.
    """
    entity_type = models.CharField(max_length=50)  # e.g., 'Ticket', 'Project', 'Comment'
    entity_id = models.PositiveIntegerField()
    action = models.CharField(max_length=50)  # e.g., 'CREATE', 'UPDATE', 'DELETE'
    performed_by = models.ForeignKey("User", on_delete=models.CASCADE)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.action} {self.entity_type}#{self.entity_id} by {self.performed_by.username}"
    
    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id'], name='idx_audit_entity'),
        ]


# Signal handlers for audit logging
from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.forms.models import model_to_dict
from django.core.serializers.json import DjangoJSONEncoder
import json


def serialize_model_for_audit(instance):
    """
    Serialize model instance for audit logging, handling datetime and other non-JSON types.
    """
    data = model_to_dict(instance)
    # Convert the data to JSON and back to handle datetime serialization
    json_string = json.dumps(data, cls=DjangoJSONEncoder)
    return json.loads(json_string)


@receiver(pre_save, sender=Ticket)
def ticket_pre_save(sender, instance, **kwargs):
    """Store old values before save for audit logging."""
    if instance.pk:
        instance._old_values = serialize_model_for_audit(Ticket.objects.get(pk=instance.pk))
    else:
        instance._old_values = None


@receiver(post_save, sender=Ticket)
def ticket_post_save(sender, instance, created, **kwargs):
    """Create audit log entry for ticket changes and trigger email notifications."""
    
    if hasattr(instance, '_state') and hasattr(instance._state, 'adding') and instance._state.adding:
        # This is a new instance
        AuditLog.objects.create(
            entity_type='Ticket',
            entity_id=instance.pk,
            action='CREATE',
            performed_by=instance.created_by,
            old_value=None,
            new_value=serialize_model_for_audit(instance)
        )
    elif hasattr(instance, '_old_values') and instance._old_values is not None:
        # This is an update
        old_values = instance._old_values
        new_values = serialize_model_for_audit(instance)
        
        # Determine who performed the action (for now, use created_by, in real app this would come from request)
        performer = getattr(instance, '_performed_by', instance.created_by)
        
        AuditLog.objects.create(
            entity_type='Ticket',
            entity_id=instance.pk,
            action='UPDATE',
            performed_by=performer,
            old_value=old_values,
            new_value=new_values
        )
        


@receiver(post_save, sender=Comment)
def comment_post_save(sender, instance, created, **kwargs):
    """Create audit log entry for comment changes and trigger email notifications."""
    if created:
        AuditLog.objects.create(
            entity_type='Comment',
            entity_id=instance.pk,
            action='CREATE',
            performed_by=instance.author,
            old_value=None,
            new_value=serialize_model_for_audit(instance)
        )
        


@receiver(post_save, sender=Project)
def project_post_save(sender, instance, created, **kwargs):
    """Create audit log entry for project changes."""
    if created:
        # For new projects, we need to get the performer from somewhere
        # In a real app, this would come from the request context
        # For now, we'll skip audit logging for project creation in signals
        # and handle it in the API views instead
        pass


@receiver(post_delete, sender=Ticket)
def ticket_post_delete(sender, instance, **kwargs):
    """Create audit log entry for ticket deletion."""
    # Note: In a real app, we'd need to get the performer from request context
    # For now, we'll skip this and handle deletion audit in API views
    pass


class Subscription(models.Model):
    """Billing subscription for a workspace."""
    PLAN_CHOICES = [('free', 'Free'), ('pro', 'Pro'), ('enterprise', 'Enterprise')]
    STATUS_CHOICES = [('active', 'Active'), ('cancelled', 'Cancelled'), ('past_due', 'Past Due'), ('trialing', 'Trialing')]

    workspace = models.OneToOneField('Workspace', on_delete=models.CASCADE, related_name='subscription')
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default='free')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    licensed_seats = models.PositiveIntegerField(default=3, help_text="Number of seats purchased for this workspace")
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    current_period_end = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.workspace.name} - {self.plan}"

    class Meta:
        db_table = 'subscriptions'


class BlogPost(models.Model):
    """Public blog post for SEO and content marketing."""
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    content = models.TextField(help_text="Full post content (HTML or Markdown)")
    excerpt = models.TextField(max_length=500, blank=True, default='', help_text="Short summary for listings")
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='blog_posts')
    featured_image_url = models.URLField(max_length=500, blank=True, default='', help_text="Optional featured image URL")
    meta_title = models.CharField(max_length=255, blank=True, default='', help_text="SEO meta title (falls back to title)")
    meta_description = models.CharField(max_length=320, blank=True, default='', help_text="SEO meta description (falls back to excerpt)")
    tags = models.CharField(max_length=500, blank=True, default='', help_text="Comma-separated tags")
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'blog_posts'
        ordering = ['-published_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.title)
        if self.is_published and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)


def media_upload_path(instance, filename):
    """Organize uploads: media/<workspace_id>/<type>/<YYYY>/<MM>/<filename>"""
    from datetime import datetime
    now = datetime.now()
    return f"uploads/{instance.workspace_id}/{instance.media_type}/{now.year}/{now.month:02d}/{filename}"


class MediaFile(models.Model):
    """
    General-purpose media file storage (images, video, audio).
    Workspace-scoped, optionally linked to a ticket.
    """
    MEDIA_TYPES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('audio', 'Audio'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='media_files')
    ticket = models.ForeignKey('Ticket', on_delete=models.SET_NULL, null=True, blank=True, related_name='media_files')
    file = models.FileField(upload_to=media_upload_path)
    filename = models.CharField(max_length=255, help_text="Original filename")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='other')
    content_type = models.CharField(max_length=100, blank=True, help_text="MIME type")
    size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    uploaded_by = models.ForeignKey('User', on_delete=models.CASCADE, related_name='media_files')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.filename} ({self.media_type})"

    class Meta:
        db_table = 'media_files'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if self.file and not self.content_type:
            import mimetypes
            ct, _ = mimetypes.guess_type(self.filename or self.file.name)
            self.content_type = ct or 'application/octet-stream'
        if self.file and not self.media_type or self.media_type == 'other':
            ct = self.content_type or ''
            if ct.startswith('image/'):
                self.media_type = 'image'
            elif ct.startswith('video/'):
                self.media_type = 'video'
            elif ct.startswith('audio/'):
                self.media_type = 'audio'
        if self.file and not self.size:
            try:
                self.size = self.file.size
            except Exception:
                pass
        super().save(*args, **kwargs)


class OTP(models.Model):
    """
    One-time password for email verification and password reset.
    6-digit OTP code with expiration.
    """
    PURPOSE_CHOICES = [
        ('verify_email', 'Email Verification'),
        ('reset_password', 'Password Reset'),
    ]
    
    email = models.EmailField(help_text="Email address this OTP is for")
    otp_code = models.CharField(max_length=6, help_text="6-digit OTP code")
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, help_text="What this OTP is for")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="When this OTP expires")
    used = models.BooleanField(default=False, help_text="Whether this OTP has been used")
    
    class Meta:
        db_table = 'otps'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'purpose'], name='idx_otp_email_purpose'),
            models.Index(fields=['expires_at'], name='idx_otp_expires'),
        ]
    
    def __str__(self):
        return f"OTP {self.otp_code} for {self.email} ({self.purpose})"
    
    def is_expired(self):
        return timezone.now() > self.expires_at
    
    def is_valid(self):
        return not self.used and not self.is_expired()
    
    @classmethod
    def generate_code(cls):
        """Generate a random 6-digit OTP code."""
        import random
        return f"{random.randint(100000, 999999)}"
    
    def save(self, *args, **kwargs):
        if not self.otp_code:
            self.otp_code = self.generate_code()
        if not self.expires_at:
            # OTPs expire after 15 minutes
            from datetime import timedelta
            self.expires_at = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)

class CommunityTemplate(models.Model):
    """
    A workspace can publish their state machine as a public community template.
    Other workspaces can browse, rate, and sync from these.
    """
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name='community_template')
    name = models.CharField(max_length=100, help_text="Display name for the template")
    slug = models.SlugField(max_length=50, unique=True, help_text="URL-friendly identifier")
    description = models.TextField(blank=True, help_text="What this workflow is for")
    is_published = models.BooleanField(default=False, help_text="Whether this template is publicly visible")
    rating_sum = models.IntegerField(default=0, help_text="Sum of all ratings")
    rating_count = models.IntegerField(default=0, help_text="Number of ratings")
    sync_count = models.IntegerField(default=0, help_text="Number of times this template has been synced")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'community_templates'
        ordering = ['-rating_sum', '-sync_count', '-created_at']

    @property
    def avg_rating(self):
        if self.rating_count == 0:
            return 0
        return round(self.rating_sum / self.rating_count, 1)

    def __str__(self):
        return f"{self.name} ({'published' if self.is_published else 'draft'}) ★{self.avg_rating}"


class CommunityRating(models.Model):
    """
    A user rates a community template (1-5 stars). One rating per user per template.
    """
    template = models.ForeignKey(CommunityTemplate, on_delete=models.CASCADE, related_name='ratings')
    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='template_ratings')
    score = models.PositiveSmallIntegerField(help_text="Rating 1-5")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'community_ratings'
        unique_together = ('template', 'user')

    def __str__(self):
        return f"{self.user.username} → {self.template.name}: {self.score}★"


class StateTemplate(models.Model):
    """A named, shareable package of states published by a workspace."""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default='')
    icon = models.CharField(max_length=10, blank=True, default='')  # emoji
    workspace = models.ForeignKey('Workspace', on_delete=models.CASCADE, related_name='state_templates')
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    sync_count = models.IntegerField(default=0)  # how many times imported
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'state_templates'
        ordering = ['-sync_count', 'name']

    def __str__(self):
        return self.name


class StateTemplateItem(models.Model):
    """A single state within a template."""
    template = models.ForeignKey(StateTemplate, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=100)
    key = models.CharField(max_length=50)
    color = models.CharField(max_length=7, default='#6366f1')
    order = models.IntegerField(default=0)
    is_default = models.BooleanField(default=False)
    allowed_from_keys = models.JSONField(default=list, blank=True)  # list of key strings

    class Meta:
        db_table = 'state_template_items'
        ordering = ['order']
        unique_together = [('template', 'key')]

    def __str__(self):
        return f"{self.template.name} → {self.name}"
