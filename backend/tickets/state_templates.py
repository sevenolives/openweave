"""
Pre-built state machine templates for common workflows.
Each template defines statuses and their allowed_from transitions.
"""

TEMPLATES = {
    'software_dev': {
        'name': 'Software Development',
        'description': 'Standard software dev pipeline with spec, dev, testing, and deployment stages.',
        'statuses': [
            {'key': 'OPEN', 'label': 'Open', 'color': 'gray', 'is_default': True, 'position': 0, 'description': 'Ticket created, waiting to be picked up'},
            {'key': 'IN_SPEC', 'label': 'In Spec', 'color': 'blue', 'position': 1, 'description': 'Requirements and spec being written'},
            {'key': 'IN_DEV', 'label': 'In Dev', 'color': 'indigo', 'position': 2, 'description': 'Being built on a feature branch'},
            {'key': 'IN_TESTING', 'label': 'In Testing', 'color': 'purple', 'position': 3, 'description': 'Code reviewed, being validated'},
            {'key': 'DEPLOYED', 'label': 'Deployed', 'color': 'orange', 'position': 4, 'description': 'Merged and live on production'},
            {'key': 'QA_PASS', 'label': 'QA Pass', 'color': 'green', 'position': 5, 'description': 'Confirmed working on production'},
            {'key': 'QA_FAIL', 'label': 'QA Fail', 'color': 'red', 'position': 6, 'description': 'Issues found, needs rework'},
            {'key': 'BLOCKED', 'label': 'Blocked', 'color': 'red', 'position': 7, 'description': 'Waiting on dependency or external input'},
            {'key': 'CANCELLED', 'label': 'Cancelled', 'color': 'gray', 'position': 8, 'description': 'Dropped, no longer needed'},
        ],
        'transitions': {
            'IN_SPEC': ['OPEN'],
            'IN_DEV': ['IN_SPEC'],
            'IN_TESTING': ['IN_DEV'],
            'DEPLOYED': ['IN_TESTING'],
            'QA_PASS': ['DEPLOYED'],
            'QA_FAIL': ['DEPLOYED'],
            'BLOCKED': ['OPEN', 'IN_SPEC', 'IN_DEV', 'IN_TESTING'],
            'CANCELLED': ['OPEN', 'IN_SPEC', 'BLOCKED'],
        },
    },
    'kanban': {
        'name': 'Kanban',
        'description': 'Simple kanban board: To Do → In Progress → Done.',
        'statuses': [
            {'key': 'TODO', 'label': 'To Do', 'color': 'gray', 'is_default': True, 'position': 0, 'description': 'Ready to be worked on'},
            {'key': 'IN_PROGRESS', 'label': 'In Progress', 'color': 'blue', 'position': 1, 'description': 'Currently being worked on'},
            {'key': 'IN_REVIEW', 'label': 'In Review', 'color': 'purple', 'position': 2, 'description': 'Waiting for review or approval'},
            {'key': 'DONE', 'label': 'Done', 'color': 'green', 'position': 3, 'description': 'Completed'},
            {'key': 'BLOCKED', 'label': 'Blocked', 'color': 'red', 'position': 4, 'description': 'Cannot proceed'},
        ],
        'transitions': {},  # No restrictions — any state to any state
    },
    'agency': {
        'name': 'Agency / Client Work',
        'description': 'Client project pipeline: brief → design → review → deliver.',
        'statuses': [
            {'key': 'BRIEF', 'label': 'Brief', 'color': 'gray', 'is_default': True, 'position': 0, 'description': 'Client brief received'},
            {'key': 'SCOPING', 'label': 'Scoping', 'color': 'blue', 'position': 1, 'description': 'Estimating effort and timeline'},
            {'key': 'IN_PROGRESS', 'label': 'In Progress', 'color': 'indigo', 'position': 2, 'description': 'Active work'},
            {'key': 'CLIENT_REVIEW', 'label': 'Client Review', 'color': 'amber', 'position': 3, 'description': 'Sent to client for feedback'},
            {'key': 'REVISIONS', 'label': 'Revisions', 'color': 'orange', 'position': 4, 'description': 'Client feedback received, making changes'},
            {'key': 'DELIVERED', 'label': 'Delivered', 'color': 'green', 'position': 5, 'description': 'Final deliverable sent'},
            {'key': 'ON_HOLD', 'label': 'On Hold', 'color': 'gray', 'position': 6, 'description': 'Paused by client'},
        ],
        'transitions': {
            'SCOPING': ['BRIEF'],
            'IN_PROGRESS': ['SCOPING', 'REVISIONS'],
            'CLIENT_REVIEW': ['IN_PROGRESS'],
            'REVISIONS': ['CLIENT_REVIEW'],
            'DELIVERED': ['CLIENT_REVIEW'],
            'ON_HOLD': ['BRIEF', 'SCOPING', 'IN_PROGRESS', 'CLIENT_REVIEW'],
        },
    },
    'support': {
        'name': 'Support / Helpdesk',
        'description': 'Customer support ticket flow: triage → investigate → resolve.',
        'statuses': [
            {'key': 'NEW', 'label': 'New', 'color': 'gray', 'is_default': True, 'position': 0, 'description': 'Just submitted'},
            {'key': 'TRIAGED', 'label': 'Triaged', 'color': 'blue', 'position': 1, 'description': 'Categorized and prioritized'},
            {'key': 'INVESTIGATING', 'label': 'Investigating', 'color': 'indigo', 'position': 2, 'description': 'Looking into the issue'},
            {'key': 'WAITING_CUSTOMER', 'label': 'Waiting on Customer', 'color': 'amber', 'position': 3, 'description': 'Need more info from requester'},
            {'key': 'RESOLVED', 'label': 'Resolved', 'color': 'green', 'position': 4, 'description': 'Issue fixed'},
            {'key': 'CLOSED', 'label': 'Closed', 'color': 'gray', 'position': 5, 'description': 'Confirmed resolved, ticket closed'},
            {'key': 'REOPENED', 'label': 'Reopened', 'color': 'red', 'position': 6, 'description': 'Issue came back'},
        ],
        'transitions': {
            'TRIAGED': ['NEW', 'REOPENED'],
            'INVESTIGATING': ['TRIAGED'],
            'WAITING_CUSTOMER': ['INVESTIGATING'],
            'RESOLVED': ['INVESTIGATING', 'WAITING_CUSTOMER'],
            'CLOSED': ['RESOLVED'],
            'REOPENED': ['CLOSED', 'RESOLVED'],
        },
    },
    'content': {
        'name': 'Content Pipeline',
        'description': 'Content creation workflow: draft → edit → publish.',
        'statuses': [
            {'key': 'IDEA', 'label': 'Idea', 'color': 'gray', 'is_default': True, 'position': 0, 'description': 'Content idea proposed'},
            {'key': 'DRAFTING', 'label': 'Drafting', 'color': 'blue', 'position': 1, 'description': 'First draft being written'},
            {'key': 'EDITING', 'label': 'Editing', 'color': 'purple', 'position': 2, 'description': 'Being reviewed and edited'},
            {'key': 'READY', 'label': 'Ready to Publish', 'color': 'amber', 'position': 3, 'description': 'Approved, waiting for publish date'},
            {'key': 'PUBLISHED', 'label': 'Published', 'color': 'green', 'position': 4, 'description': 'Live and available'},
            {'key': 'ARCHIVED', 'label': 'Archived', 'color': 'gray', 'position': 5, 'description': 'No longer active'},
        ],
        'transitions': {
            'DRAFTING': ['IDEA'],
            'EDITING': ['DRAFTING'],
            'READY': ['EDITING'],
            'PUBLISHED': ['READY'],
            'ARCHIVED': ['PUBLISHED'],
        },
    },
}


def get_template_list():
    """Return list of available templates with name and description."""
    return [
        {'id': key, 'name': t['name'], 'description': t['description'], 'status_count': len(t['statuses'])}
        for key, t in TEMPLATES.items()
    ]


def apply_template(workspace, template_id, mode='additive'):
    """
    Apply a template to a workspace.
    mode='additive': add missing statuses, skip existing
    mode='replace': delete all existing and replace with template
    Returns: dict with added/skipped counts
    """
    from .models import StatusDefinition
    
    template = TEMPLATES.get(template_id)
    if not template:
        raise ValueError(f'Template "{template_id}" not found.')
    
    if mode == 'replace':
        # Check for tickets using current statuses
        from .models import Ticket
        in_use = list(Ticket.objects.filter(
            project__workspace=workspace
        ).values_list('status', flat=True).distinct())
        template_keys = {s['key'] for s in template['statuses']}
        orphaned = [s for s in in_use if s not in template_keys]
        if orphaned:
            raise ValueError(f'Cannot replace — tickets use statuses not in template: {", ".join(orphaned)}')
        StatusDefinition.objects.filter(workspace=workspace).delete()

    existing = {sd.key: sd for sd in StatusDefinition.objects.filter(workspace=workspace)}
    added = 0
    skipped = 0
    key_to_sd = dict(existing)

    for s in template['statuses']:
        if s['key'] in existing:
            skipped += 1
            continue
        sd = StatusDefinition.objects.create(
            workspace=workspace,
            key=s['key'],
            label=s['label'],
            color=s.get('color', 'gray'),
            description=s.get('description', ''),
            is_default=s.get('is_default', False) if mode == 'replace' else False,
            position=s.get('position', 0),
        )
        key_to_sd[s['key']] = sd
        added += 1

    # Apply transitions
    for target_key, source_keys in template.get('transitions', {}).items():
        target_sd = key_to_sd.get(target_key)
        if not target_sd:
            continue
        sources = [key_to_sd[k] for k in source_keys if k in key_to_sd]
        if mode == 'replace':
            target_sd.allowed_from.set(sources)
        else:
            target_sd.allowed_from.add(*sources)

    return {'added': added, 'skipped': skipped, 'total': len(key_to_sd)}
