import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    """
    Idempotent superuser sync — always targets pk=1.
    Reads ADMIN_SUPERUSER_EMAIL and ADMIN_SUPERUSER_PASSWORD from env.
    """
    help = 'Create or sync the superuser at pk=1'

    def handle(self, *args, **options):
        email = os.environ.get('ADMIN_SUPERUSER_EMAIL')
        password = os.environ.get('ADMIN_SUPERUSER_PASSWORD')

        if not password:
            self.stderr.write("ADMIN_SUPERUSER_PASSWORD env var is required")
            return
        if not email:
            self.stderr.write("ADMIN_SUPERUSER_EMAIL env var is required")
            return

        user = User.objects.filter(pk=1).first()

        if user:
            user.email = email
            user.is_staff = True
            user.is_superuser = True
            user.user_type = 'HUMAN'
            user.role = 'ADMIN'
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(
                f'Synced superuser pk=1 ("{user.username}", {email})'
            ))
        else:
            User.objects.create_superuser(
                id=1,
                username=email.split('@')[0],
                email=email,
                password=password,
                user_type='HUMAN',
                role='ADMIN',
            )
            self.stdout.write(self.style.SUCCESS(
                f'Created superuser pk=1 ({email})'
            ))
