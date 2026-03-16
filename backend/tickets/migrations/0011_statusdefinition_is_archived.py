from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0010_subscription_licensed_seats_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='statusdefinition',
            name='is_archived',
            field=models.BooleanField(default=False, help_text='Archived statuses cannot be used for new transitions'),
        ),
    ]
