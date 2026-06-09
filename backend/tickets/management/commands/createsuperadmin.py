import os
import uuid
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()


class Command(BaseCommand):
    """
    Create superuser command that's idempotent (safe to run multiple times).
    Follows best practices from BEST_PRACTICES.md.
    """
    help = 'Create a superuser if one does not exist'

    def handle(self, *args, **options):
        username = os.environ.get('SUPERUSER_USERNAME', 'admin')
        email = os.environ.get('SUPERUSER_EMAIL') or os.environ.get('DJANGO_ROOT_USER_EMAIL')
        password = os.environ.get('SUPERUSER_PASSWORD') or os.environ.get('DJANGO_ROOT_USER_PASSWORD')

        if not password:
            self.stderr.write("SUPERUSER_PASSWORD env var is required")
            return

        # Find existing superuser by username only (never steal another user's email)
        existing_user = User.objects.filter(username=username).first()

        if existing_user:
            existing_user.is_staff = True
            existing_user.is_superuser = True
            existing_user.user_type = 'HUMAN'
            existing_user.role = 'ADMIN'
            if email and existing_user.email != email:
                existing_user.email = email
            existing_user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Updated existing user "{existing_user.username}" as superuser'
                )
            )
        else:
            User.objects.create_superuser(
                username=username,
                email=email or f'{username}@openweave.dev',
                password=password,
                user_type='HUMAN',
                role='ADMIN',
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Superuser "{username}" created successfully'
                )
            )