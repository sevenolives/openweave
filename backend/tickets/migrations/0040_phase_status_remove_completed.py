from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0039_add_website_to_workspace'),
    ]

    operations = [
        # Data migration: convert old statuses to new ones
        migrations.RunSQL(
            sql="""
                UPDATE phases SET status = 'INACTIVE' WHERE status IN ('UPCOMING', 'COMPLETED', 'READY');
            """,
            reverse_sql="""
                UPDATE phases SET status = 'UPCOMING' WHERE status = 'INACTIVE';
            """,
        ),
        # Update the field definition
        migrations.AlterField(
            model_name='phase',
            name='status',
            field=models.CharField(
                choices=[('INACTIVE', 'Inactive'), ('ACTIVE', 'Active')],
                default='INACTIVE',
                help_text='Phase status',
                max_length=20,
            ),
        ),
    ]
