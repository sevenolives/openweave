from django.db import migrations


def dedup_emails(apps, schema_editor):
    """
    For any email that appears more than once (case-insensitive),
    keep the account with the lowest pk and rename the rest to
    <username>@placeholder.invalid so the unique constraint can be added.
    """
    User = apps.get_model('tickets', 'User')
    seen = {}
    for user in User.objects.exclude(email='').exclude(email__isnull=True).order_by('id'):
        key = user.email.lower()
        if key in seen:
            user.email = f'{user.username}@placeholder.invalid'
            user.save(update_fields=['email'])
        else:
            seen[key] = user.id


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0048_phase_to_epic'),
    ]

    operations = [
        migrations.RunPython(dedup_emails, migrations.RunPython.noop),
    ]
