"""
Test cases for API endpoints.
Updated to match the workspace-scoped API with slug-based lookups.
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Project, Ticket, Comment, AuditLog, Workspace, WorkspaceMember


class BaseAPITestCase(TestCase):
    """Base test case with common setup including workspace."""

    def setUp(self):
        """Set up test data with workspace context."""
        self.client = APIClient()

        # Create workspace owner (acts as admin)
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
        )

        # Create workspace owned by admin
        self.workspace = Workspace.objects.create(
            name='Test Workspace',
            slug='test-ws',
            owner=self.admin_user,
        )

        # Create member user
        self.member_user = User.objects.create_user(
            username='member',
            email='member@example.com',
            password='memberpass123',
        )
        WorkspaceMember.objects.create(workspace=self.workspace, user=self.member_user)

        # Create bot user
        self.bot_user = User.objects.create_user(
            username='bot',
            email='bot@example.com',
            password='botpass123',
            user_type='BOT',
        )
        WorkspaceMember.objects.create(workspace=self.workspace, user=self.bot_user)

        # Create test project in the workspace
        self.project = Project.objects.create(
            name='Test Project',
            slug='TP',
            description='A test project',
            workspace=self.workspace,
        )
        self.project.agents.add(self.admin_user, self.member_user, self.bot_user)

        # Create test ticket
        self.ticket = Ticket.objects.create(
            project=self.project,
            title='Test Ticket',
            description='A test ticket description',
            created_by=self.member_user,
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

    def test_register_user(self):
        """Test user registration via join endpoint."""
        url = reverse('join')
        data = {
            'name': 'New User',
            'email': 'newuser@example.com',
            'password': 'newpass123',
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(email='newuser@example.com').count(), 1)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login(self):
        """Test user login."""
        url = reverse('token_obtain_pair')
        data = {
            'username': 'member',
            'password': 'memberpass123',
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
            'password': 'wrongpass',
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_current_user(self):
        """Test getting current user profile."""
        self.authenticate(self.member_user)
        url = reverse('user-me')

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'member')


class UserAPITest(BaseAPITestCase):
    """Test User API endpoints."""

    def test_list_users(self):
        """Test listing users with workspace slug filter."""
        self.authenticate(self.member_user)
        url = reverse('user-list')

        response = self.client.get(url, {'workspace': self.workspace.slug})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data['count'], 1)

    def test_list_users_unauthenticated(self):
        """Test listing users without authentication."""
        url = reverse('user-list')

        response = self.client.get(url, {'workspace': self.workspace.slug})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_users_requires_workspace(self):
        """Test that listing users requires workspace or project filter."""
        self.authenticate(self.member_user)
        url = reverse('user-list')

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_users(self):
        """Test searching users."""
        self.authenticate(self.member_user)
        url = reverse('user-list')

        response = self.client.get(url, {'workspace': self.workspace.slug, 'search': 'admin'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data['count'], 1)
        usernames = [u['username'] for u in response.data['results']]
        self.assertIn('admin', usernames)

    def test_filter_users_by_type(self):
        """Test filtering users by type."""
        self.authenticate(self.member_user)
        url = reverse('user-list')

        response = self.client.get(url, {'workspace': self.workspace.slug, 'user_type': 'BOT'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data['count'], 1)
        for u in response.data['results']:
            self.assertEqual(u['user_type'], 'BOT')


class ProjectAPITest(BaseAPITestCase):
    """Test Project API endpoints."""

    def test_list_projects(self):
        """Test listing projects with workspace slug filter."""
        self.authenticate(self.member_user)
        url = reverse('project-list')

        response = self.client.get(url, {'workspace': self.workspace.slug})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_create_project_as_admin(self):
        """Test creating project as workspace owner (admin)."""
        self.authenticate(self.admin_user)
        url = reverse('project-list')
        data = {
            'name': 'New Project',
            'description': 'A new project',
            'workspace': self.workspace.slug,
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
            'description': 'A new project',
            'workspace': self.workspace.slug,
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_project_by_slug(self):
        """Test retrieving a project by slug."""
        self.authenticate(self.member_user)
        url = reverse('project-detail', kwargs={'slug': self.project.slug})

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Test Project')
        self.assertEqual(response.data['workspace'], self.workspace.slug)


class TicketAPITest(BaseAPITestCase):
    """Test Ticket API endpoints."""

    def test_list_tickets(self):
        """Test listing tickets with workspace slug filter."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')

        response = self.client.get(url, {'workspace': self.workspace.slug})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_list_tickets_requires_workspace_or_project(self):
        """Test that listing tickets requires workspace or project filter."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_ticket(self):
        """Test creating a ticket with project slug."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')
        data = {
            'project': self.project.slug,
            'title': 'New Test Ticket',
            'description': 'A new test ticket description',
            'priority': 'HIGH',
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Ticket.objects.filter(title='New Test Ticket').count(), 1)
        # Verify project is returned as slug
        self.assertEqual(response.data['project'], self.project.slug)

    def test_search_tickets(self):
        """Test searching tickets."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')

        response = self.client.get(url, {'workspace': self.workspace.slug, 'search': 'Test Ticket'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_filter_tickets_by_status(self):
        """Test filtering tickets by status."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')

        response = self.client.get(url, {'workspace': self.workspace.slug, 'status': 'OPEN'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_filter_tickets_by_priority(self):
        """Test filtering tickets by priority."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')

        # No tickets with HIGH priority initially
        response = self.client.get(url, {'workspace': self.workspace.slug, 'priority': 'HIGH'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)

        # Filter by MEDIUM priority (default)
        response = self.client.get(url, {'workspace': self.workspace.slug, 'priority': 'MEDIUM'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_get_ticket_by_slug(self):
        """Test getting a single ticket by ticket slug (e.g., TP-1)."""
        self.authenticate(self.member_user)
        ticket_slug = self.ticket.ticket_slug  # e.g., TP-1
        url = reverse('ticket-detail', kwargs={'pk': ticket_slug})

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Ticket')
        self.assertEqual(response.data['ticket_slug'], ticket_slug)

    def test_update_ticket_as_admin(self):
        """Test updating a ticket as workspace owner using ticket slug."""
        self.authenticate(self.admin_user)
        ticket_slug = self.ticket.ticket_slug
        url = reverse('ticket-detail', kwargs={'pk': ticket_slug})

        response = self.client.patch(url, {'title': 'Updated Title'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, 'Updated Title')


class CommentAPITest(BaseAPITestCase):
    """Test Comment API endpoints."""

    def test_create_comment(self):
        """Test creating a comment."""
        self.authenticate(self.member_user)
        url = reverse('comment-list')
        data = {
            'ticket': self.ticket.id,
            'body': 'This is a test comment',
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.filter(body='This is a test comment').count(), 1)

    def test_search_comments(self):
        """Test searching comments."""
        Comment.objects.create(
            ticket=self.ticket,
            author=self.member_user,
            body='Searchable comment content',
        )

        self.authenticate(self.member_user)
        url = reverse('comment-list')

        response = self.client.get(url, {'search': 'Searchable'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)


class WorkspaceAPITest(BaseAPITestCase):
    """Test Workspace API endpoints."""

    def test_retrieve_workspace_by_slug(self):
        """Test retrieving a workspace by slug."""
        self.authenticate(self.admin_user)
        url = reverse('workspace-detail', kwargs={'slug': self.workspace.slug})

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['slug'], 'test-ws')

    def test_update_workspace_by_slug(self):
        """Test updating a workspace by slug."""
        self.authenticate(self.admin_user)
        url = reverse('workspace-detail', kwargs={'slug': self.workspace.slug})

        response = self.client.patch(url, {'name': 'Updated Name'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.workspace.refresh_from_db()
        self.assertEqual(self.workspace.name, 'Updated Name')


class PaginationTest(BaseAPITestCase):
    """Test pagination functionality."""

    def test_ticket_pagination(self):
        """Test that ticket list is paginated."""
        for i in range(25):
            Ticket.objects.create(
                project=self.project,
                title=f'Ticket {i}',
                description=f'Description {i}',
                created_by=self.member_user,
            )

        self.authenticate(self.member_user)
        url = reverse('ticket-list')

        response = self.client.get(url, {'workspace': self.workspace.slug})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check pagination format
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)

        # Should be limited by PAGE_SIZE
        self.assertLessEqual(len(response.data['results']), 20)
        self.assertEqual(response.data['count'], 26)  # 25 + 1 from setUp


class RateLimitingTest(BaseAPITestCase):
    """Test rate limiting functionality."""

    def test_authenticated_rate_limit(self):
        """Test that authenticated users have higher rate limits."""
        self.authenticate(self.member_user)
        url = reverse('ticket-list')

        # Authenticated users should be able to make reasonable requests
        for i in range(10):
            response = self.client.get(url, {'workspace': self.workspace.slug})
            self.assertNotEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
