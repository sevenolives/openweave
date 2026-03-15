import Link from 'next/link';
import PublicNav from '@/components/PublicNav';

export default function FromStateMachinesToGates() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: 'From State Machines to Gates: How We Simplified Execution Governance',
    description: 'We built a full state machine transition system with three models and an N×N matrix. Then we replaced it with two fields per state. Here\'s why.',
    datePublished: '2026-03-15T00:00:00Z',
    author: { '@type': 'Organization', name: 'OpenWeave Team' },
    publisher: { '@type': 'Organization', name: 'OpenWeave' },
    url: 'https://openweave.dev/blog/from-state-machines-to-gates',
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
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">governance</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">engineering</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">state machines</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">From State Machines to Gates: How We Simplified Execution Governance</h1>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span>By OpenWeave Team</span>
              <time dateTime="2026-03-15">March 15, 2026</time>
            </div>
          </header>

          <div className="prose prose-invert prose-emerald max-w-none prose-headings:font-semibold prose-headings:text-white prose-p:text-gray-300 prose-p:leading-relaxed prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-li:text-gray-300 prose-code:text-emerald-400 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-strong:text-white">

            <p className="text-lg text-gray-300 leading-relaxed">
              We built a full state machine transition system — three Django models, an N×N transition matrix, exception tables, approval gates. It was technically correct. It was also the wrong answer. Here&apos;s the story of how we threw it out and replaced it with two fields per state.
            </p>

            <h2>The Problem We Set Out to Solve</h2>

            <p>
              AI agents and bots are doing real work now. Not &quot;summarize this document&quot; work — real operational work. Moving tickets between states. Triggering deployments. Escalating incidents. Closing loops that used to require a human clicking buttons in a dashboard.
            </p>

            <p>
              That&apos;s powerful. It&apos;s also dangerous if nobody&apos;s controlling what these agents can and can&apos;t do.
            </p>

            <p>
              Imagine a bot that can move a ticket straight from &quot;New&quot; to &quot;Closed&quot; without it ever being worked. Or one that marks something &quot;Approved&quot; without a human ever reviewing it. These aren&apos;t hypothetical scenarios — they&apos;re the kind of things that happen when you give autonomous systems access to workflows without governance.
            </p>

            <p>
              The traditional answer to this is state machines with defined transitions. You map out every valid path through your workflow, and anything not explicitly allowed is denied. It&apos;s a well-understood pattern. So that&apos;s what we built.
            </p>

            <h2>What We Built First (The Complex Way)</h2>

            <p>
              Our first implementation had three models at its core:
            </p>

            <ul>
              <li><strong>StatusDefinition</strong> — the states themselves (New, In Progress, Review, Completed, etc.)</li>
              <li><strong>StatusTransition</strong> — the allowed paths between states (New → In Progress, In Progress → Review, etc.)</li>
              <li><strong>TransitionException</strong> — overrides for specific users or conditions</li>
            </ul>

            <p>
              Every valid path from state A to state B had to be explicitly defined in the transition table. If you had 8 states and wanted most of them to be reachable from most others, you were looking at potentially dozens of transition records. An N×N matrix where N is your number of states.
            </p>

            <p>
              Each transition could specify whether it was available to bots, humans, or both. Need a transition that&apos;s normally bot-only but one specific project manager should also be able to use it? That&apos;s what TransitionException was for.
            </p>

            <p>
              Then we added approval gates. Some transitions — particularly ones where a bot was moving something into a consequential state like &quot;Deployed&quot; or &quot;Approved&quot; — needed a human to sign off first. So we built an approval system layered on top of the transition system.
            </p>

            <p>
              The UI reflected this complexity. We had tabs within tabs: a <strong>Diagram</strong> view showing the state machine visually, a <strong>States</strong> tab to define your statuses, a <strong>Transitions</strong> tab for the N×N matrix, and an <strong>Exceptions</strong> tab for the overrides.
            </p>

            <p>
              It worked. It was technically correct. Every edge case was handled. And configuring it felt like programming a PLC.
            </p>

            <h2>The Moment of Clarity</h2>

            <p>
              We were onboarding a new team and walked them through setting up their workflow governance. Fifteen minutes in, we watched the team lead&apos;s eyes glaze over as we explained the difference between a transition exception and an approval gate.
            </p>

            <p>
              That night, we stepped back and asked ourselves a simple question: <strong>what are people actually trying to express when they configure governance?</strong>
            </p>

            <p>
              They&apos;re not thinking about paths. They&apos;re not thinking about which state leads to which other state and who can traverse each edge in the graph. They&apos;re thinking about <em>gates</em>.
            </p>

            <p>
              &quot;Who should be allowed to move things to <em>Completed</em>?&quot; — that&apos;s the real question.
            </p>

            <p>
              Not &quot;what transitions lead to Completed, and who can use each one, and what exceptions exist for each transition.&quot; That&apos;s the same question buried under three layers of indirection.
            </p>

            <p>
              The transition matrix was an answer to a question nobody was asking. People don&apos;t think in edges. They think in destinations. &quot;Who can enter this state?&quot; and &quot;Where can you come from to get here?&quot; — those are the natural questions. Everything else is implementation detail.
            </p>

            <h2>What We Built Instead (The Simple Way)</h2>

            <p>
              Two fields per state. That&apos;s the entire new system.
            </p>

            {/* Before/After Visual */}
            <div className="not-prose my-10 grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-3">Before</div>
                <div className="text-2xl font-bold text-white mb-4">3 Models</div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">×</span> StatusDefinition</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">×</span> StatusTransition (N×N matrix)</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">×</span> TransitionException</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">×</span> Approval gates (separate system)</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">×</span> 6 API endpoints</li>
                  <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">×</span> Tabs within tabs UI</li>
                </ul>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-3">After</div>
                <div className="text-2xl font-bold text-white mb-4">2 Fields</div>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> <strong className="text-white">Who can enter</strong> — Everyone, or pick specific users</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> <strong className="text-white">Allowed from</strong> — Any state, or pick source states</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> 2 API endpoints</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> One clean view</li>
                </ul>
              </div>
            </div>

            <p>
              <strong>Who can enter</strong>: defaults to Everyone. Want to restrict a state? Pick the specific users or roles who should be able to move things there.
            </p>

            <p>
              <strong>Allowed from</strong>: defaults to Any State. Want to enforce a pipeline? Pick which states something must be in before it can move here.
            </p>

            <p>
              No transition table. No exception records. No separate approval gate concept.
            </p>

            <p>
              Want approval-style control? Only allow specific humans to enter &quot;Completed.&quot; Bots can do everything up to that point, but a human has to move it across the finish line. That&apos;s not a special approval gate feature — it&apos;s just setting &quot;who can enter&quot; on one state.
            </p>

            <p>
              Want a strict pipeline where things must go New → In Progress → Review → Done in order? Set &quot;allowed from&quot; on each state to only allow the previous one. No transition matrix needed.
            </p>

            <p>
              Want it wide open because your team is small and you trust each other? Leave everything on &quot;Everyone&quot; and &quot;Any State.&quot; Zero configuration required.
            </p>

            <p>
              Same outcomes. Every scenario the old system handled, the new system handles. A fraction of the complexity.
            </p>

            <h2>Why Simpler Wins for Governance</h2>

            <p>
              Here&apos;s the uncomfortable truth about governance tools: <strong>the ones that are hard to configure don&apos;t get configured.</strong>
            </p>

            <p>
              We&apos;ve seen this across the industry. Teams buy sophisticated governance platforms, go through a painful setup process, get something &quot;close enough&quot; configured, and then never touch it again — even as their workflows evolve and the governance rules become stale.
            </p>

            <p>
              Unconfigured governance is no governance. A beautifully designed transition matrix that nobody updates when new states are added is worse than useless — it&apos;s a false sense of security.
            </p>

            <p>
              The best governance is the kind people actually use. And people use things that are easy to understand and quick to change.
            </p>

            <p>
              Our competitors show you dashboards full of flowcharts and compliance metrics. They give you powerful, flexible configuration systems that can model any workflow imaginable. And then they wonder why adoption stalls after the initial setup.
            </p>

            <p>
              We give you two dropdowns per state.
            </p>

            <blockquote className="border-l-2 border-emerald-500 pl-4 my-8 text-gray-300 italic">
              &quot;Others observe. We enforce. And we make enforcement simple enough that you&apos;ll actually do it.&quot;
            </blockquote>

            <h2>Technical Details (for the Engineers)</h2>

            <p>
              If you want the nuts and bolts, here&apos;s what changed under the hood.
            </p>

            <p>
              <strong>The old system</strong> had three Django models — <code>StatusDefinition</code>, <code>StatusTransition</code>, and <code>TransitionException</code> — each with their own ViewSet and serializer. Validation logic had to check transitions first, then look for exceptions, then evaluate approval gates. The flow was roughly:
            </p>

            <ol>
              <li>Is there a StatusTransition from current state to target state?</li>
              <li>Does the user type (bot/human) match the transition&apos;s allowed user types?</li>
              <li>If not, is there a TransitionException that grants this specific user access?</li>
              <li>Is there an approval gate on this transition? If so, has it been satisfied?</li>
            </ol>

            <p>
              That&apos;s four checks in sequence, hitting three different tables, with branching logic at each step.
            </p>

            <p>
              <strong>The new system</strong> adds two many-to-many fields directly on the existing <code>StatusDefinition</code> model: <code>allowed_users</code> (who can enter) and <code>allowed_from_statuses</code> (valid source states). Validation is roughly ten lines:
            </p>

            <ol>
              <li>Does the target state have <code>allowed_users</code> set? If yes, is the current user in that list? If no entries, everyone is allowed.</li>
              <li>Does the target state have <code>allowed_from_statuses</code> set? If yes, is the current state in that list? If no entries, any source state is allowed.</li>
            </ol>

            <p>
              Two checks. One table. No branching.
            </p>

            <p>
              The migration was non-destructive. We kept the old models as deprecated — they still exist in the codebase and the data is preserved. The new fields were added alongside them. Teams can migrate at their own pace, and we built a one-click migration tool that reads the old transition matrix and infers the equivalent gate configuration.
            </p>

            <p>
              The API surface shrank from six endpoints (CRUD for transitions, CRUD for exceptions, plus the approval gate endpoints) to two: the existing status definition endpoint now includes the gate fields, and a validation endpoint to test whether a proposed state change would be allowed.
            </p>

            <h2>What This Means for You</h2>

            <p>
              <strong>If you&apos;re already using OpenWeave:</strong> your state machine configuration just got dramatically simpler. The old transition-based system still works — nothing breaks. But we&apos;d encourage you to try the new gate-based approach. Most teams find they can replicate their existing governance rules in a few minutes, and the result is much easier to maintain.
            </p>

            <p>
              <strong>If you&apos;re evaluating governance tools:</strong> this is what we think governance should feel like. Not a project unto itself. Not something that requires a consultant to set up. Two questions per state: who can enter, and from where? That&apos;s governance you&apos;ll actually maintain.
            </p>

            <p>
              <strong>If you&apos;re building your own system:</strong> before you build a transition table, ask yourself whether you actually need to model edges — or just gates. In our experience, the vast majority of real-world governance requirements are about controlling entry to states, not controlling the paths between them. Start with gates. You can always add transitions later if you genuinely need them. (You probably won&apos;t.)
            </p>

            <div className="not-prose mt-12 p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <p className="text-sm text-gray-400">
                OpenWeave is execution governance for autonomous systems — bots, agents, and AI doing real work inside your workflows.{' '}
                <Link href="/" className="text-emerald-400 hover:underline">Learn more →</Link>
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
