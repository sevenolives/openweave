from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from tickets.models import Workspace

User = get_user_model()


class Command(BaseCommand):
    """
    Seed database with minimal dev data. No test users.
    Idempotent - safe to run multiple times.
    """
    help = 'Create minimal dev data (workspace only, no test users)'

    def handle(self, *args, **options):
        self.stdout.write('Creating dev data...')

        admin = User.objects.filter(is_superuser=True).first()
        if not admin:
            admin = User.objects.first()

        if not admin:
            self.stdout.write(self.style.WARNING('No users found — skipping seed'))
            return

        workspace, created = Workspace.objects.get_or_create(
            slug='default',
            defaults={'name': 'Default Workspace', 'owner': admin}
        )
        if created:
            self.stdout.write(f'  Created workspace: {workspace.name}')
        else:
            self.stdout.write(f'  - Workspace exists: {workspace.name}')

        self.stdout.write(self.style.SUCCESS('Dev data seeded.'))
