from django.db import migrations, models


def nullify_empty_emails(apps, schema_editor):
    """
    Convert empty-string emails to NULL so the unique constraint
    in the next migration can be applied without conflicts.
    (PostgreSQL treats multiple empty strings as duplicates under
    a unique index, but treats multiple NULLs as distinct.)
    """
    User = apps.get_model('tickets', 'User')
    User.objects.filter(email='').update(email=None)


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0049_dedup_emails'),
    ]

    operations = [
        # Step 1: make the column nullable first (currently NOT NULL at DB level)
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(
                verbose_name='email address',
                max_length=254,
                blank=True,
                null=True,
            ),
        ),
        # Step 2: now that NULL is allowed, convert empty strings to NULL
        migrations.RunPython(nullify_empty_emails, migrations.RunPython.noop),
    ]
