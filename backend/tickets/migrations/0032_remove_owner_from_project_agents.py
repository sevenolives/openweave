"""Remove workspace owner from all ProjectAgent records — owner has implicit access."""
from django.db import migrations

def remove_owner_agents(apps, schema_editor):
    Workspace = apps.get_model('tickets', 'Workspace')
    ProjectAgent = apps.get_model('tickets', 'ProjectAgent')
    Project = apps.get_model('tickets', 'Project')
    
    for ws in Workspace.objects.all():
        if ws.owner_id:
            # Remove owner from all projects in this workspace
            deleted = ProjectAgent.objects.filter(
                project__workspace=ws,
                agent_id=ws.owner_id
            ).delete()
            print(f"  {ws.name}: removed owner from {deleted[0]} project(s)")

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0031_rename_project_fields'),
    ]
    operations = [
        migrations.RunPython(remove_owner_agents, migrations.RunPython.noop),
    ]
