from django.db import migrations

def verify_admin(apps, schema_editor):
    User = apps.get_model('tickets', 'User')
    # Verify all existing users who have email set
    User.objects.filter(email__isnull=False).exclude(email='').update(email_verified=True)

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0028_add_community_ratings'),
    ]
    operations = [
        migrations.RunPython(verify_admin, migrations.RunPython.noop),
    ]
