from rest_framework import serializers
from .models import User, Project, Ticket, Comment, AuditLog, Workspace, WorkspaceMember, WorkspaceInvite


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    password = serializers.CharField(write_only=True, help_text="Password (write-only, required for human users).")
    name = serializers.CharField(required=True, help_text="Display name.")
    username = serializers.CharField(required=True, help_text="Unique username.")

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'name',
            'user_type', 'role', 'skills', 'is_active', 'password'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'help_text': 'Email address.'},
            'user_type': {'help_text': 'HUMAN or BOT.'},
            'role': {'help_text': 'ADMIN or MEMBER.'},
            'skills': {'help_text': 'List of skill tags (JSON array).'},
            'is_active': {'help_text': 'Whether the user account is active.'},
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
        fields = ['id', 'username', 'email', 'name', 'user_type', 'role']


class WorkspaceSerializer(serializers.ModelSerializer):
    """Serializer for Workspace model."""
    member_count = serializers.SerializerMethodField(help_text="Number of members in the workspace (including owner).")
    owner_details = UserSimpleSerializer(source='owner', read_only=True)

    class Meta:
        model = Workspace
        fields = ['id', 'name', 'slug', 'owner', 'owner_details', 'member_count', 'created_at']
        read_only_fields = ['id', 'owner', 'owner_details', 'created_at']
        extra_kwargs = {
            'name': {'help_text': 'Workspace display name.'},
            'slug': {'help_text': 'URL-friendly identifier.'},
            'owner': {'help_text': 'User ID of the workspace owner.'},
        }

    def get_member_count(self, obj):
        # Count members excluding owner (owner is on workspace record, not members table)
        return obj.members.exclude(user=obj.owner).count() + 1  # +1 for owner


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    """Serializer for WorkspaceMember model."""
    user = UserSimpleSerializer(read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ['id', 'workspace', 'user', 'role', 'joined_at']
        read_only_fields = ['id', 'workspace', 'user', 'joined_at']
        extra_kwargs = {
            'role': {'help_text': 'ADMIN or MEMBER.'},
            'workspace': {'help_text': 'Workspace ID.'},
        }


class WorkspaceInviteSerializer(serializers.ModelSerializer):
    """Serializer for WorkspaceInvite model."""

    class Meta:
        model = WorkspaceInvite
        fields = ['id', 'workspace', 'token', 'created_by', 'expires_at', 'max_uses', 'use_count', 'is_active', 'created_at']
        read_only_fields = ['id', 'token', 'created_by', 'use_count', 'created_at']
        extra_kwargs = {
            'workspace': {'help_text': 'Workspace ID to create invite for.'},
            'token': {'help_text': 'Auto-generated UUID invite token.'},
            'expires_at': {'help_text': 'Optional expiration datetime (ISO 8601).'},
            'max_uses': {'help_text': 'Optional maximum number of uses. Null = unlimited.'},
            'use_count': {'help_text': 'Number of times this invite has been used.'},
            'is_active': {'help_text': 'Whether the invite is currently active.'},
        }


class JoinRequestSerializer(serializers.Serializer):
    """Request serializer for the unified join endpoint."""
    workspace_invite_token = serializers.UUIDField(required=False, help_text="The invite token UUID. Required for Cases 2-4.")
    username = serializers.CharField(required=False, help_text="Username for new account. Required for Cases 1-3.")
    name = serializers.CharField(required=False, help_text="Display name for new account. Required for Cases 1-3.")
    password = serializers.CharField(required=False, write_only=True, help_text="Password for human users (Cases 1-2). Omit for bot users (Case 3).")


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for Project model."""
    agents = UserSimpleSerializer(many=True, read_only=True)
    agent_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="List of user IDs to assign as project agents.",
    )

    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'workspace', 'created_at', 'updated_at', 'agents', 'agent_ids']
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'name': {'help_text': 'Project name.'},
            'description': {'help_text': 'Project description.'},
            'workspace': {'help_text': 'Workspace ID this project belongs to.'},
        }

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
    project_name = serializers.CharField(source='project.name', read_only=True, help_text="Name of the project.")

    class Meta:
        model = Ticket
        fields = [
            'id', 'project', 'project_name', 'title', 'description',
            'status', 'priority', 'ticket_type', 'approval', 'assigned_to', 'assigned_to_details',
            'created_by', 'created_by_details', 'created_at', 'updated_at',
            'resolved_at', 'closed_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'resolved_at', 'closed_at']
        extra_kwargs = {
            'project': {'help_text': 'Project ID.'},
            'title': {'help_text': 'Ticket title.'},
            'description': {'help_text': 'Detailed description of the issue.'},
            'status': {'help_text': 'OPEN, IN_PROGRESS, RESOLVED, CLOSED, or BLOCKED.'},
            'priority': {'help_text': 'LOW, MEDIUM, HIGH, or CRITICAL.'},
            'assigned_to': {'help_text': 'User ID of the assignee (must be a project member).'},
            'created_by': {'help_text': 'Auto-set to the authenticated user.'},
        }

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
        extra_kwargs = {
            'ticket': {'help_text': 'Ticket ID to comment on.'},
            'body': {'help_text': 'Comment text content.'},
            'author': {'help_text': 'Author user ID (auto-set).'},
        }


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
        extra_kwargs = {
            'entity_type': {'help_text': 'Type of entity (Ticket, Project, etc.).'},
            'entity_id': {'help_text': 'ID of the affected entity.'},
            'action': {'help_text': 'CREATE, UPDATE, DELETE, or STATUS_CHANGE.'},
            'performed_by': {'help_text': 'User ID who performed the action.'},
            'old_value': {'help_text': 'Previous values (JSON object).'},
            'new_value': {'help_text': 'New values (JSON object).'},
        }

# Auth uses vanilla SimpleJWT TokenObtainPairView (username + password)
