"""Fix status label casing — QA_LOCAL→QA Local, QA_PASS→QA Pass, QA_FAIL→QA Fail."""
from django.db import migrations

FIXES = {
    'QA_LOCAL': 'QA Local',
    'QA_PASS': 'QA Pass',
    'QA_FAIL': 'QA Fail',
}

def fix_labels(apps, schema_editor):
    StatusDefinition = apps.get_model('tickets', 'StatusDefinition')
    for key, label in FIXES.items():
        StatusDefinition.objects.filter(key=key, label=key).update(label=label)

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0025_backfill_all_bots_sevenolives'),
    ]
    operations = [
        migrations.RunPython(fix_labels, migrations.RunPython.noop),
    ]
