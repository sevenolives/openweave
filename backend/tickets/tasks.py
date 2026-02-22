"""
Celery tasks for email notifications.
"""
from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone
from .models import Agent, Ticket, Comment, Project
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_email(self, recipient_email, subject, template_name, context):
    """
    Send a notification email with retry logic and exponential backoff.
    
    Args:
        recipient_email: Email address to send to
        subject: Email subject line
        template_name: Template name (without .html extension)
        context: Dictionary of context variables for the template
    """
    try:
        # Render HTML and text versions
        html_message = render_to_string(f'emails/{template_name}.html', context)
        plain_message = render_to_string(f'emails/{template_name}.txt', context)
        
        # Send the email
        send_mail(
            subject=subject,
            message=plain_message,
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        
        logger.info(f"Email sent successfully to {recipient_email}: {subject}")
        
    except Exception as exc:
        logger.error(f"Failed to send email to {recipient_email}: {str(exc)}")
        
        # Exponential backoff: 1min, 2min, 4min
        countdown = 60 * (2 ** self.request.retries)
        
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying email send in {countdown} seconds (attempt {self.request.retries + 1}/{self.max_retries})")
            raise self.retry(countdown=countdown, exc=exc)
        else:
            logger.error(f"Max retries exceeded for email to {recipient_email}")
            raise exc


@shared_task
def send_ticket_assignment_notification(ticket_id, assigned_to_id, assigned_by_id):
    """
    Send notification when a ticket is assigned to an agent.
    """
    try:
        ticket = Ticket.objects.select_related('project', 'assigned_to', 'created_by').get(id=ticket_id)
        assigned_to = Agent.objects.get(id=assigned_to_id)
        assigned_by = Agent.objects.get(id=assigned_by_id) if assigned_by_id else None
        
        # Check notification preferences
        if assigned_to.notification_preference == 'NONE':
            return
            
        if assigned_to.notification_preference == 'CRITICAL' and ticket.priority not in ['HIGH', 'CRITICAL']:
            return
        
        # Prepare serializable context
        context = {
            'agent': {
                'first_name': assigned_to.first_name,
                'last_name': assigned_to.last_name,
                'username': assigned_to.username,
            },
            'ticket': {
                'id': ticket.id,
                'title': ticket.title,
                'description': ticket.description,
                'priority': ticket.priority,
                'status': ticket.status,
                'created_at': ticket.created_at,
                'get_priority_display': ticket.get_priority_display(),
                'get_status_display': ticket.get_status_display(),
                'project': {
                    'name': ticket.project.name,
                },
            },
            'assigned_by': {
                'first_name': assigned_by.first_name if assigned_by else None,
                'last_name': assigned_by.last_name if assigned_by else None,
                'username': assigned_by.username if assigned_by else None,
            } if assigned_by else None,
            'site_url': settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000',
        }
        
        subject = f'Ticket Assigned: #{ticket.id} - {ticket.title}'
        
        # Send the email
        send_notification_email.delay(
            recipient_email=assigned_to.email,
            subject=subject,
            template_name='ticket_assigned',
            context=context
        )
        
    except Exception as exc:
        logger.error(f"Failed to send ticket assignment notification: {str(exc)}")


@shared_task
def send_ticket_status_change_notification(ticket_id, old_status, new_status, changed_by_id):
    """
    Send notification when a ticket status changes.
    """
    try:
        ticket = Ticket.objects.select_related('project', 'assigned_to', 'created_by').get(id=ticket_id)
        changed_by = Agent.objects.get(id=changed_by_id) if changed_by_id else None
        
        # Get all agents who should be notified
        notify_agents = []
        
        # Notify assigned agent
        if ticket.assigned_to:
            notify_agents.append(ticket.assigned_to)
            
        # Notify ticket creator if different from assigned agent
        if ticket.created_by and ticket.created_by != ticket.assigned_to:
            notify_agents.append(ticket.created_by)
            
        # For BLOCKED status, also notify project admins
        if new_status == 'BLOCKED':
            project_admins = Agent.objects.filter(
                projectagent__project=ticket.project,
                role='ADMIN'
            ).distinct()
            for admin in project_admins:
                if admin not in notify_agents:
                    notify_agents.append(admin)
        
        # Send notifications to each agent
        for agent in notify_agents:
            # Check notification preferences
            if agent.notification_preference == 'NONE':
                continue
                
            # For CRITICAL preference, only send for high/critical tickets or blocked status
            if (agent.notification_preference == 'CRITICAL' and 
                ticket.priority not in ['HIGH', 'CRITICAL'] and 
                new_status != 'BLOCKED'):
                continue
            
            # Prepare serializable context
            context = {
                'agent': {
                    'first_name': agent.first_name,
                    'last_name': agent.last_name,
                    'username': agent.username,
                },
                'ticket': {
                    'id': ticket.id,
                    'title': ticket.title,
                    'priority': ticket.priority,
                    'status': ticket.status,
                    'updated_at': ticket.updated_at,
                    'get_priority_display': ticket.get_priority_display(),
                    'get_status_display': ticket.get_status_display(),
                    'project': {
                        'name': ticket.project.name,
                    },
                    'assigned_to': {
                        'first_name': ticket.assigned_to.first_name if ticket.assigned_to else None,
                        'username': ticket.assigned_to.username if ticket.assigned_to else None,
                    } if ticket.assigned_to else None,
                },
                'old_status': old_status,
                'new_status': new_status,
                'changed_by': {
                    'first_name': changed_by.first_name if changed_by else None,
                    'last_name': changed_by.last_name if changed_by else None,
                    'username': changed_by.username if changed_by else None,
                } if changed_by else None,
                'site_url': settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000',
            }
            
            subject = f'Ticket Status Changed: #{ticket.id} - {old_status} → {new_status}'
            
            send_notification_email.delay(
                recipient_email=agent.email,
                subject=subject,
                template_name='ticket_status_changed',
                context=context
            )
            
    except Exception as exc:
        logger.error(f"Failed to send ticket status change notification: {str(exc)}")


@shared_task
def send_comment_notification(comment_id):
    """
    Send notification when a new comment is added to a ticket.
    """
    try:
        comment = Comment.objects.select_related('ticket', 'author', 'ticket__project', 'ticket__assigned_to', 'ticket__created_by').get(id=comment_id)
        ticket = comment.ticket
        
        # Get all agents who should be notified (excluding the comment author)
        notify_agents = []
        
        # Notify assigned agent
        if ticket.assigned_to and ticket.assigned_to != comment.author:
            notify_agents.append(ticket.assigned_to)
            
        # Notify ticket creator if different from assigned agent and comment author
        if (ticket.created_by and 
            ticket.created_by != ticket.assigned_to and 
            ticket.created_by != comment.author):
            notify_agents.append(ticket.created_by)
            
        # Notify other commenters on the ticket (exclude duplicates and comment author)
        other_commenters = Agent.objects.filter(
            comment__ticket=ticket
        ).exclude(id=comment.author.id).distinct()
        
        for commenter in other_commenters:
            if commenter not in notify_agents:
                notify_agents.append(commenter)
        
        # Send notifications to each agent
        for agent in notify_agents:
            # Check notification preferences
            if agent.notification_preference == 'NONE':
                continue
                
            if (agent.notification_preference == 'CRITICAL' and 
                ticket.priority not in ['HIGH', 'CRITICAL']):
                continue
            
            # Prepare serializable context
            context = {
                'agent': {
                    'first_name': agent.first_name,
                    'last_name': agent.last_name,
                    'username': agent.username,
                },
                'ticket': {
                    'id': ticket.id,
                    'title': ticket.title,
                    'priority': ticket.priority,
                    'status': ticket.status,
                    'get_priority_display': ticket.get_priority_display(),
                    'get_status_display': ticket.get_status_display(),
                    'project': {
                        'name': ticket.project.name,
                    },
                    'assigned_to': {
                        'first_name': ticket.assigned_to.first_name if ticket.assigned_to else None,
                        'username': ticket.assigned_to.username if ticket.assigned_to else None,
                    } if ticket.assigned_to else None,
                },
                'comment': {
                    'id': comment.id,
                    'body': comment.body,
                    'created_at': comment.created_at,
                    'author': {
                        'first_name': comment.author.first_name,
                        'last_name': comment.author.last_name,
                        'username': comment.author.username,
                    }
                },
                'site_url': settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000',
            }
            
            subject = f'New Comment: #{ticket.id} - {ticket.title}'
            
            send_notification_email.delay(
                recipient_email=agent.email,
                subject=subject,
                template_name='new_comment',
                context=context
            )
            
    except Exception as exc:
        logger.error(f"Failed to send comment notification: {str(exc)}")


@shared_task
def send_project_agent_added_notification(project_id, agent_id, added_by_id=None):
    """
    Send notification when an agent is added to a project.
    """
    try:
        project = Project.objects.get(id=project_id)
        agent = Agent.objects.get(id=agent_id)
        added_by = Agent.objects.get(id=added_by_id) if added_by_id else None
        
        # Check notification preferences
        if agent.notification_preference == 'NONE':
            return
        
        # Prepare serializable context
        context = {
            'agent': {
                'first_name': agent.first_name,
                'last_name': agent.last_name,
                'username': agent.username,
            },
            'project': {
                'id': project.id,
                'name': project.name,
                'description': project.description,
                'created_at': project.created_at,
            },
            'added_by': {
                'first_name': added_by.first_name if added_by else None,
                'last_name': added_by.last_name if added_by else None,
                'username': added_by.username if added_by else None,
            } if added_by else None,
            'site_url': settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000',
        }
        
        subject = f'Added to Project: {project.name}'
        
        send_notification_email.delay(
            recipient_email=agent.email,
            subject=subject,
            template_name='project_agent_added',
            context=context
        )
        
    except Exception as exc:
        logger.error(f"Failed to send project agent added notification: {str(exc)}")