"""Drop the deprecated project_agents table and the ProjectAgent model.

Data was already migrated to WorkspaceMemberProject in 0034. This migration
removes the Project.agents M2M field and deletes the ProjectAgent model.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0040_phase_status_remove_completed'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='project',
            name='agents',
        ),
        migrations.AlterUniqueTogether(
            name='projectagent',
            unique_together=set(),
        ),
        migrations.DeleteModel(
            name='ProjectAgent',
        ),
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS project_agents;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
