from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Q
from .models import Agent, Project, Ticket, Comment, AuditLog, ProjectAgent
from .serializers import (
    AgentSerializer, ProjectSerializer, TicketSerializer, 
    CommentSerializer, AuditLogSerializer, CustomTokenObtainSerializer,
    ProjectAgentSerializer
)


class CustomTokenObtainView(APIView):
    """
    Custom token obtain view that supports both email and username login.
    """
    permission_classes = []
    
    def post(self, request):
        serializer = CustomTokenObtainSerializer(data=request.data)
        if serializer.is_valid():
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AgentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Agent (User) management.
    Includes registration and user management endpoints.
    """
    queryset = Agent.objects.all()
    serializer_class = AgentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    # Include all necessary HTTP methods for custom actions
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']
    
    def get_permissions(self):
        """
        Allow unauthenticated access to registration.
        """
        if self.action == 'create':
            permission_classes = []
        else:
            permission_classes = [permissions.IsAuthenticated]
        
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        """Agent registration endpoint."""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            agent = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Project management.
    """
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']
    
    def get_queryset(self):
        """Optimize queryset with prefetch_related."""
        return Project.objects.prefetch_related('agents').all()
    
    def perform_create(self, serializer):
        """Create audit log entry for project creation."""
        with transaction.atomic():
            project = serializer.save()
            AuditLog.objects.create(
                entity_type='Project',
                entity_id=project.id,
                action='CREATE',
                performed_by=self.request.user,
                old_value=None,
                new_value={'name': project.name, 'description': project.description}
            )
    
    @action(detail=True, methods=['get'])
    def tickets(self, request, pk=None):
        """Get all tickets for a project."""
        project = self.get_object()
        tickets = project.tickets.select_related('assigned_to', 'created_by').all()
        
        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            tickets = tickets.filter(status=status_filter)
        
        # Filter by assigned agent if provided
        assigned_to = request.query_params.get('assigned_to')
        if assigned_to:
            tickets = tickets.filter(assigned_to_id=assigned_to)
        
        serializer = TicketSerializer(tickets, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_agent(self, request, pk=None):
        """Add an agent to a project."""
        project = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not agent_id:
            return Response(
                {'error': 'agent_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            agent = Agent.objects.get(id=agent_id)
            project.agents.add(agent)
            
            # Create audit log entry
            AuditLog.objects.create(
                entity_type='Project',
                entity_id=project.id,
                action='ADD_AGENT',
                performed_by=request.user,
                old_value=None,
                new_value={'agent_id': agent_id, 'agent_username': agent.username}
            )
            
            return Response({'success': 'Agent added to project'})
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def remove_agent(self, request, pk=None):
        """Remove an agent from a project."""
        project = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not agent_id:
            return Response(
                {'error': 'agent_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            agent = Agent.objects.get(id=agent_id)
            project.agents.remove(agent)
            
            # Create audit log entry
            AuditLog.objects.create(
                entity_type='Project',
                entity_id=project.id,
                action='REMOVE_AGENT',
                performed_by=request.user,
                old_value={'agent_id': agent_id, 'agent_username': agent.username},
                new_value=None
            )
            
            return Response({'success': 'Agent removed from project'})
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class TicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Ticket management.
    """
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']
    
    def get_queryset(self):
        """Optimize queryset with select_related."""
        return Ticket.objects.select_related(
            'project', 'assigned_to', 'created_by'
        ).all()
    
    def perform_create(self, serializer):
        """Set created_by to current user."""
        ticket = serializer.save(created_by=self.request.user)
        # Audit log is created by post_save signal
    
    def perform_update(self, serializer):
        """Add performer info for audit logging."""
        instance = serializer.instance
        instance._performed_by = self.request.user
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign ticket to an agent."""
        ticket = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not agent_id:
            return Response(
                {'error': 'agent_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            agent = Agent.objects.get(id=agent_id)
            
            # Verify agent belongs to project
            if not ticket.project.agents.filter(id=agent_id).exists():
                return Response(
                    {'error': 'Agent must belong to the project'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            old_assigned_to = ticket.assigned_to
            ticket.assigned_to = agent
            ticket._performed_by = request.user
            ticket.save()
            
            # Create specific audit log for assignment
            AuditLog.objects.create(
                entity_type='Ticket',
                entity_id=ticket.id,
                action='ASSIGN',
                performed_by=request.user,
                old_value={'assigned_to': old_assigned_to.id if old_assigned_to else None},
                new_value={'assigned_to': agent.id}
            )
            
            return Response({'success': f'Ticket assigned to {agent.username}'})
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        """Change ticket status."""
        ticket = self.get_object()
        new_status = request.data.get('status')
        
        if not new_status:
            return Response(
                {'error': 'status is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = ticket.status
        ticket.status = new_status
        ticket._performed_by = request.user
        
        try:
            ticket.save()  # This will trigger validation
            return Response({'success': f'Status changed from {old_status} to {new_status}'})
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Get all comments for a ticket."""
        ticket = self.get_object()
        comments = ticket.comments.select_related('author').all()
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def audit_trail(self, request, pk=None):
        """Get audit trail for a ticket."""
        ticket = self.get_object()
        audit_logs = AuditLog.objects.filter(
            entity_type='Ticket',
            entity_id=ticket.id
        ).select_related('performed_by')
        
        serializer = AuditLogSerializer(audit_logs, many=True)
        return Response(serializer.data)


class CommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Comment management.
    """
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']
    
    def get_queryset(self):
        """Optimize queryset with select_related."""
        return Comment.objects.select_related('ticket', 'author').all()
    
    def perform_create(self, serializer):
        """Set author to current user."""
        serializer.save(author=self.request.user)
        # Audit log is created by post_save signal


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for AuditLog (read-only).
    """
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Optimize queryset with select_related."""
        queryset = AuditLog.objects.select_related('performed_by').all()
        
        # Filter by entity type if provided
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        
        # Filter by entity id if provided
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        
        return queryset


class ProjectAgentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ProjectAgent management.
    """
    queryset = ProjectAgent.objects.all()
    serializer_class = ProjectAgentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    http_method_names = ['get', 'post', 'delete']
    
    def get_queryset(self):
        """Optimize queryset with select_related."""
        return ProjectAgent.objects.select_related('project', 'agent').all()