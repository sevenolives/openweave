from django.core.management.base import BaseCommand
from django.utils import timezone
from tickets.models import BlogPost, User
import uuid


class Command(BaseCommand):
    help = 'Add a new blog post for OpenWeave'

    def handle(self, *args, **options):
        author = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if not author:
            self.stderr.write("No users found. Create a user first.")
            return

        # New blog post for March 27, 2026
        post_data = {
            "title": "State Machine Architecture for Multi-Agent Coordination",
            "slug": "state-machine-architecture-multi-agent-coordination",
            "excerpt": "As multi-agent systems scale, coordination becomes the bottleneck. Learn how state machine architecture provides the deterministic control layer for reliable agent orchestration.",
            "meta_title": "State Machine Architecture for Multi-Agent Coordination | OpenWeave",
            "meta_description": "Explore how state machine architecture enables reliable multi-agent coordination through deterministic state transitions, conflict resolution, and synchronized execution patterns.",
            "tags": "multi-agent-systems,state-machines,coordination,architecture,orchestration",
            "content": """<p>The shift from single AI agents to multi-agent systems introduces a fundamental challenge: <strong>how do you coordinate autonomous actors without chaos?</strong> The answer lies in state machine architecture — a deterministic framework that provides the control layer multi-agent systems need to operate reliably.</p>

<h2>The Multi-Agent Coordination Problem</h2>

<p>When a single agent operates in isolation, coordination is simple — there's only one actor making decisions. But as soon as you introduce multiple agents working toward shared goals, complexity explodes exponentially. Agents can conflict with each other, race for the same resources, or create circular dependencies that deadlock the system.</p>

<p>Consider a customer support scenario with three specialized agents: a <em>triager</em> that categorizes incoming tickets, a <em>researcher</em> that gathers context from knowledge bases, and a <em>responder</em> that drafts replies. Without coordination infrastructure, these agents can overwrite each other's work, duplicate efforts, or leave tickets in inconsistent states.</p>

<h2>Why Event-Based Coordination Fails</h2>

<p>Many multi-agent frameworks rely on event-driven architectures — agents publish events when they complete tasks, and other agents subscribe to relevant events. This seems elegant in theory, but it creates several problems in practice:</p>

<ul>
<li><strong>Race conditions:</strong> Multiple agents can receive the same event simultaneously and attempt conflicting actions</li>
<li><strong>Event ordering:</strong> Events can arrive out of sequence, causing agents to process stale information</li>
<li><strong>Failure modes:</strong> If an agent crashes between receiving an event and updating state, the system becomes inconsistent</li>
<li><strong>Debugging complexity:</strong> Tracing execution paths through event chains becomes nearly impossible at scale</li>
</ul>

<h2>State Machines as Coordination Infrastructure</h2>

<p>State machine architecture solves these problems by centralizing state transitions and making them atomic. Instead of agents directly modifying shared state, they submit transition requests to a state machine engine that validates, authorizes, and commits changes as single operations.</p>

<p>Here's how this works in practice:</p>

<ol>
<li><strong>Centralized State Authority:</strong> A single backend service owns the canonical state of all shared resources (tickets, projects, documents)</li>
<li><strong>Transition-Based Updates:</strong> Agents don't set status fields directly — they request transitions like "start_research" or "submit_draft"</li>
<li><strong>Atomic Validation:</strong> Each transition is validated against predefined rules before being committed</li>
<li><strong>Conflict Resolution:</strong> When multiple agents attempt conflicting transitions, the state machine resolves them deterministically</li>
</ol>

<h2>Implementing Multi-Agent State Machines</h2>

<p>OpenWeave implements this pattern through workspace-scoped state machines. Each workspace defines:</p>

<ul>
<li><strong>States:</strong> Valid statuses for tickets or tasks (e.g., "new", "triaging", "researching", "drafting", "complete")</li>
<li><strong>Transitions:</strong> Allowed movements between states with preconditions and actor types</li>
<li><strong>Coordination Rules:</strong> Logic for handling simultaneous requests from multiple agents</li>
</ul>

<p>For example, a ticket in "triaging" state might allow the triager agent to transition to "needs_research", but prevent the responder agent from jumping directly to "drafting". This ensures each agent operates within its domain while maintaining system-wide consistency.</p>

<h2>Synchronization Patterns</h2>

<p>State machine coordination enables several powerful synchronization patterns:</p>

<h3>Sequential Processing</h3>
<p>Agents work in a defined order, with each agent's completion triggering the next agent's activation. The state machine enforces the sequence and prevents premature transitions.</p>

<h3>Parallel Decomposition</h3>
<p>A task is split into parallel sub-tasks, each handled by different agents. The state machine tracks completion of all sub-tasks before allowing progression to the next phase.</p>

<h3>Conditional Routing</h3>
<p>Based on intermediate results, the state machine can route tasks to different specialist agents. Complex cases go to human escalation; simple cases continue through automation.</p>

<h2>Fault Tolerance and Recovery</h2>

<p>State machine architecture provides natural fault tolerance. If an agent crashes during processing, the shared state remains consistent — the agent was never able to commit an invalid transition. When the agent restarts, it can query the current state and resume from the last valid checkpoint.</p>

<p>This is impossible with event-based systems, where agent failures can leave the system in an unknown state.</p>

<h2>Observability and Debugging</h2>

<p>Every state transition is logged with full context: which agent requested it, what the preconditions were, and what changed. This creates a complete audit trail that makes debugging multi-agent interactions straightforward.</p>

<p>Instead of trying to trace causality through event logs scattered across multiple services, you have a single, ordered history of every decision made by every agent in the system.</p>

<h2>The Path Forward</h2>

<p>As AI capabilities advance and multi-agent deployments become standard, coordination architecture will determine which systems succeed at scale. Event-driven patterns might work for demonstrations, but production systems need the deterministic control that only state machine coordination can provide.</p>

<p>OpenWeave was built with this insight from day one. Every workspace operates as a distributed state machine, ensuring that multi-agent coordination is reliable, auditable, and debuggable. Because in autonomous systems, predictable behavior isn't a nice-to-have — it's the foundation everything else is built on.</p>"""
        }

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

        self.stdout.write(self.style.SUCCESS("New blog post added successfully!"))