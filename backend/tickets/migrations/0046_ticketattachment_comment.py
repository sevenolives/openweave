from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0045_add_ticket_tagging'),
    ]

    operations = [
        migrations.AddField(
            model_name='ticketattachment',
            name='comment',
            field=models.ForeignKey(
                blank=True,
                help_text='If set, attachment belongs to this comment.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='attachments',
                to='tickets.comment',
            ),
        ),
    ]
