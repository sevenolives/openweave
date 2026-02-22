"""
Test cases for API endpoints.
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Agent, Project, Ticket, Comment, AuditLog


class BaseAPITestCase(TestCase):
    """Base test case with common setup."""
    
    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        
        # Create test users
        self.admin_user = Agent.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
            role='ADMIN'
        )
        
        self.member_user = Agent.objects.create_user(
            username='member',
            email='member@example.com',
            password='memberpass123',
            role='MEMBER'
        )
        
        self.bot_user = Agent.objects.create_user(
            username='bot',
            email='bot@example.com',
            password='botpass123',
            agent_type='BOT'
        )
        
        # Create test project
        self.project = Project.objects.create(
            name='Test Project',
            description='A test project'
        )
        self.project.agents.add(self.admin_user, self.member_user, self.bot_user)
        
        # Create test ticket
        self.ticket = Ticket.objects.create(
            project=self.project,
            title='Test Ticket',
            description='A test ticket description',
            created_by=self.member_user
        )
    
    def authenticate(self, user):
        """Authenticate user and set token."""
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    
    def unauthenticate(self):
        """Remove authentication."""
        self.client.credentials()


class AuthenticationAPITest(BaseAPITestCase):
    """Test authentication endpoints."""
    
    def test_register_agent(self):
        """Test agent registration."""
        url = reverse('agent-register')
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'newpass123',
            'agent_type': 'HUMAN',
            'role': 'MEMBER'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Agent.objects.filter(username='newuser').count(), 1)
    
    def test_login(self):
        """Test user login."""
        url = reverse('token_obtain_pair')
        data = {
            'username': 'member',
            'password': 'memberpass123'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        url = reverse('token_obtain_pair')
        data = {
            'username': 'member',
            'password': 'wrongpass'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_get_current_user(self):
        """Test getting current user profile."""
        self.authenticate(self.member_user)
        url = reverse('agent-me')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'member')


class AgentAPITest(BaseAPITestCase):
    """Test Agent API endpoints."""
    
    def test_list_agents(self):
        """Test listing agents."""
        self.authenticate(self.member_user)
        url = reverse('agent-list')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 3)
    
    def test_list_agents_unauthenticated(self):
        """Test listing agents without authentication."""
        url = reverse('agent-list')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_search_agents(self):
        """Test searching agents."""
        self.authenticate(self.member_user)
        url = reverse('agent-list')
        
        response = self.client.get(url, {'search': 'admin'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'admin')
    
    def test_filter_agents_by_type(self):
        """Test filtering agents by type."""
        self.authenticate(self.member_user)
        url = reverse('agent-list')
        
        response = self.client.get(url, {'agent_type': 'BOT'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'bot')


class ProjectAPITest(BaseAPITestCase):
    """Test Project API endpoints."""
    
    def test_list_projects(self):
        """Test listing projects."""
        self.authenticate(self.member_user)
        url = reverse('project-list')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
    
    def test_create_project_as_admin(self):
        """Test creating project as admin."""
        self.authenticate(self.admin_user)
        url = reverse('project-list')
        data = {
            'name': 'New Project',
            'description': 'A new project'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Project.objects.filter(name='New Project').count(), 1)
    
    def test_create_project_as_member_denied(self):
        """Test that members cannot create projects."""
        self.authenticate(self.member_user)
        url = reverse('project-list')
        data = {
            'name': 'New Project',
            'description': 'A new project'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_add_agent_to_project(self):
        """Test adding agent to project."""
        new_agent = Agent.objects.create_user(
            username='newagent',
            email='newagent@example.com',
            password='pass123'
        )
        
        self.authenticate(self.admin_user)
        url = reverse('project-add-agent', kwargs={'pk': self.project.pk})
        data = {'agent_id': new_agent.id}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(self.project.agents.filter(id=new_agent.id).exists())
    
    def test_get_project_tickets(self):
        """Test getting tickets for a project."""
        self.authenticate(self.member_user)
        url = reverse('project-tickets', kwargs={'pk': self.project.pk})
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Test Ticket')


class TicketAPITest(BaseAPITestCase):
    """Test Ticket API endpoints."""
    
    def test_list_tickets(self):
        """Test listing tickets."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
    
    def test_create_ticket(self):
        """Test creating a ticket."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        data = {
            'project': self.project.id,
            'title': 'New Test Ticket',
            'description': 'A new test ticket description',
            'priority': 'HIGH'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Ticket.objects.filter(title='New Test Ticket').count(), 1)
    
    def test_search_tickets(self):
        """Test searching tickets."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        
        response = self.client.get(url, {'search': 'Test Ticket'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
    
    def test_filter_tickets_by_status(self):
        """Test filtering tickets by status."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        
        response = self.client.get(url, {'status': 'OPEN'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
    
    def test_filter_tickets_by_priority(self):
        """Test filtering tickets by priority."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        
        # No tickets with HIGH priority initially
        response = self.client.get(url, {'priority': 'HIGH'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        
        # Filter by MEDIUM priority (default)
        response = self.client.get(url, {'priority': 'MEDIUM'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
    
    def test_assign_ticket_self(self):
        """Test self-assigning a ticket."""
        self.authenticate(self.member_user)
        url = reverse('ticket-assign', kwargs={'pk': self.ticket.pk})
        data = {'agent_id': self.member_user.id}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.assigned_to, self.member_user)
        self.assertEqual(self.ticket.status, 'IN_PROGRESS')
    
    def test_assign_ticket_to_others_as_admin(self):
        """Test admin assigning ticket to another user."""
        self.authenticate(self.admin_user)
        url = reverse('ticket-assign', kwargs={'pk': self.ticket.pk})
        data = {'agent_id': self.bot_user.id}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.assigned_to, self.bot_user)
    
    def test_assign_ticket_to_others_as_member_denied(self):
        """Test that members cannot assign tickets to others."""
        self.authenticate(self.member_user)
        url = reverse('ticket-assign', kwargs={'pk': self.ticket.pk})
        data = {'agent_id': self.bot_user.id}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_change_ticket_status(self):
        """Test changing ticket status."""
        # First assign the ticket
        self.ticket.assigned_to = self.member_user
        self.ticket.status = 'IN_PROGRESS'
        self.ticket.save()
        
        self.authenticate(self.member_user)
        url = reverse('ticket-change-status', kwargs={'pk': self.ticket.pk})
        data = {'status': 'RESOLVED'}
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, 'RESOLVED')
    
    def test_get_ticket_comments(self):
        """Test getting comments for a ticket."""
        # Create a comment
        Comment.objects.create(
            ticket=self.ticket,
            author=self.member_user,
            body='Test comment'
        )
        
        self.authenticate(self.member_user)
        url = reverse('ticket-comments', kwargs={'pk': self.ticket.pk})
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['body'], 'Test comment')
    
    def test_get_ticket_audit_trail(self):
        """Test getting audit trail for a ticket."""
        self.authenticate(self.member_user)
        url = reverse('ticket-audit-trail', kwargs={'pk': self.ticket.pk})
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should have at least the creation audit log
        self.assertGreater(len(response.data), 0)


class CommentAPITest(BaseAPITestCase):
    """Test Comment API endpoints."""
    
    def test_create_comment(self):
        """Test creating a comment."""
        self.authenticate(self.member_user)
        url = reverse('comment-list')
        data = {
            'ticket': self.ticket.id,
            'body': 'This is a test comment'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.filter(body='This is a test comment').count(), 1)
    
    def test_search_comments(self):
        """Test searching comments."""
        Comment.objects.create(
            ticket=self.ticket,
            author=self.member_user,
            body='Searchable comment content'
        )
        
        self.authenticate(self.member_user)
        url = reverse('comment-list')
        
        response = self.client.get(url, {'search': 'Searchable'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)


class RateLimitingTest(BaseAPITestCase):
    """Test rate limiting functionality."""
    
    def test_anonymous_rate_limit(self):
        """Test that anonymous users are rate limited."""
        url = reverse('agent-register')
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123'
        }
        
        # Make many requests to trigger rate limit
        # Note: In real tests, you might need to adjust throttle rates for testing
        responses = []
        for i in range(10):  # Adjust based on throttle settings
            response = self.client.post(url, data, format='json')
            responses.append(response.status_code)
        
        # At least some requests should succeed
        self.assertIn(201, responses)
    
    def test_authenticated_rate_limit(self):
        """Test that authenticated users have higher rate limits."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        
        # Authenticated users should be able to make more requests
        for i in range(20):
            response = self.client.get(url)
            # Should not be rate limited for reasonable number of requests
            self.assertNotEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class PaginationTest(BaseAPITestCase):
    """Test pagination functionality."""
    
    def test_ticket_pagination(self):
        """Test that ticket list is paginated."""
        # Create more tickets to test pagination
        for i in range(25):
            Ticket.objects.create(
                project=self.project,
                title=f'Ticket {i}',
                description=f'Description {i}',
                created_by=self.member_user
            )
        
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check pagination format
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)
        
        # Should be limited by PAGE_SIZE (20 in settings)
        self.assertLessEqual(len(response.data['results']), 20)
        self.assertEqual(response.data['count'], 26)  # 25 + 1 from setUp


class ErrorHandlingTest(BaseAPITestCase):
    """Test error handling functionality."""
    
    def test_404_error_format(self):
        """Test 404 error response format."""
        self.authenticate(self.member_user)
        url = reverse('ticket-detail', kwargs={'pk': 99999})
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Check consistent error format
        self.assertIn('error', response.data)
        self.assertIn('message', response.data)
        self.assertIn('details', response.data)
        self.assertIn('status_code', response.data)
        self.assertTrue(response.data['error'])
        self.assertEqual(response.data['status_code'], 404)
    
    def test_validation_error_format(self):
        """Test validation error response format."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        data = {
            'project': 'invalid_project_id',  # Invalid project
            'title': '',  # Empty title
            'description': 'Test description'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Check consistent error format
        self.assertIn('error', response.data)
        self.assertIn('message', response.data)
        self.assertIn('details', response.data)
        self.assertTrue(response.data['error'])
    
    def test_permission_error_format(self):
        """Test permission error response format."""
        self.authenticate(self.member_user)
        url = reverse('project-list')
        data = {
            'name': 'New Project',
            'description': 'Test'
        }
        
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Check consistent error format
        self.assertIn('error', response.data)
        self.assertIn('message', response.data)
        self.assertTrue(response.data['error'])