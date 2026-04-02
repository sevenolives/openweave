'use client';

import { useState } from 'react';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';

const LAST_UPDATED = 'March 11, 2026';

const policies = [
  {
    id: 'information-security',
    title: 'Information Security Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy establishes the framework for protecting OpenWeave information assets, including customer data, system configurations, and audit records.',
      },
      {
        heading: 'Access Controls',
        content: 'All access to OpenWeave is authenticated via JWT tokens or API tokens. Every request is scoped to a specific workspace — users and agents can only access data within workspaces they belong to. Workspace-level isolation is enforced at the API layer, not the client.',
      },
      {
        heading: 'Authentication & Authorization',
        content: 'OpenWeave supports JWT-based session authentication for human users and token-based authentication for bot agents. All tokens are workspace-scoped. CSRF protection is enabled on all state-changing endpoints. CORS policies restrict cross-origin access to approved domains.',
      },
      {
        heading: 'Workspace Isolation',
        content: 'Each workspace operates as an isolated tenant. Database queries are filtered by workspace membership. Users cannot enumerate or access resources outside their assigned workspaces. This isolation is enforced server-side in every API view.',
      },
      {
        heading: 'Bot vs Human Separation',
        content: 'Bot and human identities are tracked separately. The state machine uses gate-based permissions to control who can enter each state and from which source states. This separation is enforced at the API layer.',
      },
    ],
  },
  {
    id: 'change-management',
    title: 'Change Management Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy governs how changes to OpenWeave systems are proposed, reviewed, approved, and deployed.',
      },
      {
        heading: 'Version Control',
        content: 'All source code is managed in GitHub. Every change requires a commit with a descriptive message. The main branch is the single source of truth for production.',
      },
      {
        heading: 'Review Process',
        content: 'Changes are developed on feature branches and submitted as pull requests. Code review is required before merging to main. Automated checks run on every PR.',
      },
      {
        heading: 'Deployment',
        content: 'Production deployments are automated via Railway. Merges to the main branch trigger automatic deployment to both frontend and backend services. Rollbacks are performed by reverting commits and redeploying.',
      },
      {
        heading: 'Change Tracking',
        content: 'Git history provides a complete, immutable record of all code changes including author, timestamp, and diff. Deployment logs are retained by Railway.',
      },
    ],
  },
  {
    id: 'access-control',
    title: 'Access Control Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy defines how access to OpenWeave resources is granted, managed, and revoked.',
      },
      {
        heading: 'User Model',
        content: 'OpenWeave uses a workspace → project → user hierarchy. Users are members of workspaces and can be assigned to projects within those workspaces. Roles include workspace owner, project admin, and project member.',
      },
      {
        heading: 'Role-Based Access',
        content: 'Workspace owners can manage all resources within their workspace. Project admins can configure state machines, transitions, and manage project members. Members can view and interact with tickets according to their permissions.',
      },
      {
        heading: 'Bot Agent Access',
        content: 'Bot agents authenticate with API tokens scoped to a specific workspace. Gate-based permissions on each state control which users can enter and from which source states.',
      },
      {
        heading: 'Token Management',
        content: 'API tokens are generated per-agent and scoped to a single workspace. Tokens can be revoked at any time by workspace owners. JWT session tokens have configurable expiration. All token usage is logged.',
      },
      {
        heading: 'Access Revocation',
        content: 'When a user or bot is removed from a workspace, all access is immediately revoked. Token revocation takes effect on the next API request.',
      },
    ],
  },
  {
    id: 'incident-response',
    title: 'Incident Response Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy defines procedures for detecting, responding to, and recovering from security incidents.',
      },
      {
        heading: 'Detection',
        content: 'OpenWeave monitors application logs, error rates, and API response times. The immutable audit trail provides forensic evidence of all state changes. Anomalous patterns (e.g., unauthorized transition attempts) are logged and flagged.',
      },
      {
        heading: 'Classification',
        content: 'Incidents are classified by severity: Critical (data breach, system compromise), High (service outage, unauthorized access attempt), Medium (performance degradation), Low (minor issues with no data impact).',
      },
      {
        heading: 'Response Procedures',
        content: 'Critical and High incidents trigger immediate investigation. The response team assesses impact, contains the threat, and begins remediation. Affected systems may be isolated or taken offline if necessary.',
      },
      {
        heading: 'Notification',
        content: 'Affected customers are notified within 72 hours of a confirmed data breach. Notification includes the nature of the incident, data affected, remediation steps, and contact information. Regulatory notifications are made as required by applicable law.',
      },
      {
        heading: 'Post-Incident Review',
        content: 'Every Critical and High incident undergoes a post-mortem review. Findings are documented and remediation actions are tracked to completion.',
      },
    ],
  },
  {
    id: 'data-retention',
    title: 'Data Retention & Disposal Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy defines how long OpenWeave retains data and how data is securely disposed of.',
      },
      {
        heading: 'Audit Logs',
        content: 'The immutable audit trail (AuditLog model) is retained indefinitely by default. Audit logs record every state change including performer identity, timestamp, old value, and new value. Logs cannot be modified or deleted through the application.',
      },
      {
        heading: 'Application Data',
        content: 'Workspace data (tickets, projects, configurations) is retained for the lifetime of the workspace. When a workspace is deleted, all associated data is permanently removed from the database.',
      },
      {
        heading: 'User Data',
        content: 'User account data is retained while the account is active. Users may request account deletion, which removes personal data and disassociates their activity from their identity.',
      },
      {
        heading: 'Secure Disposal',
        content: 'Data deletion is performed at the database level. Railway Postgres instances use encrypted storage — when data is deleted, it becomes unrecoverable. Database backups follow Railway\'s retention schedule and are encrypted at rest.',
      },
    ],
  },
  {
    id: 'encryption',
    title: 'Encryption Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy defines encryption standards for data in transit and at rest.',
      },
      {
        heading: 'Data in Transit',
        content: 'All communication between clients and OpenWeave services is encrypted via TLS 1.2+. HTTPS is enforced on all endpoints — HTTP requests are redirected to HTTPS. API-to-database connections within Railway\'s internal network use encrypted channels.',
      },
      {
        heading: 'Data at Rest',
        content: 'The PostgreSQL database is hosted on Railway with encryption at rest enabled by default. Database backups are encrypted. No sensitive data is stored in plaintext on disk.',
      },
      {
        heading: 'Secrets Management',
        content: 'API keys, database credentials, and other secrets are stored as environment variables in Railway\'s encrypted configuration. Secrets are never committed to source code. Access to production environment variables is restricted.',
      },
    ],
  },
  {
    id: 'availability',
    title: 'Availability Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy defines availability targets and procedures for maintaining service uptime.',
      },
      {
        heading: 'Infrastructure',
        content: 'OpenWeave is hosted on Railway, which provides managed infrastructure with automatic scaling, health checks, and zero-downtime deployments. Frontend and backend services run as separate Railway services.',
      },
      {
        heading: 'Uptime Target',
        content: 'OpenWeave targets 99.9% monthly uptime for the API and frontend services. Scheduled maintenance windows are communicated in advance when possible.',
      },
      {
        heading: 'Monitoring',
        content: 'Service health is monitored via Railway\'s built-in health checks and logging. Application-level errors are tracked and alerted on. Database connectivity and response times are monitored.',
      },
      {
        heading: 'Disaster Recovery',
        content: 'Railway provides automated database backups. In the event of a service failure, Railway automatically restarts services. Full redeployment from the main branch can be triggered manually if needed.',
      },
    ],
  },
  {
    id: 'audit-logging',
    title: 'Audit & Logging Policy',
    sections: [
      {
        heading: 'Purpose',
        content: 'This policy defines what events are logged, how logs are stored, and how they are used for compliance and forensics.',
      },
      {
        heading: 'What Is Logged',
        content: 'Every state transition on every ticket is recorded in the AuditLog model. Each log entry includes: the performer (user or bot), timestamp, the field that changed, the old value, the new value, and the ticket identifier. Authentication events, failed transition attempts, and API errors are also logged.',
      },
      {
        heading: 'Immutability',
        content: 'Audit log entries are append-only. The application does not provide any endpoint or mechanism to modify or delete audit log entries. This ensures a tamper-evident record of all system activity.',
      },
      {
        heading: 'Access to Logs',
        content: 'Audit logs are accessible via the /api/audit-logs/ endpoint, scoped to the user\'s workspace. Only workspace members can view audit logs for their workspace. Logs can be filtered by ticket, performer, date range, and field.',
      },
      {
        heading: 'Retention',
        content: 'Audit logs are retained indefinitely. Application logs (stdout/stderr) are retained according to Railway\'s log retention policy. No log data is purged without explicit administrative action.',
      },
      {
        heading: 'Use in Investigations',
        content: 'Audit logs serve as the primary forensic evidence source for security investigations, compliance audits, and operational troubleshooting. The immutable trail ensures that the sequence and attribution of all state changes can be reconstructed.',
      },
    ],
  },
];

export default function PoliciesPage() {
  const [activePolicy, setActivePolicy] = useState(policies[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPolicy = policies.find((p) => p.id === activePolicy) || policies[0];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PublicNav />

      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">Compliance</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Security Policies</h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl">
            OpenWeave is SOC 2 compliant. These policies govern how we protect your data and systems.
          </p>
          <p className="mt-3 text-sm text-gray-600">Last updated: {LAST_UPDATED}</p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        {/* Mobile policy selector */}
        <div className="md:hidden mb-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
          >
            <span>{currentPolicy.title}</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {sidebarOpen && (
            <div className="mt-2 rounded-lg bg-white/5 border border-white/10 p-2 space-y-1">
              {policies.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActivePolicy(p.id); setSidebarOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    activePolicy === p.id
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-10">
          {/* Desktop sidebar */}
          <aside className="hidden md:block w-64 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {policies.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePolicy(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    activePolicy === p.id
                      ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </nav>
          </aside>

          {/* Policy content */}
          <main className="flex-1 min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-8">{currentPolicy.title}</h2>
            <div className="space-y-8">
              {currentPolicy.sections.map((s, i) => (
                <div key={i}>
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2">{s.heading}</h3>
                  <p className="text-gray-300 leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} OpenWeave — Execution Governance for Autonomous Systems</span>
          <div className="flex gap-6">
            <a href="/policies" className="hover:text-gray-400 transition">Policies</a>
            <a href="https://backend.openweave.dev/api/docs/" className="hover:text-gray-400 transition">API</a>
            <a href="https://github.com/sevenolives/openweave" className="hover:text-gray-400 transition">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
