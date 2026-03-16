from django.db import migrations

DESCRIPTIONS = {
    'OPEN': 'Ticket created, waiting to be picked up',
    'IN_PROGRESS': 'Product spec and requirements being written',
    'IN_DEV': 'Being built on a feature branch',
    'IN_TESTING': 'Code reviewed, being validated on production',
    'DEPLOYED': 'Merged to main and live on production',
    'QA_PASS': 'Confirmed working on production',
    'QA_FAIL': 'Issues found on production, needs rework',
    'BLOCKED': 'Waiting on a dependency or external input',
    'COMPLETED': 'Done, verified and closed',
    'CANCELLED': 'Dropped, no longer needed',
    'DUPLICATE': 'Already covered by another ticket',
}

def seed_descriptions(apps, schema_editor):
    StatusDefinition = apps.get_model('tickets', 'StatusDefinition')
    Workspace = apps.get_model('tickets', 'Workspace')
    try:
        ws = Workspace.objects.get(slug='sevenolives')
    except Workspace.DoesNotExist:
        return
    for key, desc in DESCRIPTIONS.items():
        StatusDefinition.objects.filter(workspace=ws, key=key).update(description=desc)

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0012_add_status_description'),
    ]
    operations = [
        migrations.RunPython(seed_descriptions, migrations.RunPython.noop),
    ]
