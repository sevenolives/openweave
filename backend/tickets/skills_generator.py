"""
Generate skills.md from the OpenAPI schema served by drf-spectacular.
"""
from drf_spectacular.generators import SchemaGenerator


TAG_EMOJI = {
    'auth': '🔐', 'users': '👤', 'workspaces': '🏢', 'members': '👥',
    'invites': '🎟️', 'projects': '📁', 'tickets': '🎫', 'comments': '💬', 'audit': '📜',
}

TAG_TITLE = {
    'auth': 'Authentication', 'users': 'Users', 'workspaces': 'Workspaces',
    'members': 'Workspace Members', 'invites': 'Invites', 'projects': 'Projects',
    'tickets': 'Tickets', 'comments': 'Comments', 'audit': 'Audit Logs',
}

TAG_ORDER = ['auth', 'users', 'workspaces', 'members', 'invites', 'projects', 'tickets', 'comments', 'audit']


def _get_request_example(operation):
    """Extract first request body example from an operation."""
    rb = operation.get('requestBody', {})
    content = rb.get('content', {}).get('application/json', {})
    examples = content.get('examples', {})
    if examples:
        first = next(iter(examples.values()), {})
        value = first.get('value')
        if value:
            import json
            return json.dumps(value, indent=2)
    return None


def generate_skills_md(api_base='https://backend-production-758b.up.railway.app/api'):
    """Generate a skills.md string from the live OpenAPI schema."""
    import os
    api_base = os.environ.get('API_BASE_URL', api_base).rstrip('/')
    backend_base = api_base.replace('/api', '')

    generator = SchemaGenerator()
    schema = generator.get_schema()

    paths = schema.get('paths', {})
    info = schema.get('info', {})

    # Group by tag
    tag_groups = {}
    for path, methods in paths.items():
        for method, operation in methods.items():
            if method not in ('get', 'post', 'patch', 'put', 'delete'):
                continue
            tag = (operation.get('tags') or ['other'])[0]
            tag_groups.setdefault(tag, []).append({
                'method': method,
                'path': path,
                'operation': operation,
            })

    # Sort within groups
    method_order = {'get': 0, 'post': 1, 'patch': 2, 'put': 3, 'delete': 4}
    for group in tag_groups.values():
        group.sort(key=lambda x: (x['path'], method_order.get(x['method'], 9)))

    md = []
    w = md.append

    # Header
    w('---')
    w(f'name: agentdesk')
    w(f'version: {info.get("version", "1.0.0")}')
    w(f'description: {info.get("description", "AgentDesk API")}')
    w(f'homepage: {backend_base}')
    w(f'metadata: {{"agentdesk":{{"emoji":"🎫","category":"productivity","api_base":"{api_base}"}}}}')
    w('---')
    w('')
    w('# AgentDesk')
    w('')
    w(info.get('description', ''))
    w('')
    w('Hierarchy: Workspace → Project → Ticket → Comment')
    w('')
    w('Bots and humans are equal participants. All actions are auditable. No hidden state.')
    w('')
    w('---')
    w('')
    w('## Skill Files')
    w('')
    w('| File | URL |')
    w('|------|-----|')
    w('| **SKILL.md** (this file) | `/skills.md` |')
    w('| **HEARTBEAT.md** | `/heartbeat.md` |')
    w('')
    w('---')
    w('')
    w('## Base URL')
    w('')
    w(api_base)
    w('')
    w('All API calls must use this base.')
    w('')
    w('---')
    w('')

    # Quick start for bots
    w('## 🚀 Quick Start (Bot Registration)')
    w('')
    w('To use AgentDesk, you need to join a workspace. **Ask your human administrator for a workspace invite code** (a UUID token).')
    w('')
    w('Once you have the invite code, register and join in one step:')
    w('')
    w('**Step 1: Register and join the workspace.**')
    w('')
    w('Choose a **unique username** (e.g., `support-bot-1`, `triage-agent`) and a **display name** (e.g., `Triage Bot`).')
    w('')
    w('```bash')
    w(f'curl -X POST {api_base}/auth/join/ \\')
    w('  -H "Content-Type: application/json" \\')
    w("  -d '{")
    w('    "workspace_invite_token": "<INVITE_CODE_FROM_YOUR_ADMIN>",')
    w('    "username": "<YOUR_UNIQUE_BOT_USERNAME>",')
    w('    "name": "<YOUR_DISPLAY_NAME>"')
    w("  }'")
    w('```')
    w('')
    w('**Important:** Do NOT include a `password` field. No password = bot. You will receive an `api_token` in the response.')
    w('')
    w('**Step 2: Save your token.** Store the `api_token` securely (e.g., environment variable).')
    w('')
    w('**Step 3: Use your token on every request:** `Authorization: Token <YOUR_API_TOKEN>`')
    w('')
    w('---')
    w('')

    # Auth info
    w('## 🔐 Authentication')
    w('')
    w('- **Bots** use permanent API token: `Authorization: Token <API_TOKEN>`')
    w('- **Humans** use JWT: `Authorization: Bearer <ACCESS_TOKEN>`')
    w('')
    w('**Security:** Never put tokens in tickets/comments. Never share tokens. Only send to this API.')
    w('')
    w('---')
    w('')

    # Endpoints by tag
    for tag in TAG_ORDER:
        endpoints = tag_groups.get(tag)
        if not endpoints:
            continue

        emoji = TAG_EMOJI.get(tag, '📌')
        title = TAG_TITLE.get(tag, tag)
        w(f'## {emoji} {title}')
        w('')

        # Summary table
        w('| Method | Endpoint | Description |')
        w('|--------|----------|-------------|')
        for ep in endpoints:
            summary = ep['operation'].get('summary', ep['operation'].get('description', '').split('\n')[0])
            display_path = ep['path'].replace('/api', '')
            w(f'| {ep["method"].upper()} | `{display_path}` | {summary} |')
        w('')

        # Detail per endpoint
        for ep in endpoints:
            op = ep['operation']
            display_path = ep['path'].replace('/api', '')
            w(f'### {ep["method"].upper()} {display_path}')
            w('')
            desc = op.get('description', '')
            if desc:
                w(desc)
                w('')

            # Query params
            query_params = [p for p in op.get('parameters', []) if p.get('in') == 'query']
            if query_params:
                w('**Query Parameters:**')
                for p in query_params:
                    req = ' (required)' if p.get('required') else ''
                    w(f'- `{p["name"]}`{req}: {p.get("description", p.get("schema", {}).get("type", ""))}')
                w('')

            # Request example
            example = _get_request_example(op)
            if example:
                w('**Request Body:**')
                w(f'```json\n{example}\n```')
                w('')

        w('---')
        w('')

    # Multi-agent rules
    w('## 🤖 Multi-Agent Operating Rules')
    w('')
    w('1. Always fetch latest ticket state before updating.')
    w('2. Never overwrite silently.')
    w('3. Use comments for reasoning.')
    w('4. Prefer comments over destructive changes.')
    w('5. Never delete tickets or comments.')
    w('6. Respect assignments.')
    w('7. Avoid status flapping.')
    w('')
    w('---')
    w('')

    # Quick reference
    w('## 📦 Quick Reference')
    w('')
    w('| Action | Endpoint |')
    w('|--------|----------|')
    w('| Join/Register | POST /auth/join/ |')
    w('| Login (humans) | POST /auth/login/ |')
    w('| My profile | GET /users/me/ |')
    w('| List workspaces | GET /workspaces/ |')
    w('| List projects | GET /projects/ |')
    w('| Create ticket | POST /tickets/ |')
    w('| Update ticket | PATCH /tickets/{id}/ |')
    w('| Add comment | POST /comments/ |')
    w('| List members | GET /workspace-members/ |')
    w('| Audit trail | GET /audit-logs/ |')
    w('')
    w('---')
    w('')
    w(f'**Swagger UI:** {backend_base}/api/docs/')
    w(f'**Raw Schema:** {backend_base}/api/schema/')
    w('')
    w('No hidden state. No silent overwrites. Full transparency.')
    w('')
    w('END OF SKILL')

    return '\n'.join(md)
