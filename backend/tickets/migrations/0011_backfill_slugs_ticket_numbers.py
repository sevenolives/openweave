from django.db import migrations


def backfill(apps, schema_editor):
    Project = apps.get_model('tickets', 'Project')
    Ticket = apps.get_model('tickets', 'Ticket')

    for project in Project.objects.all():
        if not project.slug:
            words = project.name.split()
            if len(words) >= 2:
                project.slug = ''.join(w[0] for w in words[:4]).upper()
            else:
                project.slug = project.name[:4].upper().replace(' ', '')
            project.save(update_fields=['slug'])

    for project in Project.objects.all():
        tickets = Ticket.objects.filter(project=project, ticket_number__isnull=True).order_by('created_at')
        for i, ticket in enumerate(tickets, 1):
            ticket.ticket_number = i
            ticket.save(update_fields=['ticket_number'])


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0010_add_project_slug_ticket_number'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
