"""Migrate RESOLVED/CLOSED statuses to COMPLETED and update status field choices."""

from django.db import migrations, models


def migrate_statuses(apps, schema_editor):
    Ticket = apps.get_model('tickets', 'Ticket')
    Ticket.objects.filter(status='RESOLVED').update(status='COMPLETED')
    Ticket.objects.filter(status='CLOSED').update(status='COMPLETED')


def reverse_statuses(apps, schema_editor):
    Ticket = apps.get_model('tickets', 'Ticket')
    Ticket.objects.filter(status='COMPLETED').update(status='RESOLVED')
    Ticket.objects.filter(status='CANCELLED').update(status='OPEN')


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0011_backfill_slugs_ticket_numbers'),
    ]

    operations = [
        # First update data while old choices still valid
        migrations.RunPython(migrate_statuses, reverse_statuses),
        # Then update the field choices
        migrations.AlterField(
            model_name='ticket',
            name='status',
            field=models.CharField(
                choices=[
                    ('OPEN', 'Open'),
                    ('IN_PROGRESS', 'In Progress'),
                    ('BLOCKED', 'Blocked'),
                    ('IN_TESTING', 'In Testing'),
                    ('REVIEW', 'Review'),
                    ('COMPLETED', 'Completed'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='OPEN',
                max_length=20,
            ),
        ),
    ]
