from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from tickets.models import WorkspaceMember, Workspace

User = get_user_model()

class Command(BaseCommand):
    help = 'List and optionally remove users not in any workspace'

    def add_arguments(self, parser):
        parser.add_argument('--delete', action='store_true', help='Actually delete orphan users')

    def handle(self, *args, **options):
        # Users who are workspace members
        member_ids = set(WorkspaceMember.objects.values_list('user_id', flat=True))
        
        # Users who own workspaces
        owner_ids = set(Workspace.objects.values_list('owner_id', flat=True))
        
        # Protected = members OR owners OR superusers
        protected_ids = member_ids | owner_ids
        
        all_users = User.objects.all().order_by('id')
        
        self.stdout.write(f'\nTotal users: {all_users.count()}')
        self.stdout.write(f'Users in workspaces (member): {len(member_ids)}')
        self.stdout.write(f'Users who own workspaces: {len(owner_ids)}')
        
        self.stdout.write('\n=== WORKSPACE DETAILS ===')
        for ws in Workspace.objects.all():
            members = WorkspaceMember.objects.filter(workspace=ws).select_related('user')
            self.stdout.write(f'\n  {ws.name} (slug: {ws.slug}, owner: {ws.owner})')
            for m in members:
                self.stdout.write(f'    - {m.user.username} (ID:{m.user.id}, type:{m.user.user_type})')
        
        orphans = all_users.exclude(id__in=protected_ids).exclude(is_superuser=True)
        
        self.stdout.write(f'\n=== ORPHAN USERS (not in any workspace, not owners, not superusers) ===')
        self.stdout.write(f'Count: {orphans.count()}')
        for u in orphans:
            self.stdout.write(f'  ID:{u.id} | {u.username} | type:{u.user_type} | super:{u.is_superuser} | {u.name}')
        
        self.stdout.write(f'\n=== PROTECTED USERS (keeping) ===')
        for u in all_users.filter(id__in=protected_ids):
            self.stdout.write(f'  ID:{u.id} | {u.username} | type:{u.user_type} | super:{u.is_superuser} | {u.name}')
        for u in all_users.filter(is_superuser=True).exclude(id__in=protected_ids):
            self.stdout.write(f'  ID:{u.id} | {u.username} | type:{u.user_type} | super:{u.is_superuser} | {u.name} [SUPERUSER]')
        
        if options['delete'] and orphans.exists():
            count = orphans.count()
            orphans.delete()
            self.stdout.write(self.style.SUCCESS(f'\nDeleted {count} orphan users.'))
        elif not options['delete']:
            self.stdout.write(self.style.WARNING(f'\nDry run. Pass --delete to actually remove orphan users.'))
