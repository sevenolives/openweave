from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0046_ticketattachment_comment'),
    ]

    operations = [
        migrations.DeleteModel(
            name='AuditLog',
        ),
    ]
