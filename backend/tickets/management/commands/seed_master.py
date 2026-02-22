from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from tickets.models import Workspace, WorkspaceMember, WorkspaceInvite

User = get_user_model()


class Command(BaseCommand):
    """
    Seed master/reference data only — no transactional data (tickets, comments, projects).
    Idempotent — safe to run on every deploy.
    """
    help = 'Create master data (default workspace, invite link, workspace memberships)'

    def handle(self, *args, **options):
        self.stdout.write('Seeding master data...')

        # Ensure default workspace exists
        admin = User.objects.filter(is_superuser=True).first()
        if not admin:
            admin = User.objects.first()

        if not admin:
            self.stdout.write(self.style.WARNING('No users found — skipping master seed'))
            return

        workspace, created = Workspace.objects.get_or_create(
            slug='default',
            defaults={'name': 'Default Workspace', 'owner': admin}
        )
        if created:
            self.stdout.write(f'  ✓ Created workspace: {workspace.name}')
        else:
            self.stdout.write(f'  - Workspace exists: {workspace.name}')

        # Ensure all users (except owner) are workspace members
        # Owner is on the workspace record itself, not in the members table
        for user in User.objects.exclude(id=admin.id):
            role = 'ADMIN' if user.is_superuser or user.role == 'ADMIN' else 'MEMBER'
            _, member_created = WorkspaceMember.objects.get_or_create(
                workspace=workspace, user=user,
                defaults={'role': role}
            )
            if member_created:
                self.stdout.write(f'  ✓ Added {user.username} to workspace as {role}')

        # Remove owner from members table if they're there (cleanup)
        WorkspaceMember.objects.filter(workspace=workspace, user=admin).delete()

        # Ensure at least one invite link exists
        if not WorkspaceInvite.objects.filter(workspace=workspace).exists():
            WorkspaceInvite.objects.create(workspace=workspace, created_by=admin)
            self.stdout.write('  ✓ Created default invite link')

        self.stdout.write(self.style.SUCCESS('Master data seeded.'))
