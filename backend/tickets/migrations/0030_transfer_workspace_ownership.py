"""Transfer ownership of all workspaces to the current admin user (username='admin')."""
from django.db import migrations

def transfer_ownership(apps, schema_editor):
    User = apps.get_model('tickets', 'User')
    Workspace = apps.get_model('tickets', 'Workspace')
    WorkspaceMember = apps.get_model('tickets', 'WorkspaceMember')
    
    try:
        admin = User.objects.get(username='admin')
    except User.DoesNotExist:
        return
    
    for ws in Workspace.objects.all():
        old_owner_id = ws.owner_id
        ws.owner = admin
        ws.save(update_fields=['owner'])
        # Ensure admin is a member too (for access checks)
        WorkspaceMember.objects.get_or_create(workspace=ws, user=admin)

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0029_verify_admin_email'),
    ]
    operations = [
        migrations.RunPython(transfer_ownership, migrations.RunPython.noop),
    ]
