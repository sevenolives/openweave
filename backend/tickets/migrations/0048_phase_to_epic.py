from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0047_remove_auditlog'),
    ]

    operations = [
        # 1. Rename Phase model to Epic
        migrations.RenameModel(
            old_name='Phase',
            new_name='Epic',
        ),
        # 2. Change db_table from 'phases' to 'epics'
        migrations.AlterModelTable(
            name='epic',
            table='epics',
        ),
        # 3. Update related_name on Epic.project FK: 'phases' -> 'epics'
        migrations.AlterField(
            model_name='epic',
            name='project',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='epics',
                to='tickets.project',
            ),
        ),
        # 4. Rename current_phase FK on Project to current_epic
        migrations.RenameField(
            model_name='project',
            old_name='current_phase',
            new_name='current_epic',
        ),
        # 5. Rename phase FK on Ticket to epic
        migrations.RenameField(
            model_name='ticket',
            old_name='phase',
            new_name='epic',
        ),
    ]
