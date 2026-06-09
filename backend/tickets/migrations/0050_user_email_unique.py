from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0049_dedup_emails'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(
                verbose_name='email address',
                max_length=254,
                blank=True,
                null=True,
                unique=True,
            ),
        ),
    ]
