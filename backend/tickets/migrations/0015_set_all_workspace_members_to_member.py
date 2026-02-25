from django.db import migrations


def set_all_members(apps, schema_editor):
    WorkspaceMember = apps.get_model('tickets', 'WorkspaceMember')
    WorkspaceMember.objects.all().update(role='MEMBER')


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0014_add_role_to_projectagent'),
    ]

    operations = [
        migrations.RunPython(set_all_members, migrations.RunPython.noop),
    ]
