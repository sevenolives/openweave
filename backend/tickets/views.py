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
from .permissions import (
    IsAdminAgent, IsAdminOrReadOnly, IsAdminOrOwner, CanAssignTicket,
    IsProjectMember, CanManageProjectAgents
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
    Admin-only for create/update/delete operations.
    """
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    
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
    
    @action(detail=True, methods=['post'], permission_classes=[CanManageProjectAgents])
    def add_agent(self, request, pk=None):
        """Add an agent to a project. Admin only."""
        project = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not agent_id:
            return Response(
                {'error': 'agent_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            agent = Agent.objects.get(id=agent_id)
            
            # Check if agent is already in project
            if project.agents.filter(id=agent_id).exists():
                return Response(
                    {'error': 'Agent is already a member of this project'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
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
    
    @action(detail=True, methods=['post'], permission_classes=[CanManageProjectAgents])
    def remove_agent(self, request, pk=None):
        """Remove an agent from a project. Admin only."""
        project = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not agent_id:
            return Response(
                {'error': 'agent_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            agent = Agent.objects.get(id=agent_id)
            
            # Check if agent is in project
            if not project.agents.filter(id=agent_id).exists():
                return Response(
                    {'error': 'Agent is not a member of this project'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if agent has assigned tickets in this project
            assigned_tickets = Ticket.objects.filter(
                project=project,
                assigned_to=agent,
                status__in=['OPEN', 'IN_PROGRESS', 'BLOCKED']
            ).count()
            
            if assigned_tickets > 0:
                return Response(
                    {'error': f'Cannot remove agent. They have {assigned_tickets} active ticket(s) assigned.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
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
    Members can create and update own tickets, admins can update any ticket.
    """
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [IsAdminOrOwner]
    
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']
    
    def get_queryset(self):
        """Optimize queryset with select_related."""
        return Ticket.objects.select_related(
            'project', 'assigned_to', 'created_by'
        ).all()
    
    def perform_create(self, serializer):
        """Set created_by to current user and validate project membership."""
        project = serializer.validated_data.get('project')
        
        # Check if user belongs to the project
        if not ProjectAgent.objects.filter(
            project=project,
            agent=self.request.user
        ).exists() and self.request.user.role != 'ADMIN':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be a member of this project to create tickets in it.")
        
        ticket = serializer.save(created_by=self.request.user)
        # Audit log is created by post_save signal
    
    def get_permissions(self):
        """
        Different permissions for different actions.
        """
        if self.action == 'destroy':
            # Only admins can delete tickets
            permission_classes = [IsAdminAgent]
        elif self.action in ['create', 'list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated]
        else:
            # Update operations use IsAdminOrOwner
            permission_classes = [IsAdminOrOwner]
        
        return [permission() for permission in permission_classes]

    def perform_update(self, serializer):
        """Add performer info for audit logging."""
        instance = serializer.instance
        instance._performed_by = self.request.user
        serializer.save()
    
    @action(detail=True, methods=['post'], permission_classes=[CanAssignTicket])
    def assign(self, request, pk=None):
        """
        Assign ticket to an agent.
        Members can self-assign, admins can reassign to anyone.
        Agent must belong to the project.
        """
        ticket = self.get_object()
        agent_id = request.data.get('agent_id')
        
        if not agent_id:
            return Response(
                {'error': 'agent_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            agent_id = int(agent_id)
            agent = Agent.objects.get(id=agent_id)
            
            # Verify agent belongs to project
            if not ticket.project.agents.filter(id=agent_id).exists():
                return Response(
                    {'error': 'Agent must belong to the project'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if member is trying to assign to someone else
            if request.user.role != 'ADMIN' and agent_id != request.user.id:
                return Response(
                    {'error': 'Members can only self-assign tickets'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            old_assigned_to = ticket.assigned_to
            ticket.assigned_to = agent
            ticket._performed_by = request.user
            
            # If ticket was OPEN, move to IN_PROGRESS when assigned
            if ticket.status == 'OPEN':
                ticket.status = 'IN_PROGRESS'
            
            ticket.save()
            
            # Create specific audit log for assignment
            AuditLog.objects.create(
                entity_type='Ticket',
                entity_id=ticket.id,
                action='ASSIGN',
                performed_by=request.user,
                old_value={
                    'assigned_to': old_assigned_to.id if old_assigned_to else None,
                    'status': 'OPEN' if ticket.status == 'IN_PROGRESS' else ticket.status
                },
                new_value={
                    'assigned_to': agent.id,
                    'status': ticket.status
                }
            )
            
            return Response({'success': f'Ticket assigned to {agent.username}'})
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid agent_id'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'], permission_classes=[IsAdminOrOwner])
    def change_status(self, request, pk=None):
        """
        Change ticket status.
        Implements BLOCKED ticket escalation flow.
        """
        ticket = self.get_object()
        new_status = request.data.get('status')
        escalation_reason = request.data.get('escalation_reason', '')
        
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
            
            # Handle BLOCKED ticket escalation
            if new_status == 'BLOCKED':
                self._handle_blocked_escalation(ticket, escalation_reason, request.user)
            
            return Response({'success': f'Status changed from {old_status} to {new_status}'})
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def _handle_blocked_escalation(self, ticket, reason, performed_by):
        """
        Handle escalation when a ticket is marked as BLOCKED.
        Bot agents escalate to humans, humans escalate to admins.
        """
        # Create escalation audit log
        AuditLog.objects.create(
            entity_type='Ticket',
            entity_id=ticket.id,
            action='ESCALATE_BLOCKED',
            performed_by=performed_by,
            old_value={'status': ticket.status, 'reason': None},
            new_value={'status': 'BLOCKED', 'reason': reason}
        )
        
        # Find escalation targets
        escalation_targets = []
        
        if performed_by.agent_type == 'BOT':
            # Bot escalates to human agents in the same project
            escalation_targets = Agent.objects.filter(
                agent_type='HUMAN',
                is_active=True,
                projectagent__project=ticket.project
            ).distinct()
        else:
            # Human escalates to admin agents in the same project
            escalation_targets = Agent.objects.filter(
                role='ADMIN',
                is_active=True,
                projectagent__project=ticket.project
            ).distinct()
        
        # Create notification comments for escalation targets
        escalation_message = f"🚨 ESCALATION: Ticket #{ticket.id} has been blocked by {performed_by.username} ({performed_by.get_agent_type_display()})"
        if reason:
            escalation_message += f"\n\nReason: {reason}"
        escalation_message += f"\n\nTicket: {ticket.title}\nProject: {ticket.project.name}"
        
        # Create a system comment for the escalation
        Comment.objects.create(
            ticket=ticket,
            author=performed_by,
            body=escalation_message
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
    Users can comment on any ticket, but can only edit/delete their own comments.
    """
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [IsAdminOrOwner]
    
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']
    
    def get_queryset(self):
        """Optimize queryset with select_related."""
        return Comment.objects.select_related('ticket', 'author').all()
    
    def perform_create(self, serializer):
        """Set author to current user and validate project membership."""
        ticket = serializer.validated_data.get('ticket')
        
        # Check if user belongs to the ticket's project
        if not ProjectAgent.objects.filter(
            project=ticket.project,
            agent=self.request.user
        ).exists() and self.request.user.role != 'ADMIN':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You must be a member of this project to comment on its tickets.")
        
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