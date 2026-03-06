from django.core.management.base import BaseCommand
from django.utils import timezone
from tickets.models import BlogPost, User


POSTS = [
    {
        "title": "Why Autonomous Agents Need Execution Governance",
        "slug": "why-autonomous-agents-need-execution-governance",
        "excerpt": "As AI agents proliferate across enterprise workflows, the absence of execution governance creates systemic risk. Learn why deterministic control infrastructure is essential.",
        "meta_title": "Why Autonomous Agents Need Execution Governance | AgentJunction",
        "meta_description": "Discover why autonomous AI agents require execution governance to prevent uncontrolled state mutations, ensure auditability, and maintain operational integrity.",
        "tags": "execution-governance,autonomous-agents,ai-safety,compliance",
        "content": """<p>The rapid proliferation of autonomous AI agents across enterprise environments has introduced a fundamental problem: <strong>who governs what agents actually do?</strong></p>

<p>Most organizations deploying AI agents focus on prompt engineering, model selection, and output quality. These are important concerns. But they miss the deeper issue — once an agent is authorized to take actions in a system, the question shifts from "what does it say?" to "what does it do?"</p>

<h2>The Execution Gap</h2>

<p>Today's agent frameworks excel at orchestration — chaining LLM calls, tool use, and retrieval. What they lack is <em>execution governance</em>: the infrastructure layer that ensures every action an agent takes is validated against predefined rules before it's committed.</p>

<p>Without execution governance, agents operate in a permissive environment. They can transition tickets to invalid states, bypass approval workflows, or create cascading side effects that no human authorized. The system trusts the agent implicitly, and that trust is unearned.</p>

<h2>What Execution Governance Means</h2>

<p>Execution governance is not prompt monitoring. It's not model safety scoring. It's not analytics dashboards showing what agents did after the fact. It is <strong>runtime enforcement of state transition rules</strong> at the infrastructure level.</p>

<p>This means:</p>
<ul>
<li>Every state mutation is validated against a defined state machine before it's persisted</li>
<li>Agents cannot skip states, bypass approvals, or reach terminal states without authorization</li>
<li>Every action is logged with full context — who, what, when, and the transition path</li>
<li>Human and bot actors follow the same rules, enforced by the same backend</li>
</ul>

<h2>Why This Matters Now</h2>

<p>As enterprises move from single-agent experiments to multi-agent deployments, the coordination problem becomes critical. Without a governance layer, you're not deploying agents — you're deploying chaos with a friendly API.</p>

<p>AgentJunction was built to solve this problem. It provides deterministic execution governance for autonomous systems, ensuring that every agent action is validated, authorized, and auditable. Because autonomy without authority isn't intelligence — it's liability.</p>"""
    },
    {
        "title": "The Problem with Uncontrolled Bot Workflows",
        "slug": "the-problem-with-uncontrolled-bot-workflows",
        "excerpt": "Bot workflows without enforcement infrastructure create invisible risks. Here's why permissive agent architectures fail at scale and what to do about it.",
        "meta_title": "The Problem with Uncontrolled Bot Workflows | AgentJunction",
        "meta_description": "Uncontrolled bot workflows create cascading failures, compliance gaps, and untraceable state mutations. Learn why enforcement infrastructure is non-negotiable.",
        "tags": "bot-workflows,risk-management,agent-architecture,enforcement",
        "content": """<p>Every organization running bot workflows faces the same hidden risk: <strong>permissive execution</strong>. Bots are given API keys, granted permissions, and trusted to follow the rules. But most architectures provide no mechanism to enforce those rules at runtime.</p>

<h2>The Permissive Default</h2>

<p>Consider a typical support automation setup. A bot agent receives a ticket, processes it, and updates the status. In most systems, the bot can set any status it wants — open, in-progress, resolved, closed — regardless of the current state or the defined workflow. The API accepts the mutation, the database commits it, and the workflow is corrupted.</p>

<p>This isn't a theoretical concern. It happens constantly in production environments where bots operate without state machine enforcement. A bot skips "in-progress" and jumps straight to "resolved." Another bot reopens a ticket that was already closed. A third bot creates a circular transition loop that breaks reporting dashboards.</p>

<h2>Why Monitoring Isn't Enough</h2>

<p>The typical response is monitoring — add logging, build dashboards, alert on anomalies. But monitoring is reactive. By the time you detect an invalid state transition, the damage is done. The ticket has been misrouted, the customer has received the wrong notification, the SLA clock has been reset incorrectly.</p>

<p>What's needed is <em>preventive enforcement</em>: the system should reject invalid transitions before they're committed, not flag them after the fact.</p>

<h2>The Architecture Problem</h2>

<p>The root cause is architectural. Most bot frameworks treat the backend as a dumb data store. The bot decides what to do, and the API writes it down. There's no validation layer between intent and execution.</p>

<p>AgentJunction inverts this model. The backend is the sole authority on valid state transitions. Every mutation — whether from a human agent, a bot, or an API call — is validated against the workspace's state machine before it's persisted. Invalid transitions are rejected with clear error messages. Valid transitions are committed and logged.</p>

<p>This is the difference between a workflow system and a governance system. Workflows describe what should happen. Governance ensures it does.</p>"""
    },
    {
        "title": "How AgentJunction Enforces Deterministic Agent Execution",
        "slug": "how-agentjunction-enforces-deterministic-agent-execution",
        "excerpt": "AgentJunction's backend-enforced state machines ensure every agent action is validated, authorized, and auditable. Here's how the architecture works.",
        "meta_title": "How AgentJunction Enforces Deterministic Agent Execution | AgentJunction",
        "meta_description": "Learn how AgentJunction uses backend-enforced state machines, transition rules, and audit logging to ensure deterministic execution for autonomous agents.",
        "tags": "agentjunction,state-machines,deterministic-execution,architecture",
        "content": """<p>AgentJunction is execution governance infrastructure for autonomous systems. It ensures that every action taken by an agent — human or AI — is validated against predefined rules before it's committed. Here's how the architecture enforces deterministic execution.</p>

<h2>Backend-Enforced State Machines</h2>

<p>At the core of AgentJunction is a configurable state machine system. Each workspace defines its own set of statuses and valid transitions between them. These aren't suggestions or UI hints — they're enforced at the API layer.</p>

<p>When any actor (human or bot) attempts to change a ticket's status, the backend checks:</p>
<ol>
<li>Is the transition from the current status to the requested status defined in the state machine?</li>
<li>Is the actor type (human or bot) authorized to make this specific transition?</li>
<li>Are all preconditions met (e.g., required fields populated)?</li>
</ol>

<p>If any check fails, the mutation is rejected. The state is never corrupted.</p>

<h2>Actor-Type Authorization</h2>

<p>Not all transitions should be available to all actors. AgentJunction's transition rules include an <code>actor_type</code> field that specifies whether a transition can be performed by humans, bots, or both. This means you can design workflows where bots handle triage and initial processing, but only humans can approve escalations or close tickets.</p>

<h2>Complete Audit Trail</h2>

<p>Every state change generates an immutable audit log entry containing the actor, the transition, the old and new values, and the timestamp. This isn't optional logging that can be turned off — it's structural. The audit trail is the system's memory, and it's used for compliance reporting, debugging, and accountability.</p>

<h2>Workspace Isolation</h2>

<p>Each workspace operates independently with its own state machines, transition rules, and agent configurations. This means teams can define workflows that match their specific processes without affecting other workspaces. A customer support team's workflow is completely separate from an engineering team's bug tracking workflow.</p>

<h2>The Result</h2>

<p>The result is deterministic execution. Given the same state and the same action, the system always produces the same outcome. Agents can't drift, workflows can't be corrupted, and every action is traceable. This is what execution governance means in practice — not observing what agents do, but controlling what they're allowed to do.</p>"""
    },
]


class Command(BaseCommand):
    help = 'Seed blog posts for AgentJunction'

    def handle(self, *args, **options):
        author = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if not author:
            self.stderr.write("No users found. Create a user first.")
            return

        for post_data in POSTS:
            obj, created = BlogPost.objects.update_or_create(
                slug=post_data['slug'],
                defaults={
                    **post_data,
                    'author': author,
                    'is_published': True,
                    'published_at': timezone.now(),
                }
            )
            status = 'Created' if created else 'Updated'
            self.stdout.write(f"{status}: {obj.title}")

        self.stdout.write(self.style.SUCCESS(f"Done. {len(POSTS)} blog posts seeded."))
