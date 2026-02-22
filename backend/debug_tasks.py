#!/usr/bin/env python
"""
Debug script to test individual tasks.
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'agentdesk.settings')
django.setup()

from tickets.models import Agent, Project, Ticket, Comment
from tickets.tasks import send_notification_email

def test_simple_email():
    print("Testing simple email notification...")
    
    # Test the base email task with simple context
    context = {
        'agent': {
            'first_name': 'Test',
            'username': 'testagent'
        },
        'ticket': {
            'id': 1,
            'title': 'Test Ticket',
            'project': {'name': 'Test Project'},
            'priority': 'HIGH',
            'status': 'OPEN',
            'created_at': '2024-02-22 03:00:00'
        },
        'site_url': 'http://localhost:3000'
    }
    
    try:
        # Try to queue the task
        result = send_notification_email.delay(
            recipient_email='test@test.com',
            subject='Test Email',
            template_name='ticket_assigned',
            context=context
        )
        print(f"✓ Email task queued successfully: {result}")
    except Exception as e:
        print(f"✗ Error queuing task: {e}")

if __name__ == '__main__':
    test_simple_email()