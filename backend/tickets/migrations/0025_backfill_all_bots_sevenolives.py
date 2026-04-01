"""Assign all bots in sevenolives workspace to created_in_workspace."""
from django.db import migrations

def backfill(apps, schema_editor):
    User = apps.get_model('tickets', 'User')
    WorkspaceMember = apps.get_model('tickets', 'WorkspaceMember')
    Workspace = apps.get_model('tickets', 'Workspace')
    
    for bot in User.objects.filter(user_type='BOT', created_in_workspace__isnull=True):
        # Find first workspace this bot belongs to
        membership = WorkspaceMember.objects.filter(user=bot).order_by('joined_at').first()
        if membership:
            bot.created_in_workspace = membership.workspace
            bot.save(update_fields=['created_in_workspace'])

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0024_add_email_verification_and_otp'),
    ]
    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
