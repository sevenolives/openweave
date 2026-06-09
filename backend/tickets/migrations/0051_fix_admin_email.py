from django.db import migrations


def fix_admin_email(apps, schema_editor):
    """
    The createsuperadmin command defaults to digvijay@sevenolives.com when
    DJANGO_ROOT_USER_EMAIL is not set. This caused that email to be assigned
    to the admin superuser (user 79), while the real digvijay account (user 95)
    had its email renamed to placeholder.invalid by the dedup migration.

    Fix:
    1. Give the admin superuser a neutral email (admin@openweave.dev)
    2. Restore digvijay's real email
    3. Ensure digvijay is a member (ADMIN) of the SevenOlives workspace
    """
    User = apps.get_model('tickets', 'User')
    WorkspaceMember = apps.get_model('tickets', 'WorkspaceMember')
    Workspace = apps.get_model('tickets', 'Workspace')

    # Fix admin superuser email (user 79)
    admin_user = User.objects.filter(
        username='admin', email='digvijay@sevenolives.com', is_superuser=True
    ).first()
    if admin_user:
        admin_user.email = 'admin@openweave.dev'
        admin_user.save(update_fields=['email'])

    # Restore digvijay's email (user 95)
    digvijay = User.objects.filter(
        username='digvijay', email='digvijay@placeholder.invalid'
    ).first()
    if digvijay:
        digvijay.email = 'digvijay@sevenolives.com'
        digvijay.save(update_fields=['email'])

        # Ensure digvijay is a member of the SevenOlives workspace
        sevenolives_ws = Workspace.objects.filter(slug='sevenolives').first()
        if sevenolives_ws:
            WorkspaceMember.objects.get_or_create(
                workspace=sevenolives_ws,
                user=digvijay,
                defaults={'role': 'ADMIN', 'is_approved': True},
            )


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0050_user_email_unique'),
    ]

    operations = [
        migrations.RunPython(fix_admin_email, migrations.RunPython.noop),
    ]
