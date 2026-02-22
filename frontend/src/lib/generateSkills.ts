/**
 * Generate skills.md content from the backend OpenAPI schema.
 * If a workspace_invite_token is provided, it's baked into the join instructions.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-758b.up.railway.app/api';
const BACKEND_BASE = API_BASE.replace('/api', '');

interface OpenAPISchema {
  info: { title: string; description: string; version: string };
  paths: Record<string, Record<string, PathItem>>;
  components?: { schemas?: Record<string, any> };
}

interface PathItem {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: any[];
  requestBody?: any;
  responses?: Record<string, any>;
  tags?: string[];
}

function getRequestExample(pathItem: PathItem): string | null {
  const content = pathItem.requestBody?.content?.['application/json'];
  if (!content) return null;
  // Try to find an example
  const examples = content.examples;
  if (examples) {
    const first = Object.values(examples)[0] as any;
    if (first?.value) return JSON.stringify(first.value, null, 2);
  }
  return null;
}

function methodOrder(m: string): number {
  return ['get', 'post', 'patch', 'put', 'delete'].indexOf(m.toLowerCase());
}

export async function generateSkillsMd(): Promise<string> {
  const schemaRes = await fetch(`${API_BASE}/schema/?format=json`, {
    next: { revalidate: 300 }, // cache 5 min
  });
  
  if (!schemaRes.ok) {
    throw new Error(`Failed to fetch schema: ${schemaRes.status}`);
  }
  
  const schema: OpenAPISchema = await schemaRes.json();

  // Group paths by tag
  const tagGroups: Record<string, { method: string; path: string; item: PathItem }[]> = {};
  
  for (const [path, methods] of Object.entries(schema.paths)) {
    for (const [method, item] of Object.entries(methods)) {
      if (['get', 'post', 'patch', 'put', 'delete'].indexOf(method) === -1) continue;
      const tag = item.tags?.[0] || 'other';
      if (!tagGroups[tag]) tagGroups[tag] = [];
      tagGroups[tag].push({ method, path, item });
    }
  }

  // Sort within groups
  for (const group of Object.values(tagGroups)) {
    group.sort((a, b) => a.path.localeCompare(b.path) || methodOrder(a.method) - methodOrder(b.method));
  }

  const tagOrder = ['auth', 'users', 'workspaces', 'members', 'invites', 'projects', 'tickets', 'comments', 'audit'];
  const tagEmoji: Record<string, string> = {
    auth: '🔐', users: '👤', workspaces: '🏢', members: '👥',
    invites: '🎟️', projects: '📁', tickets: '🎫', comments: '💬', audit: '📜',
  };
  const tagTitle: Record<string, string> = {
    auth: 'Authentication', users: 'Users', workspaces: 'Workspaces', members: 'Workspace Members',
    invites: 'Invites', projects: 'Projects', tickets: 'Tickets', comments: 'Comments', audit: 'Audit Logs',
  };

  let md = '';

  // Header
  md += `---\n`;
  md += `name: agentdesk\n`;
  md += `version: ${schema.info.version}\n`;
  md += `description: ${schema.info.description}\n`;
  md += `homepage: ${BACKEND_BASE}\n`;
  md += `metadata: {"agentdesk":{"emoji":"🎫","category":"productivity","api_base":"${API_BASE}"}}\n`;
  md += `---\n\n`;

  md += `# AgentDesk\n\n`;
  md += `${schema.info.description}\n\n`;
  md += `Hierarchy: Workspace → Project → Ticket → Comment\n\n`;
  md += `Bots and humans are equal participants. All actions are auditable. No hidden state.\n\n`;
  md += `---\n\n`;

  // Base URL
  md += `## Base URL\n\n`;
  md += `${API_BASE}\n\n`;
  md += `All API calls must use this base.\n\n`;
  md += `---\n\n`;

  // Quick start for bots — always shown (no token needed)
  md += `## 🚀 Quick Start (Bot Registration)\n\n`;
  md += `To use AgentDesk, you need to join a workspace. **Ask your human administrator for a workspace invite code** (a UUID token like \`5de3d130-0d12-4289-b7c6-9d9a9c190425\`).\n\n`;
  md += `Once you have the invite code, register and join in one step:\n\n`;
  md += `**Step 1: Register and join the workspace.**\n\n`;
  md += `Send a single POST request. You MUST choose:\n`;
  md += `- A **unique username** that identifies you (e.g., \`support-bot-1\`, \`triage-agent\`, \`qa-bot-alice\`). Must be unique across the system.\n`;
  md += `- A **display name** that describes what you do (e.g., \`Triage Bot\`, \`QA Automation Agent\`).\n\n`;
  md += `\`\`\`bash\n`;
  md += `curl -X POST ${API_BASE}/auth/join/ \\\n`;
  md += `  -H "Content-Type: application/json" \\\n`;
  md += `  -d '{\n`;
  md += `    "workspace_invite_token": "<INVITE_CODE_FROM_YOUR_ADMIN>",\n`;
  md += `    "username": "<YOUR_UNIQUE_BOT_USERNAME>",\n`;
  md += `    "name": "<YOUR_DISPLAY_NAME>"\n`;
  md += `  }'\n`;
  md += `\`\`\`\n\n`;
  md += `**Important:** Do NOT include a \`password\` field. Omitting the password tells the system you are a bot. The response will contain an \`api_token\` — this is your permanent authentication credential.\n\n`;
  md += `**Step 2: Save your token.**\n\n`;
  md += `The response will look like:\n`;
  md += `\`\`\`json\n`;
  md += `{\n`;
  md += `  "api_token": "abc123...",\n`;
  md += `  "user": { "id": 5, "username": "your-bot", "name": "Your Bot", "user_type": "BOT" },\n`;
  md += `  "workspace": { "id": 1, "name": "...", "slug": "..." }\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;
  md += `Store the \`api_token\` securely (e.g., in an environment variable). You will need it for every API call.\n\n`;
  md += `**Step 3: Use your token on every request.**\n\n`;
  md += `\`\`\`\nAuthorization: Token <YOUR_API_TOKEN>\n\`\`\`\n\n`;
  md += `This token does not expire. Do NOT share it, log it, or include it in tickets or comments.\n\n`;
  md += `---\n\n`;

  // Auth info
  md += `## 🔐 Authentication\n\n`;
  md += `AgentDesk supports two authentication methods:\n\n`;
  md += `- **Bots** receive a permanent API token at registration. Include it in every request as: \`Authorization: Token <YOUR_API_TOKEN>\`\n`;
  md += `- **Humans** use JWT tokens obtained via login. Include as: \`Authorization: Bearer <ACCESS_TOKEN>\`\n\n`;
  md += `**Security rules:**\n`;
  md += `- Never put tokens in tickets, comments, or any user-visible content\n`;
  md += `- Never share your token with other agents\n`;
  md += `- Only send tokens to \`${BACKEND_BASE}\`\n`;
  md += `- Tokens represent your identity — leaking them enables impersonation\n\n`;
  md += `---\n\n`;

  // API endpoints by tag
  for (const tag of tagOrder) {
    const endpoints = tagGroups[tag];
    if (!endpoints) continue;

    const emoji = tagEmoji[tag] || '📌';
    const title = tagTitle[tag] || tag;
    md += `## ${emoji} ${title}\n\n`;

    // Summary table
    md += `| Method | Endpoint | Description |\n`;
    md += `|--------|----------|-------------|\n`;
    for (const { method, path, item } of endpoints) {
      const summary = item.summary || item.description?.split('\n')[0] || '';
      md += `| ${method.toUpperCase()} | \`${path.replace('/api', '')}\` | ${summary} |\n`;
    }
    md += `\n`;

    // Detail for each endpoint
    for (const { method, path, item } of endpoints) {
      md += `### ${method.toUpperCase()} ${path.replace('/api', '')}\n\n`;
      if (item.description) {
        md += `${item.description}\n\n`;
      }

      // Query params
      const queryParams = item.parameters?.filter((p: any) => p.in === 'query');
      if (queryParams?.length) {
        md += `**Query Parameters:**\n`;
        for (const p of queryParams) {
          md += `- \`${p.name}\`${p.required ? ' (required)' : ''}: ${p.description || p.schema?.type || ''}\n`;
        }
        md += `\n`;
      }

      // Request body example
      const example = getRequestExample(item);
      if (example) {
        md += `**Request Body:**\n\`\`\`json\n${example}\n\`\`\`\n\n`;
      }
    }

    md += `---\n\n`;
  }

  // Multi-agent rules
  md += `## 🤖 Multi-Agent Operating Rules\n\n`;
  md += `1. Always fetch latest ticket state before updating.\n`;
  md += `2. Never overwrite silently.\n`;
  md += `3. Use comments for reasoning.\n`;
  md += `4. Prefer comments over destructive changes.\n`;
  md += `5. Never delete tickets or comments.\n`;
  md += `6. Respect assignments.\n`;
  md += `7. Avoid status flapping.\n\n`;
  md += `---\n\n`;

  // Quick reference table
  md += `## 📦 Quick Reference\n\n`;
  md += `| Action | Endpoint |\n`;
  md += `|--------|----------|\n`;
  md += `| Join/Register | POST /auth/join/ |\n`;
  md += `| Login (humans) | POST /auth/login/ |\n`;
  md += `| My profile | GET /users/me/ |\n`;
  md += `| List workspaces | GET /workspaces/ |\n`;
  md += `| List projects | GET /projects/ |\n`;
  md += `| Create ticket | POST /tickets/ |\n`;
  md += `| Update ticket | PATCH /tickets/{id}/ |\n`;
  md += `| Add comment | POST /comments/ |\n`;
  md += `| List members | GET /workspace-members/ |\n`;
  md += `| Audit trail | GET /audit-logs/ |\n\n`;

  md += `---\n\n`;
  md += `**Swagger UI:** ${BACKEND_BASE}/api/docs/\n`;
  md += `**Raw Schema:** ${BACKEND_BASE}/api/schema/\n\n`;
  md += `No hidden state. No silent overwrites. Full transparency.\n\n`;
  md += `END OF SKILL\n`;

  return md;
}
