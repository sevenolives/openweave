from rest_framework import serializers
from .models import User, Project, Ticket, Comment, AuditLog, Workspace, WorkspaceMember, WorkspaceInvite


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    password = serializers.CharField(write_only=True)
    name = serializers.CharField(required=True)
    username = serializers.CharField(required=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'name',
            'agent_type', 'role', 'skills', 'is_active', 'password'
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def create(self, validated_data):
        """Create user with hashed password."""
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
    
    def update(self, instance, validated_data):
        """Update user, handling password separately."""
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        return instance


class UserSimpleSerializer(serializers.ModelSerializer):
    """Simplified user serializer for nested usage."""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'agent_type', 'role']


class WorkspaceSerializer(serializers.ModelSerializer):
    """Serializer for Workspace model."""
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ['id', 'name', 'slug', 'owner', 'member_count', 'created_at']
        read_only_fields = ['id', 'owner', 'created_at']

    def get_member_count(self, obj):
        return obj.members.count()


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """Serializer for WorkspaceMember model."""
    user = UserSimpleSerializer(read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ['id', 'workspace', 'user', 'role', 'joined_at']
        read_only_fields = ['id', 'workspace', 'user', 'joined_at']


class WorkspaceInviteSerializer(serializers.ModelSerializer):
    """Serializer for WorkspaceInvite model."""

    class Meta:
        model = WorkspaceInvite
        fields = ['id', 'workspace', 'token', 'created_by', 'expires_at', 'max_uses', 'use_count', 'is_active', 'created_at']
        read_only_fields = ['id', 'token', 'created_by', 'use_count', 'created_at']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for Project model."""
    agents = UserSimpleSerializer(many=True, read_only=True)
    agent_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'workspace', 'created_at', 'updated_at', 'agents', 'agent_ids']
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        """Create project and assign agents."""
        agent_ids = validated_data.pop('agent_ids', [])
        project = Project.objects.create(**validated_data)
        
        if agent_ids:
            agents = User.objects.filter(id__in=agent_ids)
            project.agents.set(agents)
        
        return project
    
    def update(self, instance, validated_data):
        """Update project and manage agent assignments."""
        agent_ids = validated_data.pop('agent_ids', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if agent_ids is not None:
            agents = User.objects.filter(id__in=agent_ids)
            instance.agents.set(agents)
        
        return instance


class TicketSerializer(serializers.ModelSerializer):
    """Serializer for Ticket model."""
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    created_by_details = UserSimpleSerializer(source='created_by', read_only=True)
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
        """Ensure assigned user belongs to the project."""
        if value and self.instance:
            project = self.instance.project
            if not project.agents.filter(id=value.id).exists():
                raise serializers.ValidationError(
                    "Assigned user must belong to the project."
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
    author_details = UserSimpleSerializer(source='author', read_only=True)
    
    class Meta:
        model = Comment
        fields = [
            'id', 'ticket', 'author', 'author_details', 'body',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['author', 'created_at', 'updated_at']


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model."""
    performed_by_details = UserSimpleSerializer(source='performed_by', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'entity_type', 'entity_id', 'action',
            'performed_by', 'performed_by_details',
            'old_value', 'new_value', 'timestamp'
        ]
        read_only_fields = ['timestamp']

# Auth uses vanilla SimpleJWT TokenObtainPairView (username + password)
