from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q
from tickets.models import Project, Ticket, Comment
import json

User = get_user_model()


class Command(BaseCommand):
    """
    Seed database with sample data.
    Idempotent - safe to run multiple times.
    """
    help = 'Create sample data for development'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample data...')

        # Create sample agents
        self.create_agents()
        
        # Create sample projects
        self.create_projects()
        
        # Create sample tickets
        self.create_tickets()
        
        # Create sample comments
        self.create_comments()
        
        self.stdout.write(
            self.style.SUCCESS('Sample data created successfully!')
        )

    def create_agents(self):
        """Create sample agents."""
        agents_data = [
            {
                'username': 'alice_agent',
                'email': 'alice@agent-desk.com',
                'first_name': 'Alice',
                'last_name': 'Johnson',
                'agent_type': 'HUMAN',
                'role': 'MEMBER',
                'skills': ['python', 'django', 'frontend']
            },
            {
                'username': 'bob_agent',
                'email': 'bob@agent-desk.com',
                'first_name': 'Bob',
                'last_name': 'Smith',
                'agent_type': 'HUMAN',
                'role': 'MEMBER',
                'skills': ['javascript', 'react', 'backend']
            },
            {
                'username': 'support_bot',
                'email': 'bot@agent-desk.com',
                'first_name': 'Support',
                'last_name': 'Bot',
                'agent_type': 'BOT',
                'role': 'MEMBER',
                'skills': ['automated_responses', 'ticket_triage']
            },
        ]

        for agent_data in agents_data:
            # Check if user exists by email or username
            existing_user = User.objects.filter(
                Q(email=agent_data['email']) | Q(username=agent_data['username'])
            ).first()

            if not existing_user:
                User.objects.create_user(
                    username=agent_data['username'],
                    email=agent_data['email'],
                    password='password123',  # Default password for dev
                    first_name=agent_data['first_name'],
                    last_name=agent_data['last_name'],
                    agent_type=agent_data['agent_type'],
                    role=agent_data['role'],
                    skills=agent_data['skills']
                )
                self.stdout.write(f'  ✓ Created agent: {agent_data["username"]}')
            else:
                self.stdout.write(f'  - Agent already exists: {agent_data["username"]}')

    def create_projects(self):
        """Create sample projects."""
        projects_data = [
            {
                'name': 'Website Redesign',
                'description': 'Complete redesign of the company website with modern UI/UX',
            },
            {
                'name': 'Mobile App Development',
                'description': 'Development of a mobile application for customer support',
            },
            {
                'name': 'API Integration',
                'description': 'Integration with third-party APIs and services',
            },
        ]

        for project_data in projects_data:
            project, created = Project.objects.get_or_create(
                name=project_data['name'],
                defaults={'description': project_data['description']}
            )

            if created:
                # Add some agents to the project
                agents = User.objects.filter(agent_type='HUMAN')[:2]
                project.agents.set(agents)
                self.stdout.write(f'  ✓ Created project: {project.name}')
            else:
                self.stdout.write(f'  - Project already exists: {project.name}')

    def create_tickets(self):
        """Create sample tickets."""
        # Get some data to work with
        projects = Project.objects.all()
        agents = User.objects.all()

        if not projects.exists() or not agents.exists():
            self.stdout.write('  - No projects or agents found, skipping ticket creation')
            return

        tickets_data = [
            {
                'title': 'Update homepage design',
                'description': 'The homepage needs a fresh new design to improve user engagement.',
                'status': 'OPEN',
                'priority': 'HIGH',
            },
            {
                'title': 'Fix login bug',
                'description': 'Users are reporting issues with the login functionality.',
                'status': 'IN_PROGRESS',
                'priority': 'CRITICAL',
            },
            {
                'title': 'Add user profile page',
                'description': 'Implement a user profile page where users can edit their information.',
                'status': 'RESOLVED',
                'priority': 'MEDIUM',
            },
            {
                'title': 'Optimize database queries',
                'description': 'Some database queries are running slowly and need optimization.',
                'status': 'BLOCKED',
                'priority': 'HIGH',
            },
            {
                'title': 'Add dark mode support',
                'description': 'Implement dark mode theme throughout the application.',
                'status': 'OPEN',
                'priority': 'LOW',
            },
        ]

        created_tickets = []
        for i, ticket_data in enumerate(tickets_data):
            project = projects[i % projects.count()]
            creator = agents.first()  # Use first agent as creator

            # Check if ticket already exists
            existing_ticket = Ticket.objects.filter(
                title=ticket_data['title'],
                project=project
            ).first()

            if not existing_ticket:
                ticket = Ticket.objects.create(
                    project=project,
                    title=ticket_data['title'],
                    description=ticket_data['description'],
                    status=ticket_data['status'],
                    priority=ticket_data['priority'],
                    created_by=creator,
                    assigned_to=agents[i % agents.count()] if ticket_data['status'] != 'OPEN' else None
                )
                created_tickets.append(ticket)
                self.stdout.write(f'  ✓ Created ticket: {ticket.title}')
            else:
                created_tickets.append(existing_ticket)
                self.stdout.write(f'  - Ticket already exists: {ticket_data["title"]}')

        return created_tickets

    def create_comments(self):
        """Create sample comments."""
        tickets = Ticket.objects.all()
        agents = User.objects.all()

        if not tickets.exists() or not agents.exists():
            self.stdout.write('  - No tickets or agents found, skipping comment creation')
            return

        comments_data = [
            {
                'body': 'I can work on this ticket. Assigning it to myself.',
            },
            {
                'body': 'Started working on the design mockups. Should have them ready by tomorrow.',
            },
            {
                'body': 'The issue was more complex than expected. Need to review the authentication flow.',
            },
            {
                'body': 'Fixed the bug! Deployed the fix to production.',
            },
            {
                'body': 'This is blocked due to missing requirements. Need input from the product team.',
            },
        ]

        for i, comment_data in enumerate(comments_data):
            ticket = tickets[i % tickets.count()]
            author = agents[i % agents.count()]

            # Check if similar comment already exists
            existing_comment = Comment.objects.filter(
                ticket=ticket,
                body=comment_data['body']
            ).first()

            if not existing_comment:
                Comment.objects.create(
                    ticket=ticket,
                    author=author,
                    body=comment_data['body']
                )
                self.stdout.write(f'  ✓ Created comment on ticket: {ticket.title}')
            else:
                self.stdout.write(f'  - Comment already exists on ticket: {ticket.title}')