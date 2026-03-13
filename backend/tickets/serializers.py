from rest_framework import serializers
from .permissions import is_admin_or_owner
from .models import (
    User, Project, Ticket, Comment, AuditLog, Workspace, WorkspaceMember,
    WorkspaceInvite, TicketAttachment, StatusDefinition, StatusTransition, ProjectAgent,
    BlogPost,
)


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    password = serializers.CharField(write_only=True, help_text="Password (write-only, required for human users).")
    name = serializers.CharField(required=True, help_text="Display name.")
    username = serializers.CharField(required=True, help_text="Unique username.")

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'name',
            'user_type', 'skills', 'description', 'is_active', 'password'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'help_text': 'Email address.'},
            'user_type': {'help_text': 'HUMAN or BOT.'},
            'skills': {'help_text': 'List of skill tags (JSON array).'},
            'description': {'help_text': 'What this user/bot can do.'},
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
        fields = ['id', 'username', 'email', 'name', 'user_type', 'description']


class ProjectAgentSerializer(serializers.ModelSerializer):
    """Serializer for ProjectAgent with role."""
    user = UserSimpleSerializer(source='agent', read_only=True)

    class Meta:
        model = ProjectAgent
        fields = ['id', 'project', 'user', 'role', 'can_approve_tickets', 'joined_at']
        read_only_fields = ['id', 'project', 'user', 'joined_at']


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
        fields = ['id', 'workspace', 'user', 'joined_at']
        read_only_fields = ['id', 'workspace', 'user', 'joined_at']
        extra_kwargs = {
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
    agent_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="List of user IDs to assign as project agents.",
    )

    class Meta:
        model = Project
        fields = ['id', 'name', 'slug', 'description', 'workspace', 'created_at', 'updated_at', 'agent_ids']
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
        # Prevent slug changes if project has tickets
        if 'slug' in validated_data and validated_data['slug'] != instance.slug:
            if instance.tickets.exists():
                raise serializers.ValidationError({'slug': 'Cannot change slug after tickets have been created.'})
        agent_ids = validated_data.pop('agent_ids', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if agent_ids is not None:
            agents = User.objects.filter(id__in=agent_ids)
            instance.agents.set(agents)
        return instance


class TicketAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for TicketAttachment model."""
    uploaded_by_details = UserSimpleSerializer(source='uploaded_by', read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = TicketAttachment
        fields = ['id', 'ticket', 'file', 'filename', 'url', 'uploaded_by', 'uploaded_by_details', 'created_at']
        read_only_fields = ['uploaded_by', 'filename', 'created_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None


class TicketSerializer(serializers.ModelSerializer):
    """Serializer for Ticket model."""
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    created_by_details = UserSimpleSerializer(source='created_by', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, help_text="Name of the project.")
    ticket_slug = serializers.CharField(read_only=True, help_text="Project-scoped ticket slug, e.g. SA-1.")
    attachments = TicketAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'id', 'project', 'project_name', 'ticket_slug', 'title', 'description',
            'status', 'priority', 'ticket_type', 'approved_status', 'assigned_to', 'assigned_to_details',
            'created_by', 'created_by_details', 'created_at', 'updated_at',
            'resolved_at', 'closed_at', 'attachments'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'resolved_at', 'closed_at', 'ticket_slug']
        extra_kwargs = {
            'project': {'help_text': 'Project ID.'},
            'title': {'help_text': 'Ticket title.'},
            'description': {'help_text': 'Detailed description of the issue.'},
            'status': {'help_text': 'OPEN, IN_PROGRESS, BLOCKED, IN_TESTING, REVIEW, COMPLETED, or CANCELLED.'},
            'priority': {'help_text': 'LOW, MEDIUM, HIGH, or CRITICAL.'},
            'assigned_to': {'help_text': 'User ID of the assignee (must be a project member).'},
            'created_by': {'help_text': 'Auto-set to the authenticated user.'},
        }

    def validate_assigned_to(self, value):
        """Ensure assigned user belongs to the project. Admins can assign anyone."""
        if value:
            # Get workspace context for permission check
            request = self.context.get('request')
            workspace = None
            if self.instance and self.instance.project:
                workspace = self.instance.project.workspace
            elif 'project' in self.initial_data:
                try:
                    workspace = Project.objects.get(id=self.initial_data['project']).workspace
                except Project.DoesNotExist:
                    pass
            # Admins/owners can assign anyone
            if request and (request.user.is_superuser or is_admin_or_owner(request.user, workspace)):
                return value
            # For updates, use existing project; for creates, get from initial_data
            project = None
            if self.instance:
                project = self.instance.project
            elif 'project' in self.initial_data:
                try:
                    project = Project.objects.get(id=self.initial_data['project'])
                except Project.DoesNotExist:
                    pass
            if project:
                is_project_agent = project.agents.filter(id=value.id).exists()
                is_workspace_owner = project.workspace and project.workspace.owner_id == value.id
                if not is_project_agent and not is_workspace_owner:
                    raise serializers.ValidationError(
                        "Assigned user must belong to the project."
                    )
        return value

    def validate_status(self, value):
        """Validate status key exists in workspace's StatusDefinitions."""
        # Get workspace from ticket's project
        project = None
        if self.instance:
            project = self.instance.project
        elif 'project' in self.initial_data:
            try:
                project = Project.objects.get(id=self.initial_data['project'])
            except Project.DoesNotExist:
                pass
        if project and project.workspace_id:
            exists = StatusDefinition.objects.filter(
                workspace_id=project.workspace_id, key=value
            ).exists()
            if not exists:
                valid = list(StatusDefinition.objects.filter(
                    workspace_id=project.workspace_id
                ).values_list('key', flat=True))
                raise serializers.ValidationError(
                    f"Invalid status '{value}'. Valid: {', '.join(valid)}."
                )
        return value

    def validate(self, data):
        """Validate status transitions using StatusTransition table."""
        request = self.context.get('request')
        if request and self.instance and 'status' in data:
            new_status = data['status']
            old_status = self.instance.status
            if old_status != new_status:
                ws_id = self.instance.project.workspace_id if self.instance.project else None
                if ws_id:
                    user = request.user
                    actor = 'BOT' if getattr(user, 'user_type', None) == 'BOT' else 'HUMAN'

                    # Check if transition is allowed for this actor type
                    allowed = StatusTransition.objects.filter(
                        workspace_id=ws_id,
                        from_status__key=old_status,
                        to_status__key=new_status,
                        actor_type__in=[actor, 'ALL'],
                    ).exists()
                    if not allowed:
                        valid_targets = list(StatusTransition.objects.filter(
                            workspace_id=ws_id,
                            from_status__key=old_status,
                            actor_type__in=[actor, 'ALL'],
                        ).values_list('to_status__key', flat=True))
                        raise serializers.ValidationError({
                            'status': f'{actor} cannot transition from {old_status} to {new_status}. '
                                      f'Allowed: {", ".join(valid_targets) if valid_targets else "none (terminal state)"}.'
                        })

                    # Check approval gate for bot transitions
                    if actor == 'BOT':
                        try:
                            target_status = StatusDefinition.objects.get(workspace_id=ws_id, key=new_status)
                            if target_status.is_bot_requires_approval and self.instance.approved_status != 'APPROVED':
                                raise serializers.ValidationError({
                                    'status': 'Bot requires ticket approval before moving to this state.'
                                })
                        except StatusDefinition.DoesNotExist:
                            pass  # This would be caught by status validation earlier
        return data


class CommentTicketSerializer(serializers.ModelSerializer):
    """Minimal ticket info embedded in comments."""
    ticket_slug = serializers.CharField(read_only=True)

    class Meta:
        model = Ticket
        fields = ['id', 'ticket_slug', 'title']


class CommentSerializer(serializers.ModelSerializer):
    """Serializer for Comment model."""
    author_details = UserSimpleSerializer(source='author', read_only=True)
    ticket_details = CommentTicketSerializer(source='ticket', read_only=True)

    class Meta:
        model = Comment
        fields = [
            'id', 'ticket', 'author', 'author_details', 'ticket_details', 'body',
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

class StatusDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for StatusDefinition — workspace-level status config."""
    in_use = serializers.SerializerMethodField(help_text="Whether any tickets use this status")

    class Meta:
        model = StatusDefinition
        fields = ['id', 'workspace', 'key', 'label', 'color', 'is_terminal', 'is_default', 'is_bot_requires_approval', 'position', 'in_use']
        read_only_fields = ['in_use']
        extra_kwargs = {
            'workspace': {'help_text': 'Workspace ID.'},
            'key': {'help_text': 'Unique status key within workspace, e.g. IN_PROGRESS.'},
        }

    def get_in_use(self, obj):
        return Ticket.objects.filter(
            project__workspace=obj.workspace, status=obj.key
        ).exists()

    def validate_key(self, value):
        # Key must be uppercase alphanumeric with underscores
        import re
        if not re.match(r'^[A-Z][A-Z0-9_]*$', value):
            raise serializers.ValidationError("Key must be uppercase letters, digits, and underscores.")
        # On update, key is immutable
        if self.instance and self.instance.key != value:
            raise serializers.ValidationError("Status key cannot be changed after creation.")
        return value


class StatusTransitionSerializer(serializers.ModelSerializer):
    """Serializer for StatusTransition — allowed status transitions."""
    from_status_key = serializers.CharField(source='from_status.key', read_only=True)
    to_status_key = serializers.CharField(source='to_status.key', read_only=True)

    class Meta:
        model = StatusTransition
        fields = ['id', 'workspace', 'from_status', 'to_status', 'from_status_key', 'to_status_key', 'actor_type']
        extra_kwargs = {
            'workspace': {'help_text': 'Workspace ID.'},
            'from_status': {'help_text': 'Source StatusDefinition ID.'},
            'to_status': {'help_text': 'Target StatusDefinition ID.'},
            'actor_type': {'help_text': 'BOT, HUMAN, or ALL.'},
        }

    def validate(self, data):
        # Ensure both statuses belong to the same workspace
        ws = data.get('workspace') or (self.instance.workspace if self.instance else None)
        from_s = data.get('from_status') or (self.instance.from_status if self.instance else None)
        to_s = data.get('to_status') or (self.instance.to_status if self.instance else None)
        if from_s and to_s:
            if from_s == to_s:
                raise serializers.ValidationError("Cannot transition to the same status.")
            if from_s.workspace_id != ws.id or to_s.workspace_id != ws.id:
                raise serializers.ValidationError("Both statuses must belong to the specified workspace.")
        return data


class BlogPostListSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True, default='')

    class Meta:
        model = BlogPost
        fields = ['id', 'title', 'slug', 'excerpt', 'author_name', 'featured_image_url',
                  'tags', 'published_at', 'created_at']


class BlogPostDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.name', read_only=True, default='')

    class Meta:
        model = BlogPost
        fields = ['id', 'title', 'slug', 'content', 'excerpt', 'author_name',
                  'featured_image_url', 'meta_title', 'meta_description', 'tags',
                  'published_at', 'created_at', 'updated_at']


class BlogPostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = ['id', 'title', 'slug', 'content', 'excerpt', 'author',
                  'featured_image_url', 'meta_title', 'meta_description', 'tags',
                  'is_published', 'published_at']


# Auth uses vanilla SimpleJWT TokenObtainPairView (username + password)
