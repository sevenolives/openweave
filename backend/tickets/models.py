from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
import json


class Agent(AbstractUser):
    """
    Custom user model extending AbstractUser (not AbstractBaseUser per best practices).
    Represents both human agents and bot agents.
    """
    AGENT_TYPES = [
        ('HUMAN', 'Human'),
        ('BOT', 'Bot'),
    ]
    
    ROLES = [
        ('ADMIN', 'Admin'),
        ('MEMBER', 'Member'),
    ]
    
    agent_type = models.CharField(max_length=10, choices=AGENT_TYPES, default='HUMAN')
    role = models.CharField(max_length=10, choices=ROLES, default='MEMBER')
    skills = models.JSONField(default=list, blank=True, help_text="List of skill tags")
    is_active = models.BooleanField(default=True)
    
    # Keep the username field as per best practices
    # Email is already included in AbstractUser
    
    def __str__(self):
        return f"{self.username} ({self.get_agent_type_display()})"
    
    class Meta:
        db_table = 'agents'


class Project(models.Model):
    """
    Groups related tickets and agents.
    """
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Many-to-many relationship with agents through ProjectAgent
    agents = models.ManyToManyField(Agent, through='ProjectAgent', blank=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        db_table = 'projects'
        ordering = ['name']


class ProjectAgent(models.Model):
    """
    Join table for Project-Agent many-to-many relationship.
    """
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'project_agents'
        unique_together = ('project', 'agent')


class Ticket(models.Model):
    """
    A unit of work assigned to exactly one agent at a time.
    Status flow: OPEN → IN_PROGRESS → RESOLVED → CLOSED
    Can move to BLOCKED from IN_PROGRESS and back.
    """
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
        ('BLOCKED', 'Blocked'),
    ]
    
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    
    # Valid status transitions
    STATUS_TRANSITIONS = {
        'OPEN': ['IN_PROGRESS'],
        'IN_PROGRESS': ['RESOLVED', 'BLOCKED'],
        'RESOLVED': ['CLOSED'],
        'BLOCKED': ['IN_PROGRESS'],
        'CLOSED': [],  # Terminal state
    }
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tickets')
    title = models.CharField(max_length=500)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    
    # Assignment - one agent or null
    assigned_to = models.ForeignKey(
        Agent, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='assigned_tickets'
    )
    
    created_by = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='created_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    def clean(self):
        """
        Validate status transitions and set timestamp fields.
        """
        if self.pk:  # Only check transitions for existing tickets
            old_ticket = Ticket.objects.get(pk=self.pk)
            old_status = old_ticket.status
            
            if old_status != self.status:
                valid_transitions = self.STATUS_TRANSITIONS.get(old_status, [])
                if self.status not in valid_transitions:
                    raise ValidationError(
                        f"Cannot transition from {old_status} to {self.status}. "
                        f"Valid transitions: {valid_transitions}"
                    )
                
                # Set timestamps based on status changes
                if self.status == 'RESOLVED' and old_status != 'RESOLVED':
                    self.resolved_at = timezone.now()
                elif self.status == 'CLOSED' and old_status != 'CLOSED':
                    self.closed_at = timezone.now()
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"#{self.pk} - {self.title}"
    
    class Meta:
        db_table = 'tickets'
        ordering = ['-created_at']


class Comment(models.Model):
    """
    A timestamped message on a ticket from any agent.
    """
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(Agent, on_delete=models.CASCADE)
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
    performed_by = models.ForeignKey(Agent, on_delete=models.CASCADE)
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


@receiver(pre_save, sender=Ticket)
def ticket_pre_save(sender, instance, **kwargs):
    """Store old values before save for audit logging."""
    if instance.pk:
        instance._old_values = model_to_dict(Ticket.objects.get(pk=instance.pk))
    else:
        instance._old_values = None


@receiver(post_save, sender=Ticket)
def ticket_post_save(sender, instance, created, **kwargs):
    """Create audit log entry for ticket changes."""
    if hasattr(instance, '_state') and hasattr(instance._state, 'adding') and instance._state.adding:
        # This is a new instance
        AuditLog.objects.create(
            entity_type='Ticket',
            entity_id=instance.pk,
            action='CREATE',
            performed_by=instance.created_by,
            old_value=None,
            new_value=model_to_dict(instance)
        )
    elif hasattr(instance, '_old_values'):
        # This is an update
        # Determine who performed the action (for now, use created_by, in real app this would come from request)
        performer = getattr(instance, '_performed_by', instance.created_by)
        
        AuditLog.objects.create(
            entity_type='Ticket',
            entity_id=instance.pk,
            action='UPDATE',
            performed_by=performer,
            old_value=instance._old_values,
            new_value=model_to_dict(instance)
        )


@receiver(post_save, sender=Comment)
def comment_post_save(sender, instance, created, **kwargs):
    """Create audit log entry for comment changes."""
    if created:
        AuditLog.objects.create(
            entity_type='Comment',
            entity_id=instance.pk,
            action='CREATE',
            performed_by=instance.author,
            old_value=None,
            new_value=model_to_dict(instance)
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