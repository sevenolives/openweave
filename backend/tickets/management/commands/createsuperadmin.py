import os
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
        # Get credentials from environment or use defaults
        username = os.environ.get('SUPERUSER_USERNAME', 'admin')
        email = os.environ.get('SUPERUSER_EMAIL', 'admin@agentdesk.com')
        password = os.environ.get('SUPERUSER_PASSWORD')
        if not password:
            self.stderr.write("SUPERUSER_PASSWORD env var is required")
            return

        # Check if a user with this email or username already exists
        existing_user = User.objects.filter(
            Q(email=email) | Q(username=username)
        ).first()

        if existing_user:
            # Update existing user to make sure they're a superuser
            existing_user.is_staff = True
            existing_user.is_superuser = True
            existing_user.user_type = 'HUMAN'
            existing_user.role = 'ADMIN'
            
            # Update email and username if they're different
            if existing_user.email != email:
                existing_user.email = email
            if existing_user.username != username:
                existing_user.username = username
                
            existing_user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Updated existing user "{existing_user.username}" as superuser'
                )
            )
        else:
            # Create new superuser
            User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                user_type='HUMAN',
                role='ADMIN'
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Superuser "{username}" created successfully'
                )
            )