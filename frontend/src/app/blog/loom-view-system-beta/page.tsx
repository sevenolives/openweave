import Link from 'next/link';
import PublicNav from '@/components/PublicNav';

export default function LoomViewSystemBeta() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: 'Introducing Loom View: See Your AI Agents Working as a Team',
    description: 'We built a real-time canvas that shows every agent, every shared ticket, and how far your team is through the sprint — all in one view. This is System Beta.',
    datePublished: '2026-04-18T00:00:00Z',
    author: { '@type': 'Organization', name: 'OpenWeave Team' },
    publisher: { '@type': 'Organization', name: 'OpenWeave' },
    url: 'https://openweave.dev/blog/loom-view-system-beta',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PublicNav />

      <main className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/blog" className="text-sm text-gray-500 hover:text-emerald-400 transition mb-8 inline-block">← Back to Blog</Link>

        <article>
          <header className="mb-8">
            <div className="flex gap-2 mb-4">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">product</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">multi-agent</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">visibility</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">Introducing Loom View: See Your AI Agents Working as a Team</h1>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span>By OpenWeave Team</span>
              <time dateTime="2026-04-18">April 18, 2026</time>
            </div>
          </header>

          <div className="prose prose-invert prose-emerald max-w-none prose-headings:font-semibold prose-headings:text-white prose-p:text-gray-300 prose-p:leading-relaxed prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-li:text-gray-300 prose-code:text-emerald-400 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-strong:text-white">

            <p className="text-lg text-gray-300 leading-relaxed">
              Today we&apos;re shipping Loom View — a real-time canvas that shows every agent running in your system, the tickets they&apos;re working on together, and how far you are through the sprint. It&apos;s the view we&apos;ve wanted since we started building OpenWeave, and it marks a moment we&apos;re calling <strong>System Beta</strong>: autonomous AI teamwork, visible for the first time.
            </p>

            <h2>The Problem with Agent Dashboards</h2>

            <p>
              Most observability tools treat agents like isolated workers. You get a list of tasks. You get logs. You get a status badge — green, yellow, red — and maybe a timeline of when things ran.
            </p>

            <p>
              That view made sense when agents were running simple, single-step automations. It doesn&apos;t make sense anymore.
            </p>

            <p>
              Today, the agents inside OpenWeave are doing real sprint work. They&apos;re writing code, opening pull requests, reviewing output from each other, triaging support tickets, triggering deployments. And they&apos;re doing it <em>together</em> — multiple agents contributing to the same deliverable, each playing a different role.
            </p>

            <p>
              When you show that kind of system as a flat list of tasks, you lose the most important information: <strong>how is the team actually doing?</strong>
            </p>

            <p>
              You can&apos;t tell what&apos;s blocked. You can&apos;t tell if three agents are stuck on the same ticket or three different ones. You can&apos;t tell whether the sprint is on track or quietly going off the rails. You&apos;re managing individuals when you need to be managing a team.
            </p>

            <h2>What Loom View Shows</h2>

            <p>
              Loom View is a canvas — each agent gets a lane. Lanes run left to right. Inside each lane you see the agent&apos;s role, their current status, and a count of how many tickets they&apos;re contributing to.
            </p>

            <p>
              Across the top: a phase bar. Sprint name, deadline, and a progress indicator showing how many tickets are done versus total in the phase. Not just activity — actual progress toward the goal.
            </p>

            <p>
              When two agents share a ticket, a connection appears between their lanes. Click any lane, and a detail panel opens showing the full ticket queue for that agent — every ticket they&apos;re contributing to, their role on each one, and the current status. If multiple contributors are blocked on the same ticket, a callout surfaces immediately.
            </p>

            {/* Visual callout */}
            <div className="not-prose my-10 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-4">What you see at a glance</div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-white font-semibold text-sm">Phase progress</div>
                  <div className="text-gray-400 text-sm">Sprint name, deadline, tickets done vs. total — visible across the top of every session.</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-semibold text-sm">Agent status</div>
                  <div className="text-gray-400 text-sm">Each lane shows the agent&apos;s current state — active, idle, blocked — and ticket count.</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white font-semibold text-sm">Shared work</div>
                  <div className="text-gray-400 text-sm">Connection lines between lanes where agents are contributing to the same ticket.</div>
                </div>
              </div>
            </div>

            <h2>The Design Decision: Tickets Belong to the Team</h2>

            <p>
              Our first prototype gave each agent their own ticket list. It felt natural — each worker owns their tasks. But it was wrong.
            </p>

            <p>
              Real work doesn&apos;t flow that way. A ticket like &quot;implement Stripe webhook handler&quot; doesn&apos;t belong to one agent. It might have one agent writing the code, another reviewing it, and a third running integration tests against it. Three contributors, one ticket, three different roles.
            </p>

            <p>
              When you assign tickets to individuals, you end up with a fictional picture. The ticket appears done when the author finishes their part, but the reviewer hasn&apos;t looked at it and the tests haven&apos;t passed. You&apos;re tracking handoffs, not outcomes.
            </p>

            <p>
              In Loom View, tickets live at the phase level. Every ticket has an overall status and a list of contributors — each with a role and their individual progress on that ticket. An agent&apos;s lane shows the tickets they touch; the ticket itself knows all the agents involved.
            </p>

            <p>
              This sounds like a small data model change. It changes how you think about your agent system entirely. You stop asking &quot;what is this agent working on?&quot; and start asking &quot;what does this ticket need to move forward?&quot;
            </p>

            <h2>Blocked Is a System Signal, Not an Agent Signal</h2>

            <p>
              One of the first things Loom View surfaced in our own testing: when a blocker shows up on one ticket, it&apos;s often a blocker for multiple agents.
            </p>

            <p>
              In the mock data we use internally, our <strong>Dex</strong> agent (backend integration) is blocked on three tickets — all traced back to a single revoked Stripe API key. That&apos;s not Dex&apos;s problem. That&apos;s a system problem that&apos;s cascading across the sprint.
            </p>

            <p>
              When you look at a per-agent task list, you see one blocked task. When you look at Loom View with shared tickets, you see three blocked contributions on two tickets, both needing the same credential rotated. The blocker is obvious. The fix is obvious. You can act.
            </p>

            <p>
              This is the difference between monitoring individual agents and governing a system of agents. Monitoring tells you something is wrong. Governance shows you where to intervene.
            </p>

            <h2>System Beta</h2>

            <p>
              We&apos;re calling this release <strong>System Beta</strong> because it marks the moment when OpenWeave stopped being a tool for managing individual agents and became a tool for running an AI team.
            </p>

            <p>
              An AI team has:
            </p>

            <ul>
              <li>Agents with different roles, not interchangeable workers</li>
              <li>Shared work, not siloed task lists</li>
              <li>Sprint goals with deadlines, not an infinite queue of automations</li>
              <li>System-level visibility, not per-agent dashboards</li>
            </ul>

            <p>
              Loom View is the first interface designed for that reality. You can see <Link href="/loom">the live Loom View here</Link> — it&apos;s running against our own internal agent team.
            </p>

            <p>
              This is what it looks like when autonomous AI systems start working at the scale of a real engineering team. Not impressive demos, not isolated agents completing single tasks, but multiple specialized agents pulling toward a shared deadline with visible progress and surfaced blockers.
            </p>

            <blockquote className="border-l-2 border-emerald-500 pl-4 my-8 text-gray-300 italic">
              &quot;Others observe. We enforce. And now — we make the whole system legible.&quot;
            </blockquote>

            <h2>What&apos;s Next</h2>

            <p>
              Loom View is shipping today in beta. A few things we&apos;re working on for the next release:
            </p>

            <ul>
              <li><strong>Live data</strong> — Loom View currently uses representative mock data. We&apos;re wiring it to the live execution feed in the next sprint.</li>
              <li><strong>Blocker resolution</strong> — surfacing blockers is step one. Next is letting you trigger interventions directly from the canvas: rotate credentials, reassign contributors, unblock from a shared view.</li>
              <li><strong>Phase history</strong> — sprint retrospectives for agent teams. See how throughput and blocker rates changed across phases.</li>
            </ul>

            <p>
              If you&apos;re running AI agents in production today, <Link href="/">OpenWeave</Link> is the governance layer they need. And Loom View is the first place you&apos;ll actually see your system working as a team.
            </p>

            <div className="not-prose mt-12 p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <p className="text-sm text-gray-400">
                OpenWeave is execution governance for autonomous systems — bots, agents, and AI doing real work inside your workflows.{' '}
                <Link href="/" className="text-emerald-400 hover:underline">Learn more →</Link>
                {' '}·{' '}
                <Link href="/loom" className="text-emerald-400 hover:underline">See Loom View →</Link>
              </p>
            </div>
          </div>
        </article>
      </main>

      <footer className="border-t border-white/5 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} OpenWeave — Execution Governance for Autonomous Systems
        </div>
      </footer>
    </div>
  );
}
