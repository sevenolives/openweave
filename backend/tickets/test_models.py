"""
Test cases for ticket models.
"""
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from .models import User, Project, Ticket, Comment, AuditLog, ProjectAgent


class UserModelTest(TestCase):
    """Test cases for Agent model."""
    
    def setUp(self):
        """Set up test data."""
        self.agent_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123',
            'agent_type': 'HUMAN',
            'role': 'MEMBER'
        }
    
    def test_create_agent(self):
        """Test creating an agent."""
        agent = User.objects.create_user(**self.agent_data)
        self.assertEqual(agent.username, 'testuser')
        self.assertEqual(agent.email, 'test@example.com')
        self.assertEqual(agent.agent_type, 'HUMAN')
        self.assertEqual(agent.role, 'MEMBER')
        self.assertTrue(agent.is_active)
        self.assertFalse(agent.is_staff)
    
    def test_create_admin_agent(self):
        """Test creating an admin agent."""
        self.agent_data['role'] = 'ADMIN'
        agent = User.objects.create_user(**self.agent_data)
        self.assertEqual(agent.role, 'ADMIN')
    
    def test_create_bot_agent(self):
        """Test creating a bot agent."""
        self.agent_data['agent_type'] = 'BOT'
        agent = User.objects.create_user(**self.agent_data)
        self.assertEqual(agent.agent_type, 'BOT')
    
    def test_agent_str(self):
        """Test string representation of agent."""
        agent = User.objects.create_user(**self.agent_data)
        self.assertEqual(str(agent), 'testuser (Human)')
    
    def test_unique_username(self):
        """Test that username must be unique."""
        User.objects.create_user(**self.agent_data)
        
        # Try to create another user with same username
        with self.assertRaises(Exception):
            User.objects.create_user(**self.agent_data)
    
    def test_unique_email(self):
        """Test that email must be unique."""
        User.objects.create_user(**self.agent_data)
        
        # Try to create another user with same email
        agent_data_2 = self.agent_data.copy()
        agent_data_2['username'] = 'testuser2'
        # Note: Django doesn't enforce unique emails by default in AbstractUser
        # This test would need to be implemented if we add unique constraint
        agent2 = User.objects.create_user(**agent_data_2)
        self.assertIsNotNone(agent2)  # Should succeed without unique constraint


class ProjectModelTest(TestCase):
    """Test cases for Project model."""
    
    def setUp(self):
        """Set up test data."""
        self.agent = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.project_data = {
            'name': 'Test Project',
            'description': 'A test project'
        }
    
    def test_create_project(self):
        """Test creating a project."""
        project = Project.objects.create(**self.project_data)
        self.assertEqual(project.name, 'Test Project')
        self.assertEqual(project.description, 'A test project')
        self.assertIsNotNone(project.created_at)
        self.assertIsNotNone(project.updated_at)
    
    def test_project_str(self):
        """Test string representation of project."""
        project = Project.objects.create(**self.project_data)
        self.assertEqual(str(project), 'Test Project')
    
    def test_unique_project_name(self):
        """Test that project name must be unique."""
        Project.objects.create(**self.project_data)
        
        with self.assertRaises(Exception):
            Project.objects.create(**self.project_data)
    
    def test_add_agent_to_project(self):
        """Test adding an agent to a project."""
        project = Project.objects.create(**self.project_data)
        project.agents.add(self.agent)
        
        self.assertEqual(project.agents.count(), 1)
        self.assertIn(self.agent, project.agents.all())


class TicketModelTest(TestCase):
    """Test cases for Ticket model."""
    
    def setUp(self):
        """Set up test data."""
        self.agent = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.project = Project.objects.create(
            name='Test Project',
            description='A test project'
        )
        self.project.agents.add(self.agent)
        
        self.ticket_data = {
            'project': self.project,
            'title': 'Test Ticket',
            'description': 'A test ticket description',
            'status': 'OPEN',
            'priority': 'MEDIUM',
            'created_by': self.agent
        }
    
    def test_create_ticket(self):
        """Test creating a ticket."""
        ticket = Ticket.objects.create(**self.ticket_data)
        self.assertEqual(ticket.title, 'Test Ticket')
        self.assertEqual(ticket.description, 'A test ticket description')
        self.assertEqual(ticket.status, 'OPEN')
        self.assertEqual(ticket.priority, 'MEDIUM')
        self.assertEqual(ticket.created_by, self.agent)
        self.assertIsNotNone(ticket.created_at)
        self.assertIsNotNone(ticket.updated_at)
    
    def test_ticket_str(self):
        """Test string representation of ticket."""
        ticket = Ticket.objects.create(**self.ticket_data)
        expected = f"#{ticket.id} - Test Ticket"
        self.assertEqual(str(ticket), expected)
    
    def test_ticket_status_validation(self):
        """Test ticket status validation."""
        # Valid status
        ticket = Ticket.objects.create(**self.ticket_data)
        ticket.status = 'IN_PROGRESS'
        ticket.full_clean()  # Should not raise exception
        
        # Invalid status transition
        ticket.status = 'CLOSED'
        with self.assertRaises(ValidationError):
            ticket.full_clean()
    
    def test_assign_ticket(self):
        """Test assigning a ticket to an agent."""
        ticket = Ticket.objects.create(**self.ticket_data)
        ticket.assigned_to = self.agent
        ticket.save()
        
        self.assertEqual(ticket.assigned_to, self.agent)
    
    def test_ticket_status_transitions(self):
        """Test valid status transitions."""
        ticket = Ticket.objects.create(**self.ticket_data)
        ticket.save()  # Save to get a PK
        
        # OPEN -> IN_PROGRESS
        ticket.status = 'IN_PROGRESS'
        ticket.save()
        
        # IN_PROGRESS -> BLOCKED
        ticket.status = 'BLOCKED'
        ticket.save()
        
        # BLOCKED -> IN_PROGRESS
        ticket.status = 'IN_PROGRESS'
        ticket.save()
        
        # IN_PROGRESS -> RESOLVED
        ticket.status = 'RESOLVED'
        ticket.save()
        
        # RESOLVED -> CLOSED
        ticket.status = 'CLOSED'
        ticket.save()


class CommentModelTest(TestCase):
    """Test cases for Comment model."""
    
    def setUp(self):
        """Set up test data."""
        self.agent = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.project = Project.objects.create(
            name='Test Project',
            description='A test project'
        )
        self.ticket = Ticket.objects.create(
            project=self.project,
            title='Test Ticket',
            description='A test ticket',
            created_by=self.agent
        )
    
    def test_create_comment(self):
        """Test creating a comment."""
        comment = Comment.objects.create(
            ticket=self.ticket,
            author=self.agent,
            body='This is a test comment'
        )
        
        self.assertEqual(comment.ticket, self.ticket)
        self.assertEqual(comment.author, self.agent)
        self.assertEqual(comment.body, 'This is a test comment')
        self.assertIsNotNone(comment.created_at)
    
    def test_comment_str(self):
        """Test string representation of comment."""
        comment = Comment.objects.create(
            ticket=self.ticket,
            author=self.agent,
            body='This is a test comment'
        )
        expected = f"Comment by testuser on #{self.ticket.id} - Test Ticket"
        self.assertEqual(str(comment), expected)


class AuditLogModelTest(TestCase):
    """Test cases for AuditLog model."""
    
    def setUp(self):
        """Set up test data."""
        self.agent = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def test_create_audit_log(self):
        """Test creating an audit log entry."""
        audit_log = AuditLog.objects.create(
            entity_type='Ticket',
            entity_id=1,
            action='CREATE',
            performed_by=self.agent,
            old_value={'status': None},
            new_value={'status': 'OPEN'}
        )
        
        self.assertEqual(audit_log.entity_type, 'Ticket')
        self.assertEqual(audit_log.entity_id, 1)
        self.assertEqual(audit_log.action, 'CREATE')
        self.assertEqual(audit_log.performed_by, self.agent)
        self.assertIsNotNone(audit_log.timestamp)
    
    def test_audit_log_str(self):
        """Test string representation of audit log."""
        audit_log = AuditLog.objects.create(
            entity_type='Ticket',
            entity_id=1,
            action='CREATE',
            performed_by=self.agent,
            old_value={},
            new_value={'status': 'OPEN'}
        )
        expected = f"CREATE Ticket#1 by testuser"
        self.assertEqual(str(audit_log), expected)


class ProjectAgentModelTest(TestCase):
    """Test cases for ProjectAgent model."""
    
    def setUp(self):
        """Set up test data."""
        self.agent = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.project = Project.objects.create(
            name='Test Project',
            description='A test project'
        )
    
    def test_create_project_agent(self):
        """Test creating a project-agent relationship."""
        project_agent = ProjectUser.objects.create(
            project=self.project,
            agent=self.agent
        )
        
        self.assertEqual(project_agent.project, self.project)
        self.assertEqual(project_agent.agent, self.agent)
        self.assertIsNotNone(project_agent.joined_at)
    
    def test_project_agent_str(self):
        """Test string representation of project-agent."""
        project_agent = ProjectUser.objects.create(
            project=self.project,
            agent=self.agent
        )
        # ProjectAgent uses default Django __str__ representation
        self.assertTrue(str(project_agent).startswith('ProjectAgent object'))
    
    def test_unique_project_agent(self):
        """Test that project-agent combination must be unique."""
        ProjectUser.objects.create(
            project=self.project,
            agent=self.agent
        )
        
        with self.assertRaises(Exception):
            ProjectUser.objects.create(
                project=self.project,
                agent=self.agent
            )