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
    
    # Keep the username field as per best practices
    # Email is already included in AbstractUser
    
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
    Roles are decided at the project level (ProjectAgent.role).
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey("User", on_delete=models.CASCADE, related_name='workspace_memberships')
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} in {self.workspace.name}"

    class Meta:
        db_table = 'workspace_members'
        ordering = ['-joined_at']
        unique_together = ('workspace', 'user')
        ordering = ['joined_at']


class WorkspaceInvite(models.Model):
    """
    Invite link for joining a workspace.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='invites')
    token = models.UUIDField(unique=True, default=uuid.uuid4)
    created_by = models.ForeignKey("User", on_delete=models.CASCADE, related_name='created_invites')
    expires_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    use_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invite to {self.workspace.name} ({self.token})"

    class Meta:
        db_table = 'workspace_invites'
        ordering = ['-created_at']


class StatusDefinition(models.Model):
    """
    A status that tickets can have, defined per workspace.
    Editable state machine — workspace-level, inheritable by projects.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='status_definitions')
    key = models.CharField(max_length=30, help_text="Immutable key, e.g. IN_PROGRESS")
    label = models.CharField(max_length=50, help_text="Display label, e.g. 'In Progress'")
    color = models.CharField(max_length=30, default='gray', help_text="Color token, e.g. 'blue', 'red', '#ff0000'")
    is_terminal = models.BooleanField(default=False, help_text="Terminal states cannot transition out")
    is_default = models.BooleanField(default=False, help_text="Default status for new tickets")
    is_bot_requires_approval = models.BooleanField(default=False, help_text="Bots need ticket approval before entering this state")
    position = models.PositiveIntegerField(default=0, help_text="Display order")

    class Meta:
        db_table = 'status_definitions'
        unique_together = ('workspace', 'key')
        ordering = ['position']

    def __str__(self):
        return f"{self.label} ({self.key}) — {self.workspace.name}"


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


class Project(models.Model):
    """
    Groups related tickets and agents.
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='projects', null=True, blank=True)
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=10, blank=True, help_text="Short prefix for ticket slugs, e.g. SA")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Many-to-many relationship with agents through ProjectAgent
    agents = models.ManyToManyField("User", through='ProjectAgent', blank=True)

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


class ProjectAgent(models.Model):
    """
    Join table for Project-Agent many-to-many relationship.
    Role at project level: ADMIN or MEMBER.
    """
    PROJECT_ROLES = [
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    agent = models.ForeignKey("User", on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=PROJECT_ROLES, default='MEMBER')
    can_approve_tickets = models.BooleanField(default=False, help_text="Whether this agent can approve tickets in this project")
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'project_agents'
        unique_together = ('project', 'agent')


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

    APPROVAL_STATUS_CHOICES = [
        ('UNAPPROVED', 'Unapproved'),
        ('APPROVED', 'Approved'),
    ]
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tickets')
    ticket_number = models.PositiveIntegerField(null=True, blank=True, help_text="Project-scoped ticket number")
    title = models.CharField(max_length=500)
    description = models.TextField()
    status = models.CharField(max_length=30, default='OPEN')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    ticket_type = models.CharField(max_length=20, choices=TICKET_TYPE_CHOICES, default='BUG')
    approved_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='UNAPPROVED')
    
    # Assignment - one agent or null
    assigned_to = models.ForeignKey(
        "User", 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='assigned_tickets'
    )
    
    created_by = models.ForeignKey("User", on_delete=models.CASCADE, related_name='created_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    @property
    def ticket_slug(self):
        """Return project-scoped slug like SA-1."""
        if self.project and self.ticket_number:
            return f"{self.project.slug}-{self.ticket_number}"
        return f"#{self.pk}" if self.pk else None

    def clean(self):
        """
        Set timestamp fields on status changes using StatusDefinition.is_terminal.
        """
        if self.pk:
            old_ticket = Ticket.objects.get(pk=self.pk)
            old_status = old_ticket.status
            
            if old_status != self.status:
                # Check if new status is terminal via StatusDefinition
                ws_id = self.project.workspace_id if self.project and self.project.workspace_id else None
                if ws_id:
                    is_terminal = StatusDefinition.objects.filter(
                        workspace_id=ws_id, key=self.status, is_terminal=True
                    ).exists()
                    if is_terminal:
                        self.resolved_at = self.resolved_at or timezone.now()
                        self.closed_at = timezone.now()
    
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


@receiver(post_save, sender=ProjectAgent)
def project_agent_post_save(sender, instance, created, **kwargs):
    """Create audit log entry for project agent changes and trigger email notifications."""
    if created:
        AuditLog.objects.create(
            entity_type='ProjectAgent',
            entity_id=instance.pk,
            action='CREATE',
            performed_by=instance.agent,  # For now, assume agent added themselves
            old_value=None,
            new_value=serialize_model_for_audit(instance)
        )
        


@receiver(post_delete, sender=Ticket)
def ticket_post_delete(sender, instance, **kwargs):
    """Create audit log entry for ticket deletion."""
    # Note: In a real app, we'd need to get the performer from request context
    # For now, we'll skip this and handle deletion audit in API views
    pass


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