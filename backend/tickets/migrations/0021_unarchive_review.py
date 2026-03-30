from django.db import migrations

def unarchive_review(apps, schema_editor):
    StatusDefinition = apps.get_model('tickets', 'StatusDefinition')
    StatusDefinition.objects.filter(
        workspace__slug='sevenolives', key='REVIEW', is_archived=True
    ).update(is_archived=False)

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0020_add_project_invite_model'),
    ]
    operations = [
        migrations.RunPython(unarchive_review, migrations.RunPython.noop),
    ]
