"""
Migrate workspace-level allowed_users on StatusDefinition to project-level
ProjectStatusPermission entries. Each project in the workspace gets the same
permissions as the workspace had (preserving RTT and other project assignments).
"""
from django.db import migrations


def migrate_to_project_permissions(apps, schema_editor):
    StatusDefinition = apps.get_model('tickets', 'StatusDefinition')
    ProjectStatusPermission = apps.get_model('tickets', 'ProjectStatusPermission')
    Project = apps.get_model('tickets', 'Project')

    for sd in StatusDefinition.objects.prefetch_related('allowed_users').all():
        users = list(sd.allowed_users.all())
        if not users:
            continue
        # Create a ProjectStatusPermission for every project in this workspace
        projects = Project.objects.filter(workspace=sd.workspace)
        for project in projects:
            perm, created = ProjectStatusPermission.objects.get_or_create(
                project=project,
                status_definition=sd,
            )
            if created:
                perm.allowed_users.set(users)
            else:
                # Merge users
                existing = set(perm.allowed_users.values_list('id', flat=True))
                new_ids = set(u.id for u in users)
                perm.allowed_users.set(list(existing | new_ids))


class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0017_add_project_status_permissions'),
    ]
    operations = [
        migrations.RunPython(migrate_to_project_permissions, migrations.RunPython.noop),
    ]
