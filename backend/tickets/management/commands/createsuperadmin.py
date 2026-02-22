from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Q
from decouple import config

User = get_user_model()


class Command(BaseCommand):
    """
    Create superuser command that's idempotent (safe to run multiple times).
    Follows best practices from BEST_PRACTICES.md.
    """
    help = 'Create a superuser if one does not exist'

    def handle(self, *args, **options):
        # Get credentials from environment or use defaults
        username = config('SUPERUSER_USERNAME', default='admin')
        email = config('SUPERUSER_EMAIL', default='admin@agent-desk.com')
        password = config('SUPERUSER_PASSWORD', default='admin123')

        # Check if a user with this email or username already exists
        existing_user = User.objects.filter(
            Q(email=email) | Q(username=username)
        ).first()

        if existing_user:
            # Update existing user to make sure they're a superuser
            existing_user.is_staff = True
            existing_user.is_superuser = True
            existing_user.agent_type = 'HUMAN'
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
                agent_type='HUMAN',
                role='ADMIN'
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Superuser "{username}" created successfully'
                )
            )