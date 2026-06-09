from django.db import migrations


def fix_admin_email(apps, schema_editor):
    """
    User id=1 is the real digvijay account and should have digvijay@sevenolives.com.
    The admin superuser (user 79) incorrectly had that email assigned by createsuperadmin.py,
    causing the dedup migration to rename user id=1's email to admin2@sevenolives.com.

    Fix:
    1. Give the admin superuser (user 79) a neutral email (admin@openweave.dev)
    2. Restore user id=1's email to digvijay@sevenolives.com
    3. Clean up any other users with the old placeholder email from the dedup migration
    """
    User = apps.get_model('tickets', 'User')
    WorkspaceMember = apps.get_model('tickets', 'WorkspaceMember')
    Workspace = apps.get_model('tickets', 'Workspace')

    # Step 1: clear digvijay@sevenolives.com off the admin superuser (user 79)
    # so the unique constraint doesn't block reassigning it to user 1
    admin_user = User.objects.filter(is_superuser=True, username='admin').first()
    if admin_user and admin_user.email == 'digvijay@sevenolives.com':
        admin_user.email = 'admin@openweave.dev'
        admin_user.save(update_fields=['email'])

    # Step 2: also clear it off user 95 if needed (may have been set by earlier migration)
    dup = User.objects.exclude(id=1).filter(email='digvijay@sevenolives.com').first()
    if dup:
        dup.email = f'{dup.username}@placeholder.invalid'
        dup.save(update_fields=['email'])

    # Step 3: assign digvijay@sevenolives.com to user id=1
    real_digvijay = User.objects.filter(id=1).first()
    if real_digvijay:
        real_digvijay.email = 'digvijay@sevenolives.com'
        real_digvijay.save(update_fields=['email'])

        # Ensure user 1 is an ADMIN member of the SevenOlives workspace
        sevenolives_ws = Workspace.objects.filter(slug='sevenolives').first()
        if sevenolives_ws and sevenolives_ws.owner_id != real_digvijay.pk:
            WorkspaceMember.objects.get_or_create(
                workspace=sevenolives_ws,
                user=real_digvijay,
                defaults={'role': 'ADMIN', 'is_approved': True},
            )


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0050_user_email_unique'),
    ]

    operations = [
        migrations.RunPython(fix_admin_email, migrations.RunPython.noop),
    ]
