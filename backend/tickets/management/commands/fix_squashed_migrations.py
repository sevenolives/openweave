"""One-time command to fix migration records after squashing to 0001_initial."""
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone


class Command(BaseCommand):
    help = 'Clear old tickets migration records and fake-apply 0001_initial'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Check if old migrations exist
            cursor.execute("SELECT name FROM django_migrations WHERE app='tickets' ORDER BY name")
            rows = [r[0] for r in cursor.fetchall()]

            if '0001_initial' in rows and len(rows) == 1:
                self.stdout.write("Already on squashed migration, nothing to do")
            elif len(rows) > 0 or self._tables_exist(cursor):
                # Old migrations exist OR tables exist but no migration records
                # (could happen if a previous squash attempt deleted records but failed to insert)
                cursor.execute("DELETE FROM django_migrations WHERE app='tickets'")
                self.stdout.write(f"Cleared {cursor.rowcount} old migration records")

                now = timezone.now().isoformat()
                cursor.execute(
                    "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)",
                    ['tickets', '0001_initial', now]
                )
                self.stdout.write("Fake-applied 0001_initial")
            else:
                self.stdout.write("No tickets migrations or tables found, will run normally")

    @staticmethod
    def _tables_exist(cursor):
        """Check if the tickets tables already exist in the database."""
        try:
            cursor.execute("SELECT 1 FROM tickets_user LIMIT 1")
            return True
        except Exception:
            return False
