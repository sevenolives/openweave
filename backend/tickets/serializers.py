from django.utils import timezone
from rest_framework import serializers
from .permissions import is_admin_or_owner
from .models import (
    User, Project, Ticket, Comment, AuditLog, Workspace, WorkspaceMember,
    WorkspaceInvite, ProjectInvite, TicketAttachment, StatusDefinition, ProjectAgent,
    BlogPost, MediaFile, Phase, ProjectStatusPermission, CommunityTemplate,
    WorkspaceMemberProject, StateTemplate, StateTemplateItem,
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
            'user_type', 'skills', 'description', 'is_active', 'email_verified', 'password'
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
    """Simplified user serializer for nested usage. Never exposes tokens or workspace ownership."""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'user_type', 'description']


class WorkspaceMemberProjectSerializer(serializers.ModelSerializer):
    """Serializer for WorkspaceMemberProject with role."""
    project = serializers.SlugRelatedField(slug_field='slug', queryset=Project.objects.all())
    user = UserSimpleSerializer(source='member.user', read_only=True)
    workspace = serializers.SlugRelatedField(slug_field='slug', source='member.workspace', read_only=True)

    class Meta:
        model = WorkspaceMemberProject
        fields = ['id', 'project', 'user', 'workspace', 'role', 'joined_at']
        read_only_fields = ['id', 'project', 'user', 'workspace', 'joined_at']


class ProjectAgentSerializer(serializers.ModelSerializer):
    """DEPRECATED: Serializer for ProjectAgent with role. Use WorkspaceMemberProjectSerializer instead."""
    project = serializers.SlugRelatedField(slug_field='slug', queryset=Project.objects.all())
    user = UserSimpleSerializer(source='agent', read_only=True)

    class Meta:
        model = ProjectAgent
        fields = ['id', 'project', 'user', 'role', 'joined_at']
        read_only_fields = ['id', 'project', 'user', 'joined_at']


class PhaseSerializer(serializers.ModelSerializer):
    """Serializer for project phases."""
    project = serializers.SlugRelatedField(slug_field='slug', queryset=Project.objects.all())

    class Meta:
        model = Phase
        fields = ['id', 'project', 'name', 'description', 'status', 'position',
                  'started_at', 'completed_at', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def update(self, instance, validated_data):
        new_status = validated_data.get('status')
        if new_status == 'ACTIVE':
            if not validated_data.get('started_at') and not instance.started_at:
                validated_data['started_at'] = timezone.now()
            # Complete the old active phase
            old_active = instance.project.current_phase
            if old_active and old_active.id != instance.id:
                old_active.status = 'COMPLETED'
                if not old_active.completed_at:
                    old_active.completed_at = timezone.now()
                old_active.save(update_fields=['status', 'completed_at'])
            instance = super().update(instance, validated_data)
            instance.project.current_phase = instance
            instance.project.save(update_fields=['current_phase'])
            return instance
        elif new_status == 'COMPLETED':
            if not validated_data.get('completed_at') and not instance.completed_at:
                validated_data['completed_at'] = timezone.now()
            instance = super().update(instance, validated_data)
            if instance.project.current_phase_id == instance.id:
                instance.project.current_phase = None
                instance.project.save(update_fields=['current_phase'])
            return instance
        return super().update(instance, validated_data)


class StatusDefinitionKeyField(serializers.Field):
    """Accept status key (e.g. IN_DEV) and resolve to StatusDefinition via project's workspace."""
    def to_representation(self, value):
        return value.key if value else None

    def to_internal_value(self, data):
        if isinstance(data, int):
            try:
                return StatusDefinition.objects.get(pk=data)
            except StatusDefinition.DoesNotExist:
                raise serializers.ValidationError(f'Status definition {data} not found.')
        # Resolve by key — need project context from parent data
        request = self.context.get('request')
        project_slug = request.data.get('project') if request else None
        if project_slug:
            try:
                project = Project.objects.select_related('workspace').get(slug__iexact=project_slug)
                return StatusDefinition.objects.get(workspace=project.workspace, key=data)
            except (Project.DoesNotExist, StatusDefinition.DoesNotExist):
                pass
        # Fallback: try instance's project
        if self.parent and self.parent.instance:
            ws = self.parent.instance.project.workspace
            try:
                return StatusDefinition.objects.get(workspace=ws, key=data)
            except StatusDefinition.DoesNotExist:
                pass
        raise serializers.ValidationError(f'Status "{data}" not found.')


class UserListSlugField(serializers.Field):
    """Accept list of usernames or numeric IDs, resolve to User queryset."""
    def to_representation(self, value):
        return [u.username for u in value.all()]

    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError('Expected a list.')
        users = []
        for item in data:
            if isinstance(item, int) or (isinstance(item, str) and item.isdigit()):
                try:
                    users.append(User.objects.get(pk=int(item)))
                except User.DoesNotExist:
                    raise serializers.ValidationError(f'User {item} not found.')
            else:
                try:
                    users.append(User.objects.get(username=item))
                except User.DoesNotExist:
                    raise serializers.ValidationError(f'User "{item}" not found.')
        return users


class ProjectStatusPermissionSerializer(serializers.ModelSerializer):
    """Project-level status permission overrides."""
    project = serializers.SlugRelatedField(slug_field='slug', queryset=Project.objects.all())
    status_definition = StatusDefinitionKeyField()
    allowed_users = UserListSlugField(required=False)
    allowed_users_details = UserSimpleSerializer(source='allowed_users', many=True, read_only=True)
    status_key = serializers.CharField(source='status_definition.key', read_only=True)
    status_label = serializers.CharField(source='status_definition.label', read_only=True)

    class Meta:
        model = ProjectStatusPermission
        fields = ['id', 'project', 'status_definition', 'status_key', 'status_label',
                  'allowed_users', 'allowed_users_details']

    def update(self, instance, validated_data):
        allowed_users = validated_data.pop('allowed_users', None)
        instance = super().update(instance, validated_data)
        if allowed_users is not None:
            instance.allowed_users.set(allowed_users)
        return instance

    def create(self, validated_data):
        allowed_users = validated_data.pop('allowed_users', [])
        instance = ProjectStatusPermission.objects.create(**validated_data)
        if allowed_users:
            instance.allowed_users.set(allowed_users)
        return instance


class WorkspaceSerializer(serializers.ModelSerializer):
    """Serializer for Workspace model."""
    member_count = serializers.SerializerMethodField(help_text="Number of members in the workspace (including owner).")
    owner_details = UserSimpleSerializer(source='owner', read_only=True)

    class Meta:
        model = Workspace
        fields = ['name', 'slug', 'owner', 'owner_details', 'member_count', 'restrict_status_to_assigned', 'is_public', 'website', 'created_at']
        read_only_fields = ['owner', 'owner_details', 'created_at']
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
    workspace = serializers.SlugRelatedField(slug_field='slug', queryset=Workspace.objects.all())

    class Meta:
        model = WorkspaceMember
        fields = ['id', 'workspace', 'user', 'joined_at']
        read_only_fields = ['id', 'user', 'joined_at']


class WorkspaceInviteSerializer(serializers.ModelSerializer):
    """Serializer for WorkspaceInvite model."""
    workspace = serializers.SlugRelatedField(slug_field='slug', queryset=Workspace.objects.all())
    project = serializers.SlugRelatedField(slug_field='slug', queryset=Project.objects.all(), required=False, allow_null=True)
    project_name = serializers.CharField(source='project.name', read_only=True, default=None)

    class Meta:
        model = WorkspaceInvite
        fields = ['id', 'workspace', 'project', 'project_name', 'token', 'created_by', 'expires_at', 'max_uses', 'use_count', 'is_active', 'created_at']
        read_only_fields = ['id', 'token', 'created_by', 'use_count', 'created_at']
        extra_kwargs = {
            'token': {'help_text': 'Auto-generated UUID invite token.'},
            'expires_at': {'help_text': 'Optional expiration datetime (ISO 8601).'},
            'max_uses': {'help_text': 'Optional maximum number of uses. Null = unlimited.'},
            'use_count': {'help_text': 'Number of times this invite has been used.'},
            'is_active': {'help_text': 'Whether the invite is currently active.'},
        }


class ProjectInviteSerializer(serializers.ModelSerializer):
    """Serializer for ProjectInvite model."""
    project = serializers.SlugRelatedField(slug_field='slug', queryset=Project.objects.all())
    project_name = serializers.CharField(source='project.name', read_only=True)
    workspace_slug = serializers.CharField(source='project.workspace.slug', read_only=True)

    class Meta:
        model = ProjectInvite
        fields = ['id', 'project', 'project_name', 'workspace_slug', 'token', 'created_by',
                  'expires_at', 'max_uses', 'use_count', 'is_active', 'created_at']
        read_only_fields = ['id', 'token', 'created_by', 'use_count', 'created_at']


class JoinRequestSerializer(serializers.Serializer):
    """Request serializer for the unified join endpoint."""
    workspace_invite_token = serializers.UUIDField(required=False, help_text="The invite token UUID. Required for Cases 2-4.")
    username = serializers.CharField(required=False, help_text="Username for new account. Required for Cases 1-3.")
    name = serializers.CharField(required=False, help_text="Display name for new account. Required for Cases 1-3.")
    password = serializers.CharField(required=False, write_only=True, help_text="Password for human users (Cases 1-2). Omit for bot users (Case 3).")


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for Project model."""
    workspace = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Workspace.objects.all(),
        help_text='Workspace slug.',
    )

    agent_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="List of user IDs to assign as project agents.",
    )
    active_phase = serializers.SerializerMethodField(help_text="Currently active phase, if any.")

    class Meta:
        model = Project
        fields = ['name', 'slug', 'about_text', 'process_text', 'workspace', 'is_public', 'created_at', 'updated_at', 'agent_ids', 'active_phase']
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        """Create project and assign agents."""
        agent_ids = validated_data.pop('agent_ids', [])
        project = Project.objects.create(**validated_data)
        if agent_ids:
            for user_id in agent_ids:
                user = User.objects.get(id=user_id)
                workspace_member, _ = WorkspaceMember.objects.get_or_create(
                    workspace=project.workspace, user=user
                )
                WorkspaceMemberProject.objects.get_or_create(
                    member=workspace_member, project=project,
                    defaults={'role': 'MEMBER'}
                )
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
            # Remove existing project members not in the new list
            if agent_ids:
                WorkspaceMemberProject.objects.filter(project=instance).exclude(
                    member__user_id__in=agent_ids
                ).delete()
                # Add new members
                for user_id in agent_ids:
                    user = User.objects.get(id=user_id)
                    workspace_member, _ = WorkspaceMember.objects.get_or_create(
                        workspace=instance.workspace, user=user
                    )
                    WorkspaceMemberProject.objects.get_or_create(
                        member=workspace_member, project=instance,
                        defaults={'role': 'MEMBER'}
                    )
            else:
                # Remove all members if empty list
                WorkspaceMemberProject.objects.filter(project=instance).delete()
        return instance

    def get_active_phase(self, obj):
        phase = obj.current_phase
        if phase:
            return {'id': phase.id, 'name': phase.name, 'description': phase.description, 'status': phase.status}
        return None


class TicketSlugOrPKField(serializers.Field):
    """Accept ticket slug (e.g. OW-22) or numeric PK."""
    def to_representation(self, value):
        if hasattr(value, 'ticket_slug'):
            return value.ticket_slug
        return value

    def to_internal_value(self, data):
        if isinstance(data, int) or (isinstance(data, str) and data.isdigit()):
            try:
                return Ticket.objects.get(pk=int(data))
            except Ticket.DoesNotExist:
                raise serializers.ValidationError(f'Ticket with ID {data} not found.')
        if isinstance(data, str):
            parts = data.rsplit('-', 1)
            if len(parts) == 2 and parts[1].isdigit():
                try:
                    return Ticket.objects.get(
                        project__slug__iexact=parts[0],
                        ticket_number=int(parts[1])
                    )
                except Ticket.DoesNotExist:
                    raise serializers.ValidationError(f'Ticket "{data}" not found.')
        raise serializers.ValidationError('Provide a ticket slug (e.g. OW-22) or numeric ID.')


class TicketAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for TicketAttachment model."""
    ticket = TicketSlugOrPKField()
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


class UserSlugField(serializers.Field):
    """Accept username or numeric ID, resolve to User."""
    def to_representation(self, value):
        return value.username if value else None

    def to_internal_value(self, data):
        if data is None or data == '':
            return None
        if isinstance(data, int) or (isinstance(data, str) and data.isdigit()):
            try:
                return User.objects.get(pk=int(data))
            except User.DoesNotExist:
                raise serializers.ValidationError(f'User {data} not found.')
        try:
            return User.objects.get(username=data)
        except User.DoesNotExist:
            raise serializers.ValidationError(f'User "{data}" not found.')


class PhaseDetailsField(serializers.RelatedField):
    """Read-only field returning phase id, name, status."""
    def to_representation(self, value):
        if value is None:
            return None
        return {'id': value.id, 'name': value.name, 'status': value.status}


class TicketSerializer(serializers.ModelSerializer):
    """Serializer for Ticket model."""
    project = serializers.SlugRelatedField(
        slug_field='slug',
        queryset=Project.objects.all(),
        help_text='Project slug (e.g. "OW").',
    )
    assigned_to = UserSlugField(required=False, allow_null=True)
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    created_by_details = UserSimpleSerializer(source='created_by', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, help_text="Name of the project.")
    ticket_slug = serializers.CharField(read_only=True, help_text="Project-scoped ticket slug, e.g. SA-1.")
    attachments = TicketAttachmentSerializer(many=True, read_only=True)
    phase = serializers.PrimaryKeyRelatedField(
        queryset=Phase.objects.all(), required=False, allow_null=True,
        help_text='Phase ID (must belong to the same project as the ticket).',
    )
    phase_details = PhaseDetailsField(source='phase', read_only=True)

    class Meta:
        model = Ticket
        fields = [
            'project', 'project_name', 'ticket_slug', 'title', 'description',
            'status', 'priority', 'ticket_type', 'assigned_to', 'assigned_to_details',
            'created_by', 'created_by_details', 'created_at', 'updated_at',
            'resolved_at', 'closed_at', 'attachments', 'phase', 'phase_details'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'resolved_at', 'closed_at', 'ticket_slug']
        extra_kwargs = {
            'title': {'help_text': 'Ticket title.'},
            'description': {'help_text': 'Detailed description of the issue.'},
            'status': {'help_text': 'Status key, e.g. OPEN, IN_DEV, QA_PASS.'},
            'priority': {'help_text': 'LOW, MEDIUM, HIGH, or CRITICAL.'},
            'created_by': {'help_text': 'Auto-set to the authenticated user.'},
        }

    def _resolve_project(self):
        """Resolve project from instance or initial_data (slug)."""
        if self.instance:
            return self.instance.project
        project_val = self.initial_data.get('project')
        if project_val:
            try:
                if isinstance(project_val, int) or (isinstance(project_val, str) and project_val.isdigit()):
                    return Project.objects.get(id=int(project_val))
                return Project.objects.get(slug__iexact=str(project_val))
            except Project.DoesNotExist:
                pass
        return None

    def validate_assigned_to(self, value):
        """Ensure assigned user belongs to the project. Admins can assign anyone."""
        if value:
            request = self.context.get('request')
            project = self._resolve_project()
            workspace = project.workspace if project else None
            if request and (request.user.is_superuser or is_admin_or_owner(request.user, workspace)):
                return value
            if project:
                is_project_agent = project.agents.filter(id=value.id).exists()
                is_workspace_owner = project.workspace and project.workspace.owner_id == value.id
                if not is_project_agent and not is_workspace_owner:
                    raise serializers.ValidationError(
                        "Assigned user must belong to the project."
                    )
        return value

    def validate_status(self, value):
        """Validate status key exists in workspace's StatusDefinitions and is not archived."""
        project = self._resolve_project()
        if project and project.workspace_id:
            try:
                sd = StatusDefinition.objects.get(
                    workspace_id=project.workspace_id, key=value
                )
                if sd.is_archived:
                    raise serializers.ValidationError(
                        f"Status '{value}' is archived and cannot be used."
                    )
            except StatusDefinition.DoesNotExist:
                valid = list(StatusDefinition.objects.filter(
                    workspace_id=project.workspace_id, is_archived=False
                ).values_list('key', flat=True))
                raise serializers.ValidationError(
                    f"Invalid status '{value}'. Valid: {', '.join(valid)}."
                )
        return value

    def validate_phase(self, value):
        """Validate phase belongs to the same project as the ticket."""
        if value is not None:
            project = self._resolve_project()
            if project and value.project_id != project.id:
                raise serializers.ValidationError(
                    "Phase must belong to the same project as the ticket."
                )
        return value

    def validate(self, data):
        """Validate status transitions using gate-based permissions on StatusDefinition."""
        # Cross-check phase + project on create (when both are in data)
        if 'phase' in data and data['phase'] is not None and 'project' in data:
            if data['phase'].project_id != data['project'].id:
                raise serializers.ValidationError({
                    'phase': 'Phase must belong to the same project as the ticket.'
                })
        request = self.context.get('request')
        if request and self.instance and 'status' in data:
            new_status = data['status']
            old_status = self.instance.status
            if old_status != new_status:
                ws_id = self.instance.project.workspace_id if self.instance.project else None
                if ws_id:
                    user = request.user

                    try:
                        target_status_def = StatusDefinition.objects.prefetch_related(
                            'allowed_from', 'allowed_users'
                        ).get(workspace_id=ws_id, key=new_status)
                    except StatusDefinition.DoesNotExist:
                        raise serializers.ValidationError({'status': f"Invalid status '{new_status}'."})

                    # 1. Check allowed_from (path enforcement) — uses prefetched cache
                    allowed_from_list = list(target_status_def.allowed_from.all())
                    if allowed_from_list:
                        try:
                            current_status_def = StatusDefinition.objects.get(workspace_id=ws_id, key=old_status)
                        except StatusDefinition.DoesNotExist:
                            current_status_def = None
                        if current_status_def not in allowed_from_list:
                            allowed_sources = [s.key for s in allowed_from_list]
                            raise serializers.ValidationError({
                                'status': f'Cannot move from {old_status} to {new_status}. '
                                          f'Allowed from: {", ".join(allowed_sources)}.'
                            })

                    # 2. Check project-level allowed_users (ProjectStatusPermission)
                    # Workspace admins/owners bypass this check
                    project = self.instance.project
                    if project:
                        perm = ProjectStatusPermission.objects.filter(
                            project=project, status_definition=target_status_def
                        ).prefetch_related('allowed_users').first()
                        if perm:
                            allowed_users_list = list(perm.allowed_users.all())
                            if allowed_users_list and not any(u.id == user.id for u in allowed_users_list):
                                ws = project.workspace
                                if not (user.is_superuser or (ws and is_admin_or_owner(user, ws))):
                                    raise serializers.ValidationError({
                                        'status': f'You are not allowed to move tickets to {new_status}.'
                                    })

                    # 3. If workspace has restrict_status_to_assigned, only assigned user, workspace admin/owner, or project admin can move
                    workspace = self.instance.project.workspace if self.instance.project else None
                    if workspace and workspace.restrict_status_to_assigned:
                        if self.instance.assigned_to_id and self.instance.assigned_to_id != user.id:
                            is_ws_admin = is_admin_or_owner(user, workspace)
                            is_proj_admin = self.instance.project and ProjectAgent.objects.filter(
                                project=self.instance.project, user=user, role='ADMIN'
                            ).exists()
                            if not is_ws_admin and not is_proj_admin:
                                raise serializers.ValidationError({
                                    'status': 'Only the assigned user, workspace admin, or project admin can move this ticket.'
                                })

        return data


class CommentTicketSerializer(serializers.ModelSerializer):
    """Minimal ticket info embedded in comments."""
    ticket_slug = serializers.CharField(read_only=True)

    class Meta:
        model = Ticket
        fields = ['ticket_slug', 'title']


class CommentSerializer(serializers.ModelSerializer):
    """Serializer for Comment model."""
    ticket = TicketSlugOrPKField()
    author_details = UserSimpleSerializer(source='author', read_only=True)
    ticket_details = CommentTicketSerializer(source='ticket', read_only=True)
    mentions = serializers.SerializerMethodField(
        help_text="List of user IDs mentioned via @[username] in the comment body."
    )

    class Meta:
        model = Comment
        fields = [
            'id', 'ticket', 'author', 'author_details', 'ticket_details', 'body',
            'mentions', 'created_at', 'updated_at'
        ]
        read_only_fields = ['author', 'created_at', 'updated_at']

    def get_mentions(self, obj):
        import re
        usernames = re.findall(r'@\[([^\]]+)\]', obj.body or '')
        if not usernames:
            return []
        users = User.objects.filter(username__in=usernames).values_list('id', flat=True)
        return list(users)
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

class AllowedFromKeyField(serializers.Field):
    """Accept and return status keys for allowed_from M2M."""
    def to_representation(self, value):
        return [sd.key for sd in value.all()]

    def to_internal_value(self, data):
        if not isinstance(data, list):
            raise serializers.ValidationError('Expected a list of status keys.')
        # Resolve keys to StatusDefinition objects — need workspace context
        request = self.context.get('request')
        instance = self.parent.instance if self.parent else None
        workspace = None
        if instance:
            workspace = instance.workspace
        elif request and request.data.get('workspace'):
            ws_slug = request.data['workspace']
            try:
                workspace = Workspace.objects.get(slug=ws_slug)
            except Workspace.DoesNotExist:
                pass
        results = []
        for item in data:
            if isinstance(item, int):
                # Backwards compat: accept numeric IDs
                try:
                    results.append(StatusDefinition.objects.get(pk=item))
                except StatusDefinition.DoesNotExist:
                    raise serializers.ValidationError(f'Status ID {item} not found.')
            elif workspace:
                try:
                    results.append(StatusDefinition.objects.get(workspace=workspace, key=item))
                except StatusDefinition.DoesNotExist:
                    raise serializers.ValidationError(f'Status "{item}" not found in workspace.')
            else:
                raise serializers.ValidationError(f'Cannot resolve status "{item}" without workspace context.')
        return results


class StatusDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for StatusDefinition — workspace-level status config."""
    workspace = serializers.SlugRelatedField(slug_field='slug', queryset=Workspace.objects.all())
    allowed_from = AllowedFromKeyField(required=False)
    allowed_users = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(), required=False,
        help_text='Deprecated — use project-level permissions instead.',
    )
    allowed_users_details = UserSimpleSerializer(source='allowed_users', many=True, read_only=True)
    class Meta:
        model = StatusDefinition
        fields = ['id', 'workspace', 'key', 'label', 'description', 'color', 'is_default',
                  'is_archived', 'position',
                  'allowed_from', 'allowed_users', 'allowed_users_details']
        extra_kwargs = {
            'key': {'help_text': 'Unique status key within workspace, e.g. IN_PROGRESS.'},
        }

    def validate_key(self, value):
        # Key must be uppercase alphanumeric with underscores
        import re
        if not re.match(r'^[A-Z][A-Z0-9_]*$', value):
            raise serializers.ValidationError("Key must be uppercase letters, digits, and underscores.")
        return value

    def update(self, instance, validated_data):
        allowed_from = validated_data.pop('allowed_from', None)
        allowed_users = validated_data.pop('allowed_users', None)
        old_key = instance.key
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        # If key changed, migrate all tickets using the old key
        if 'key' in validated_data and validated_data['key'] != old_key:
            from tickets.models import Ticket
            Ticket.objects.filter(
                project__workspace=instance.workspace, status=old_key
            ).update(status=instance.key)
        if allowed_from is not None:
            instance.allowed_from.set(allowed_from)
        if allowed_users is not None:
            instance.allowed_users.set(allowed_users)
        return instance


class CommunityTemplateSerializer(serializers.ModelSerializer):
    """Serializer for community templates."""
    workspace = serializers.SlugRelatedField(slug_field='slug', queryset=Workspace.objects.all())
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    status_count = serializers.SerializerMethodField()
    statuses = serializers.SerializerMethodField()
    avg_rating = serializers.FloatField(read_only=True)
    my_rating = serializers.SerializerMethodField()

    class Meta:
        model = CommunityTemplate
        fields = ['id', 'workspace', 'workspace_name', 'name', 'slug', 'description',
                  'is_published', 'status_count', 'statuses', 'bots',
                  'avg_rating', 'rating_count', 'sync_count', 'my_rating',
                  'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'rating_sum', 'rating_count', 'sync_count']

    def get_my_rating(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            from .models import CommunityRating
            rating = CommunityRating.objects.filter(template=obj, user=request.user).first()
            return rating.score if rating else None
        return None

    def get_status_count(self, obj):
        return StatusDefinition.objects.filter(workspace=obj.workspace, is_archived=False).count()

    def get_statuses(self, obj):
        """Return full status definitions with transitions for preview."""
        sds = StatusDefinition.objects.filter(workspace=obj.workspace, is_archived=False).prefetch_related('allowed_from').order_by('position')
        return [{
            'key': sd.key, 'label': sd.label, 'color': sd.color,
            'description': sd.description, 'position': sd.position,
            'is_default': sd.is_default,
            'allowed_from': [af.key for af in sd.allowed_from.all()],
        } for sd in sds]

    bots = serializers.SerializerMethodField()

    def get_bots(self, obj):
        """Return bot users in the workspace with their details."""
        from .models import WorkspaceMember
        bot_members = WorkspaceMember.objects.filter(
            workspace=obj.workspace, user__user_type='BOT'
        ).select_related('user')
        # Also include bots created in this workspace
        bot_ids = set(bm.user_id for bm in bot_members)
        created_bots = User.objects.filter(created_in_workspace=obj.workspace, user_type='BOT').exclude(id__in=bot_ids)
        bots = [bm.user for bm in bot_members] + list(created_bots)
        return [{
            'username': bot.username,
            'name': bot.name,
            'description': bot.description,
            'user_type': bot.user_type,
        } for bot in bots]


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


class MediaFileSerializer(serializers.ModelSerializer):
    workspace = serializers.SlugRelatedField(slug_field='slug', queryset=Workspace.objects.all())
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaFile
        fields = ['id', 'workspace', 'ticket', 'file', 'filename', 'media_type',
                  'content_type', 'size', 'uploaded_by', 'uploaded_by_username',
                  'url', 'created_at']
        read_only_fields = ['id', 'filename', 'media_type', 'content_type', 'size',
                           'uploaded_by', 'created_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class StateTemplateItemSerializer(serializers.ModelSerializer):
    """Serializer for StateTemplateItem model."""
    
    class Meta:
        model = StateTemplateItem
        fields = ['id', 'name', 'key', 'color', 'order', 'is_default', 'allowed_from_keys']


class StateTemplateSerializer(serializers.ModelSerializer):
    """Serializer for StateTemplate model with nested items."""
    items = StateTemplateItemSerializer(many=True, read_only=True)
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    workspace_slug = serializers.CharField(source='workspace.slug', read_only=True)
    item_count = serializers.SerializerMethodField()
    state_flow_preview = serializers.SerializerMethodField()
    
    class Meta:
        model = StateTemplate
        fields = ['id', 'name', 'description', 'icon', 'workspace', 'workspace_name', 
                 'workspace_slug', 'is_published', 'sync_count', 'created_at', 'updated_at',
                 'items', 'item_count', 'state_flow_preview']
        read_only_fields = ['id', 'sync_count', 'created_at', 'updated_at', 'workspace_name', 
                           'workspace_slug', 'item_count', 'state_flow_preview']

    def validate_workspace(self, value):
        """Accept workspace slug or ID."""
        return value

    def to_internal_value(self, data):
        """Convert workspace slug to workspace object."""
        if 'workspace' in data and isinstance(data['workspace'], str) and not data['workspace'].isdigit():
            try:
                data = data.copy()
                data['workspace'] = Workspace.objects.get(slug=data['workspace']).id
            except Workspace.DoesNotExist:
                raise serializers.ValidationError({'workspace': f'Workspace "{data["workspace"]}" not found.'})
        return super().to_internal_value(data)

    def get_item_count(self, obj):
        return obj.items.count()

    def get_state_flow_preview(self, obj):
        """Generate state flow preview like 'Open → Dev → Testing → Review → Completed'."""
        items = obj.items.order_by('order')[:5]  # Show first 5 states
        names = [item.name for item in items]
        preview = ' → '.join(names)
        if obj.items.count() > 5:
            preview += ' → ...'
        return preview


class StateTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for template list view."""
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    workspace_slug = serializers.CharField(source='workspace.slug', read_only=True)
    item_count = serializers.SerializerMethodField()
    state_flow_preview = serializers.SerializerMethodField()
    
    class Meta:
        model = StateTemplate
        fields = ['id', 'name', 'description', 'icon', 'workspace_name', 'workspace_slug',
                 'sync_count', 'item_count', 'state_flow_preview', 'created_at']
        
    def get_item_count(self, obj):
        return obj.items.count()

    def get_state_flow_preview(self, obj):
        """Generate state flow preview like 'Open → Dev → Testing → Review → Completed'."""
        items = obj.items.order_by('order')[:5]  # Show first 5 states
        names = [item.name for item in items]
        preview = ' → '.join(names)
        if obj.items.count() > 5:
            preview += ' → ...'
        return preview


# Auth uses vanilla SimpleJWT TokenObtainPairView (username + password)
