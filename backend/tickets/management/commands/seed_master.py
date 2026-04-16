from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from tickets.models import Workspace, WorkspaceMember

User = get_user_model()


class Command(BaseCommand):
    """
    Seed master/reference data only — no transactional data (tickets, comments, projects).
    Idempotent — safe to run on every deploy.
    """
    help = 'Create master data (default workspace, workspace memberships)'

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
            self.stdout.write(f'  Created workspace: {workspace.name}')
        else:
            self.stdout.write(f'  - Workspace exists: {workspace.name}')

        # Remove owners from members table for ALL workspaces (cleanup)
        for ws in Workspace.objects.all():
            removed = WorkspaceMember.objects.filter(workspace=ws, user=ws.owner).delete()[0]
            if removed:
                self.stdout.write(f'  Cleaned up owner from members table in {ws.name}')

        self.stdout.write(self.style.SUCCESS('Master data seeded.'))
