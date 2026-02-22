#!/usr/bin/env python
"""
Comprehensive demo of the email notification system.
"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'agentdesk.settings')
django.setup()

from tickets.models import Agent, Project, Ticket, Comment, ProjectAgent

def demonstrate_email_system():
    print("=" * 60)
    print("📧 AGENT DESK EMAIL NOTIFICATION SYSTEM DEMO")
    print("=" * 60)
    
    # Create demonstration agents with different notification preferences
    print("\n1. Creating agents with different notification preferences...")
    
    admin = Agent.objects.create_user(
        username='admin_demo',
        email='admin@agentdesk.com',
        first_name='Admin',
        last_name='User',
        agent_type='HUMAN',
        role='ADMIN',
        notification_preference='ALL'  # Gets all notifications
    )
    
    senior_agent = Agent.objects.create_user(
        username='senior_demo',
        email='senior@agentdesk.com',
        first_name='Senior',
        last_name='Agent',
        agent_type='HUMAN',
        role='MEMBER',
        notification_preference='CRITICAL'  # Only high/critical + blocked
    )
    
    junior_agent = Agent.objects.create_user(
        username='junior_demo',
        email='junior@agentdesk.com',
        first_name='Junior',
        last_name='Agent',
        agent_type='HUMAN',
        role='MEMBER',
        notification_preference='NONE'  # No notifications
    )
    
    print(f"✓ {admin.username} - Preference: {admin.notification_preference}")
    print(f"✓ {senior_agent.username} - Preference: {senior_agent.notification_preference}")
    print(f"✓ {junior_agent.username} - Preference: {junior_agent.notification_preference}")
    
    # Create a project and add agents
    print("\n2. Creating project and adding agents...")
    
    project = Project.objects.create(
        name='Email System Demo Project',
        description='A project to demonstrate the email notification system capabilities.'
    )
    
    # Adding agents to project triggers notifications
    ProjectAgent.objects.create(project=project, agent=senior_agent)
    ProjectAgent.objects.create(project=project, agent=junior_agent)
    
    print(f"✓ Created project: {project.name}")
    print(f"✓ Added agents to project (email notifications triggered)")
    
    # Create tickets with different priorities
    print("\n3. Creating tickets with different priorities...")
    
    low_ticket = Ticket.objects.create(
        project=project,
        title='Low Priority Issue - UI Bug',
        description='Minor cosmetic issue that needs fixing when time permits.',
        created_by=admin,
        priority='LOW',
        status='OPEN'
    )
    
    high_ticket = Ticket.objects.create(
        project=project,
        title='High Priority - Security Vulnerability',
        description='Critical security vulnerability that needs immediate attention!',
        created_by=admin,
        priority='HIGH',
        status='OPEN'
    )
    
    print(f"✓ Created LOW priority ticket #{low_ticket.id}")
    print(f"✓ Created HIGH priority ticket #{high_ticket.id}")
    
    # Assign tickets to agents (triggers assignment notifications)
    print("\n4. Assigning tickets (triggers assignment notifications)...")
    
    # Assign low priority to senior agent (won't notify due to CRITICAL preference)
    low_ticket.assigned_to = senior_agent
    low_ticket._performed_by = admin  # Track who performed the action
    low_ticket.save()
    
    # Assign high priority to senior agent (will notify due to HIGH priority)
    high_ticket.assigned_to = senior_agent
    high_ticket._performed_by = admin
    high_ticket.save()
    
    print(f"✓ Assigned LOW priority ticket to {senior_agent.username} (no email due to CRITICAL preference)")
    print(f"✓ Assigned HIGH priority ticket to {senior_agent.username} (email sent)")
    
    # Change ticket status (triggers status change notifications)
    print("\n5. Changing ticket statuses...")
    
    # Start work on high priority ticket
    high_ticket._old_values = {'status': 'OPEN', 'assigned_to': senior_agent.id}
    high_ticket.status = 'IN_PROGRESS'
    high_ticket._performed_by = senior_agent
    high_ticket.save()
    
    print(f"✓ Changed #{high_ticket.id} to IN_PROGRESS")
    
    # Block the ticket (triggers escalation notifications)
    high_ticket._old_values = {'status': 'IN_PROGRESS', 'assigned_to': senior_agent.id}
    high_ticket.status = 'BLOCKED'
    high_ticket._performed_by = senior_agent
    high_ticket.save()
    
    print(f"✓ Changed #{high_ticket.id} to BLOCKED (escalation email sent)")
    
    # Add comments (triggers comment notifications)
    print("\n6. Adding comments...")
    
    comment1 = Comment.objects.create(
        ticket=high_ticket,
        author=senior_agent,
        body="I've identified the security issue but need access to the production database to investigate further. Blocking until I get the necessary permissions."
    )
    
    comment2 = Comment.objects.create(
        ticket=high_ticket,
        author=admin,
        body="I've granted you access to the staging database. Can you work with that for now?"
    )
    
    print(f"✓ Added comment from {comment1.author.username}")
    print(f"✓ Added comment from {comment2.author.username}")
    
    print("\n" + "=" * 60)
    print("📊 EMAIL NOTIFICATION SUMMARY")
    print("=" * 60)
    
    print(f"""
Expected Email Behavior:

🔔 {admin.username} ({admin.notification_preference}):
   ✅ Gets project agent addition notifications
   ✅ Gets ticket status change notifications
   ✅ Gets comment notifications
   ✅ Gets escalation notification when ticket is BLOCKED

🔕 {senior_agent.username} ({senior_agent.notification_preference}):
   ❌ No notification for LOW priority assignment
   ✅ Gets HIGH priority ticket assignment
   ✅ Gets BLOCKED status escalation (critical event)
   ✅ Gets comment notifications on HIGH priority ticket

🚫 {junior_agent.username} ({junior_agent.notification_preference}):
   ❌ Gets NO email notifications (preference is NONE)

📧 Email Templates Used:
   - ticket_assigned.html/txt
   - ticket_status_changed.html/txt
   - new_comment.html/txt
   - project_agent_added.html/txt

🔧 Background Processing:
   - All emails queued via Celery
   - Redis as message broker
   - Retry logic with exponential backoff
   - Console backend for development
    """)
    
    print("\n" + "=" * 60)
    print("🚀 To process the email queue, run:")
    print("   celery -A agentdesk worker --loglevel=info")
    print("=" * 60)

if __name__ == '__main__':
    demonstrate_email_system()