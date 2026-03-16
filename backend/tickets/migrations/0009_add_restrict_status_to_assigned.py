from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0008_auditlog_idx_audit_entity_ticket_idx_ticket_status_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='workspace',
            name='restrict_status_to_assigned',
            field=models.BooleanField(default=False, help_text='If enabled, only the assigned user (or admin/owner) can change ticket status.'),
        ),
    ]
