"""Backfill created_in_workspace for existing bots based on earliest workspace membership."""
from django.db import migrations

def backfill(apps, schema_editor):
    User = apps.get_model('tickets', 'User')
    WorkspaceMember = apps.get_model('tickets', 'WorkspaceMember')
    for bot in User.objects.filter(user_type='BOT', created_in_workspace__isnull=True):
        earliest = WorkspaceMember.objects.filter(user=bot).order_by('joined_at').first()
        if earliest:
            bot.created_in_workspace = earliest.workspace
            bot.save(update_fields=['created_in_workspace'])

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0022_add_created_in_workspace'),
    ]
    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
