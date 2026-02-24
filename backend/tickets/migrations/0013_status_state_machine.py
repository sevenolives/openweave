"""Add StatusDefinition and StatusTransition tables, seed defaults, remove choices from Ticket.status."""

from django.db import migrations, models
import django.db.models.deletion


DEFAULT_STATUSES = [
    {'key': 'OPEN', 'label': 'Open', 'color': 'gray', 'is_terminal': False, 'is_default': True, 'position': 0},
    {'key': 'IN_PROGRESS', 'label': 'In Progress', 'color': 'blue', 'is_terminal': False, 'is_default': False, 'position': 1},
    {'key': 'BLOCKED', 'label': 'Blocked', 'color': 'red', 'is_terminal': False, 'is_default': False, 'position': 2},
    {'key': 'IN_TESTING', 'label': 'In Testing', 'color': 'purple', 'is_terminal': False, 'is_default': False, 'position': 3},
    {'key': 'REVIEW', 'label': 'Review', 'color': 'amber', 'is_terminal': False, 'is_default': False, 'position': 4},
    {'key': 'COMPLETED', 'label': 'Completed', 'color': 'green', 'is_terminal': True, 'is_default': False, 'position': 5},
    {'key': 'CANCELLED', 'label': 'Cancelled', 'color': 'gray', 'is_terminal': True, 'is_default': False, 'position': 6},
]

# Bot transitions: from_key -> [to_keys]
BOT_TRANSITIONS = {
    'OPEN': ['IN_PROGRESS', 'CANCELLED'],
    'IN_PROGRESS': ['BLOCKED', 'IN_TESTING', 'REVIEW', 'CANCELLED'],
    'BLOCKED': ['IN_PROGRESS', 'CANCELLED'],
    'IN_TESTING': ['IN_PROGRESS', 'REVIEW', 'BLOCKED'],
    'REVIEW': ['IN_PROGRESS', 'IN_TESTING', 'COMPLETED'],
}

# Human transitions: any non-terminal -> any
HUMAN_FREE_FLOW = True


def seed_statuses(apps, schema_editor):
    Workspace = apps.get_model('tickets', 'Workspace')
    StatusDefinition = apps.get_model('tickets', 'StatusDefinition')
    StatusTransition = apps.get_model('tickets', 'StatusTransition')

    for ws in Workspace.objects.all():
        status_map = {}
        for s in DEFAULT_STATUSES:
            sd, _ = StatusDefinition.objects.get_or_create(
                workspace=ws, key=s['key'],
                defaults={k: v for k, v in s.items() if k != 'key'}
            )
            status_map[s['key']] = sd

        # Bot transitions
        for from_key, to_keys in BOT_TRANSITIONS.items():
            for to_key in to_keys:
                StatusTransition.objects.get_or_create(
                    workspace=ws,
                    from_status=status_map[from_key],
                    to_status=status_map[to_key],
                    actor_type='BOT',
                )

        # Human transitions: all non-terminal -> all (including terminal)
        non_terminal = [sd for sd in status_map.values() if not sd.is_terminal]
        all_statuses = list(status_map.values())
        for from_sd in non_terminal:
            for to_sd in all_statuses:
                if from_sd != to_sd:
                    StatusTransition.objects.get_or_create(
                        workspace=ws,
                        from_status=from_sd,
                        to_status=to_sd,
                        actor_type='HUMAN',
                    )


def reverse_seed(apps, schema_editor):
    StatusTransition = apps.get_model('tickets', 'StatusTransition')
    StatusDefinition = apps.get_model('tickets', 'StatusDefinition')
    StatusTransition.objects.all().delete()
    StatusDefinition.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0012_update_status_choices'),
    ]

    operations = [
        migrations.CreateModel(
            name='StatusDefinition',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(help_text='Immutable key, e.g. IN_PROGRESS', max_length=30)),
                ('label', models.CharField(help_text="Display label, e.g. 'In Progress'", max_length=50)),
                ('color', models.CharField(default='gray', help_text="Color token, e.g. 'blue', 'red', '#ff0000'", max_length=30)),
                ('is_terminal', models.BooleanField(default=False, help_text='Terminal states cannot transition out')),
                ('is_default', models.BooleanField(default=False, help_text='Default status for new tickets')),
                ('position', models.PositiveIntegerField(default=0, help_text='Display order')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_definitions', to='tickets.workspace')),
            ],
            options={
                'db_table': 'status_definitions',
                'ordering': ['position'],
                'unique_together': {('workspace', 'key')},
            },
        ),
        migrations.CreateModel(
            name='StatusTransition',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('actor_type', models.CharField(choices=[('BOT', 'Bot'), ('HUMAN', 'Human'), ('ALL', 'All')], default='ALL', max_length=10)),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_transitions', to='tickets.workspace')),
                ('from_status', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transitions_from', to='tickets.statusdefinition')),
                ('to_status', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transitions_to', to='tickets.statusdefinition')),
            ],
            options={
                'db_table': 'status_transitions',
                'ordering': ['from_status__position', 'to_status__position'],
                'unique_together': {('workspace', 'from_status', 'to_status', 'actor_type')},
            },
        ),
        # Remove choices constraint from status field
        migrations.AlterField(
            model_name='ticket',
            name='status',
            field=models.CharField(default='OPEN', max_length=30),
        ),
        # Seed default statuses for all existing workspaces
        migrations.RunPython(seed_statuses, reverse_seed),
    ]
