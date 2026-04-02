from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('tickets', '0030_transfer_workspace_ownership'),
    ]
    operations = [
        migrations.RenameField(
            model_name='project',
            old_name='description',
            new_name='about_text',
        ),
        migrations.RenameField(
            model_name='project',
            old_name='notes',
            new_name='process_text',
        ),
    ]
