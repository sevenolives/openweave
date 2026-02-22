#!/usr/bin/env python
"""
Test script for email notifications.
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'agentdesk.settings')
django.setup()

from tickets.models import Agent, Project, Ticket, Comment, ProjectAgent
from tickets.tasks import (
    send_ticket_assignment_notification,
    send_ticket_status_change_notification,
    send_comment_notification,
    send_project_agent_added_notification,
)

def test_email_notifications():
    print("Testing email notifications...")
    
    # Create test agents
    admin_agent, created = Agent.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@test.com',
            'agent_type': 'HUMAN',
            'role': 'ADMIN',
            'notification_preference': 'ALL',
            'first_name': 'Admin',
            'last_name': 'User'
        }
    )
    
    test_agent, created = Agent.objects.get_or_create(
        username='testagent',
        defaults={
            'email': 'agent@test.com',
            'agent_type': 'HUMAN',
            'role': 'MEMBER',
            'notification_preference': 'ALL',
            'first_name': 'Test',
            'last_name': 'Agent'
        }
    )
    
    # Create test project
    project, created = Project.objects.get_or_create(
        name='Test Project',
        defaults={'description': 'A test project for email notifications'}
    )
    
    # Create test ticket
    ticket, created = Ticket.objects.get_or_create(
        title='Test Ticket for Email Notifications',
        defaults={
            'project': project,
            'description': 'This is a test ticket to verify email notifications work properly.',
            'created_by': admin_agent,
            'priority': 'HIGH',
            'status': 'OPEN'
        }
    )
    
    print(f"Created/found agents: {admin_agent.email}, {test_agent.email}")
    print(f"Created/found project: {project.name}")
    print(f"Created/found ticket: #{ticket.id} - {ticket.title}")
    
    # Test 1: Ticket assignment notification
    print("\n1. Testing ticket assignment notification...")
    send_ticket_assignment_notification.delay(
        ticket_id=ticket.id,
        assigned_to_id=test_agent.id,
        assigned_by_id=admin_agent.id
    )
    print("✓ Ticket assignment notification queued")
    
    # Test 2: Status change notification
    print("\n2. Testing status change notification...")
    send_ticket_status_change_notification.delay(
        ticket_id=ticket.id,
        old_status='OPEN',
        new_status='BLOCKED',
        changed_by_id=admin_agent.id
    )
    print("✓ Status change notification queued")
    
    # Test 3: Comment notification
    comment = Comment.objects.create(
        ticket=ticket,
        author=admin_agent,
        body='This is a test comment to verify email notifications.'
    )
    print(f"\n3. Testing comment notification...")
    send_comment_notification.delay(comment_id=comment.id)
    print("✓ Comment notification queued")
    
    # Test 4: Project agent added notification
    print("\n4. Testing project agent added notification...")
    send_project_agent_added_notification.delay(
        project_id=project.id,
        agent_id=test_agent.id,
        added_by_id=admin_agent.id
    )
    print("✓ Project agent added notification queued")
    
    print("\n🎉 All email notifications have been queued!")
    print("Check your console output (or configured email backend) for the email content.")
    print("\nTo process the queue with a worker, run:")
    print("celery -A agentdesk worker --loglevel=info")

if __name__ == '__main__':
    test_email_notifications()