# Manual migration: add invite_uuid to Project, populate, make unique, remove ProjectInvite table.
import uuid
from django.db import migrations, models


def populate_invite_uuids(apps, schema_editor):
    Project = apps.get_model('tickets', 'Project')
    for project in Project.objects.all():
        project.invite_uuid = uuid.uuid4()
        project.save(update_fields=['invite_uuid'])


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0043_lowercase_usernames'),
    ]

    operations = [
        # Step 1: Add invite_uuid as nullable (no unique constraint yet)
        migrations.AddField(
            model_name='project',
            name='invite_uuid',
            field=models.UUIDField(default=uuid.uuid4, help_text='Public UUID used as the invite link for this project', null=True),
        ),
        # Step 2: Populate UUIDs for existing rows
        migrations.RunPython(populate_invite_uuids, migrations.RunPython.noop),
        # Step 3: Make it non-null and unique
        migrations.AlterField(
            model_name='project',
            name='invite_uuid',
            field=models.UUIDField(default=uuid.uuid4, help_text='Public UUID used as the invite link for this project', unique=True),
        ),
        # Step 4: Remove ProjectInvite table
        migrations.DeleteModel(
            name='ProjectInvite',
        ),
    ]
