"""One-time command to fix migration records after squashing to 0001_initial."""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Clear old tickets migration records and fake-apply 0001_initial'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check if old migrations exist
            cursor.execute("SELECT name FROM django_migrations WHERE app='tickets' ORDER BY name")
            rows = [r[0] for r in cursor.fetchall()]

            if '0002_workspace_project_workspace_workspaceinvite_and_more' in rows:
                # Old migrations exist — need to squash
                cursor.execute("DELETE FROM django_migrations WHERE app='tickets'")
                self.stdout.write(f"Cleared {cursor.rowcount} old migration records")

                cursor.execute(
                    "INSERT INTO django_migrations (app, name, applied) VALUES ('tickets', '0001_initial', NOW())"
                )
                self.stdout.write("Fake-applied 0001_initial")
            elif '0001_initial' in rows:
                self.stdout.write("Already on squashed migration, nothing to do")
            else:
                self.stdout.write("No tickets migrations found, will run normally")
