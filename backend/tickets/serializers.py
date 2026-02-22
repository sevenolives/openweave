from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Agent, Project, Ticket, Comment, AuditLog, ProjectAgent


class AgentSerializer(serializers.ModelSerializer):
    """Serializer for Agent model."""
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = Agent
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'agent_type', 'role', 'skills', 'is_active', 'password'
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def create(self, validated_data):
        """Create agent with hashed password."""
        password = validated_data.pop('password')
        agent = Agent(**validated_data)
        agent.set_password(password)
        agent.save()
        return agent
    
    def update(self, instance, validated_data):
        """Update agent, handling password separately."""
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        return instance


class AgentSimpleSerializer(serializers.ModelSerializer):
    """Simplified agent serializer for nested usage."""
    class Meta:
        model = Agent
        fields = ['id', 'username', 'email', 'agent_type', 'role']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for Project model."""
    agents = AgentSimpleSerializer(many=True, read_only=True)
    agent_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'created_at', 'updated_at', 'agents', 'agent_ids']
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        """Create project and assign agents."""
        agent_ids = validated_data.pop('agent_ids', [])
        project = Project.objects.create(**validated_data)
        
        if agent_ids:
            agents = Agent.objects.filter(id__in=agent_ids)
            project.agents.set(agents)
        
        return project
    
    def update(self, instance, validated_data):
        """Update project and manage agent assignments."""
        agent_ids = validated_data.pop('agent_ids', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if agent_ids is not None:
            agents = Agent.objects.filter(id__in=agent_ids)
            instance.agents.set(agents)
        
        return instance


class TicketSerializer(serializers.ModelSerializer):
    """Serializer for Ticket model."""
    assigned_to_details = AgentSimpleSerializer(source='assigned_to', read_only=True)
    created_by_details = AgentSimpleSerializer(source='created_by', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    
    class Meta:
        model = Ticket
        fields = [
            'id', 'project', 'project_name', 'title', 'description',
            'status', 'priority', 'assigned_to', 'assigned_to_details',
            'created_by', 'created_by_details', 'created_at', 'updated_at',
            'resolved_at', 'closed_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'resolved_at', 'closed_at']
    
    def validate_assigned_to(self, value):
        """Ensure assigned agent belongs to the project."""
        if value and self.instance:
            project = self.instance.project
            if not project.agents.filter(id=value.id).exists():
                raise serializers.ValidationError(
                    "Assigned agent must belong to the project."
                )
        return value
    
    def validate(self, data):
        """Additional validation for status transitions."""
        if self.instance:
            # Status transition validation is handled in the model's clean method
            pass
        return data


class CommentSerializer(serializers.ModelSerializer):
    """Serializer for Comment model."""
    author_details = AgentSimpleSerializer(source='author', read_only=True)
    
    class Meta:
        model = Comment
        fields = [
            'id', 'ticket', 'author', 'author_details', 'body',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model."""
    performed_by_details = AgentSimpleSerializer(source='performed_by', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'entity_type', 'entity_id', 'action',
            'performed_by', 'performed_by_details',
            'old_value', 'new_value', 'timestamp'
        ]
        read_only_fields = ['timestamp']


class CustomTokenObtainSerializer(serializers.Serializer):
    """
    Custom token obtain serializer that supports both email and username login.
    Following best practices from BEST_PRACTICES.md.
    """
    email = serializers.CharField()
    password = serializers.CharField(style={'input_type': 'password'})
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            # Try to find user by email or username
            user = None
            try:
                # First try by email
                user = Agent.objects.get(email=email)
            except Agent.DoesNotExist:
                # Then try by username
                try:
                    user = Agent.objects.get(username=email)
                except Agent.DoesNotExist:
                    pass
            
            if user and user.check_password(password):
                if user.is_active:
                    refresh = RefreshToken.for_user(user)
                    return {
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                        'user': AgentSerializer(user).data
                    }
                else:
                    raise serializers.ValidationError('User account is disabled.')
            else:
                raise serializers.ValidationError('Invalid email/username or password.')
        else:
            raise serializers.ValidationError('Must include email and password.')


class ProjectAgentSerializer(serializers.ModelSerializer):
    """Serializer for ProjectAgent model."""
    agent_details = AgentSimpleSerializer(source='agent', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    
    class Meta:
        model = ProjectAgent
        fields = ['id', 'project', 'project_name', 'agent', 'agent_details', 'joined_at']
        read_only_fields = ['joined_at']