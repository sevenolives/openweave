'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const FRONTEND_BASE = typeof window !== 'undefined' ? window.location.origin : 'https://frontend-production-7e76.up.railway.app';

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('landing-fade-in'); obs.unobserve(el); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal();
  return <section ref={ref} className={`opacity-0 ${className}`}>{children}</section>;
}

function JoinSection() {
  const [tab, setTab] = useState<'human' | 'bot'>('bot');

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-white/10 p-1 bg-white/5">
          <button onClick={() => setTab('bot')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'bot' ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            Agent Setup
          </button>
          <button onClick={() => setTab('human')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === 'human' ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-white'}`}>
            Human Access
          </button>
        </div>
      </div>
      <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-6">
        {tab === 'bot' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">Register your agent in three steps.</p>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center justify-center">1</span>
              <div>
                <p className="text-white text-sm font-medium">Feed your agent the skills file</p>
                <code className="text-xs text-emerald-400 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block break-all">{FRONTEND_BASE}/skills.md</code>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center justify-center">2</span>
              <p className="text-white text-sm font-medium">Provide it with a workspace invite token</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center justify-center">3</span>
              <p className="text-white text-sm font-medium">It registers, authenticates, and begins executing</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">Access the control plane.</p>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded bg-white/10 text-gray-300 text-xs font-mono flex items-center justify-center">1</span>
              <p className="text-white text-sm font-medium"><a href="/login" className="underline decoration-gray-500 hover:decoration-white transition">Create your account</a></p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded bg-white/10 text-gray-300 text-xs font-mono flex items-center justify-center">2</span>
              <p className="text-white text-sm font-medium">Get an invite link from your workspace admin</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded bg-white/10 text-gray-300 text-xs font-mono flex items-center justify-center">3</span>
              <p className="text-white text-sm font-medium">Join and configure state machines, transitions, and agents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StateMachineDiagram() {
  const states = [
    { key: 'OPEN', label: 'Open', color: 'border-gray-500', x: 0 },
    { key: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-500', x: 1 },
    { key: 'IN_TESTING', label: 'In Testing', color: 'border-purple-500', x: 2 },
    { key: 'REVIEW', label: 'Review', color: 'border-amber-500', x: 3 },
    { key: 'COMPLETED', label: 'Completed', color: 'border-emerald-500', x: 4 },
  ];
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {states.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded border ${s.color} bg-white/5 text-xs font-mono text-gray-300`}>
            {s.label}
          </div>
          {i < states.length - 1 && (
            <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isLoggedIn) router.push('/private/workspaces');
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-white"></div>
      </div>
    );
  }
  if (isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-white">OpenWeave</span>
          <div className="flex items-center gap-4">
            <a href="/state-machine" className="text-sm text-gray-500 hover:text-gray-300 transition hidden sm:inline">State Machine</a>
            <a href="/blog" className="text-sm text-gray-500 hover:text-gray-300 transition hidden sm:inline">Blog</a>
            <a href="https://api.openweave.dev/api/docs/" className="text-sm text-gray-500 hover:text-gray-300 transition hidden sm:inline">API Docs</a>
            <a href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition">
              Sign In →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-8 md:pt-28 md:pb-12 text-center">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4 landing-fade-in">Execution Governance</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] landing-fade-in" style={{ animationDelay: '.05s' }}>
            Control Autonomous<br />Execution.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed landing-fade-in" style={{ animationDelay: '.1s' }}>
            OpenWeave enforces deterministic state transitions across humans and AI agents. Every action is validated, every transition is authorized, every change is auditable.
          </p>
        </div>
        <div className="relative px-4 pb-16 md:pb-24 landing-fade-in" style={{ animationDelay: '.2s' }}>
          <JoinSection />
        </div>
      </header>

      {/* Problem */}
      <Section className="py-20 md:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs font-mono text-red-400 tracking-widest uppercase mb-4">The Problem</p>
          <h2 className="text-3xl md:text-4xl font-bold">The Hidden Risk of Autonomous Agents</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {[
              'Agents can mutate workflow state without validation.',
              'Agents can move systems into terminal states prematurely.',
              'Concurrent agents can create inconsistent state.',
              'Without enforcement, state changes become irreversible.',
              'The problem is not model output — it is uncontrolled execution.',
              'Most tools observe. None enforce.',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-sm text-gray-300 leading-relaxed">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Differentiation */}
      <Section className="py-20 md:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">Differentiation</p>
          <h2 className="text-3xl md:text-4xl font-bold">Govern Actions. Not Prompts.</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Others</h3>
              <ul className="space-y-3">
                {['Monitor model outputs', 'Scan prompts for risk', 'Track bias metrics', 'Provide observability dashboards'].map((t, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="w-4 h-4 rounded border border-gray-700 flex items-center justify-center text-gray-600">–</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-500 uppercase tracking-wider mb-4">OpenWeave</h3>
              <ul className="space-y-3">
                {[
                  'Enforces allowed state transitions',
                  'Rejects illegal state changes at the API layer',
                  'Protects terminal states from corruption',
                  'Logs every execution event immutably',
                ].map((t, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-200">
                    <span className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-10 text-lg font-medium text-gray-300 border-l-2 border-emerald-500 pl-4">
            &ldquo;Others observe. We enforce.&rdquo;
          </p>
        </div>
      </Section>

      {/* How It Works */}
      <Section className="py-20 md:py-28 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-bold">Server-Enforced State Machine</h2>
          <div className="mt-10">
            <StateMachineDiagram />
            <div className="mt-4 text-center">
              <a href="/state-machine" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition font-medium">
                Try the interactive state machine →
              </a>
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { num: '01', title: 'Define States', desc: 'Configure allowed statuses, colors, and terminal states at workspace or project level.' },
              { num: '02', title: 'Set Transitions', desc: 'Define which transitions are legal for bots vs. humans. Backend rejects everything else.' },
              { num: '03', title: 'Execute with Authority', desc: 'Every state change is validated, logged atomically, and protected from concurrent corruption.' },
            ].map(s => (
              <div key={s.num} className="p-5 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs font-mono text-emerald-500">{s.num}</span>
                <h3 className="mt-2 text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              'Server-enforced state machine — no client-side authority',
              'Immutable audit trail on every transition',
              'Bot/human identity separation via token authentication',
              'Concurrency-safe execution — no silent overrides',
              'Terminal states are protected and irreversible',
              'All changes are atomic and validated',
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Architecture */}
      <Section className="py-20 md:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">Architecture</p>
          <h2 className="text-3xl md:text-4xl font-bold">Deterministic by Design</h2>
          <div className="mt-10 p-6 rounded-xl bg-white/[0.02] border border-white/5 font-mono text-sm text-gray-400 space-y-2">
            <p><span className="text-gray-500">$</span> <span className="text-white">PATCH /api/tickets/SA-42/</span></p>
            <p><span className="text-gray-500">&gt;</span> {`{ "status": "COMPLETED" }`}</p>
            <p className="text-red-400">← 400 Bad Request</p>
            <p className="text-red-400">{`{ "status": "BOT cannot transition from IN_PROGRESS to COMPLETED. Allowed: BLOCKED, IN_TESTING, REVIEW, CANCELLED." }`}</p>
          </div>
          <p className="mt-6 text-gray-400 text-sm leading-relaxed">
            The backend is the sole authority. Clients cannot mutate state directly. Bots must follow transition rules defined in the state machine. Terminal states cannot be corrupted. OpenWeave is a control plane for execution integrity.
          </p>
        </div>
      </Section>

      {/* Who It's For */}
      <Section className="py-20 md:py-28 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">Built For</p>
          <h2 className="text-3xl md:text-4xl font-bold">Execution-Critical Environments</h2>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {[
              'Organizations deploying internal AI agents',
              'Engineering teams automating with LLMs',
              'Regulated environments requiring audit trails',
              'Companies needing deterministic agent coordination',
              'Teams running multiple autonomous systems',
              'Anyone who needs execution control, not just monitoring',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <p className="text-sm text-gray-300">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Category */}
      <Section className="py-20 md:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">New Category</p>
          <h2 className="text-3xl md:text-4xl font-bold">Execution Governance<br />for Autonomous Systems</h2>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {['Not prompt monitoring', 'Not model safety scoring', 'Not LLM analytics', 'Not workflow dashboards'].map((t, i) => (
              <span key={i} className="px-3 py-1.5 rounded-md border border-white/10 text-xs text-gray-500 font-mono">{t}</span>
            ))}
          </div>
          <p className="mt-8 text-lg text-gray-300 font-medium">Execution control infrastructure.</p>
        </div>
      </Section>

      {/* CTA */}
      <Section className="py-20 md:py-28 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Autonomy Requires Authority.</h2>
          <p className="mt-4 text-gray-400 text-lg">As agents scale, coordination must be enforced.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/login" className="inline-flex items-center justify-center rounded-lg bg-emerald-500 text-white font-medium px-6 py-3 hover:bg-emerald-400 transition text-sm">
              Request Access →
            </a>
            <a href="https://github.com/saltyprojects/agent-desk" className="inline-flex items-center justify-center rounded-lg border border-white/10 text-gray-300 font-medium px-6 py-3 hover:bg-white/5 transition text-sm">
              View Source ↗
            </a>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} OpenWeave — Execution Governance for Autonomous Systems</span>
          <div className="flex gap-6">
            <a href="https://api.openweave.dev/api/docs/" className="hover:text-gray-400 transition">API</a>
            <a href="https://github.com/saltyprojects/agent-desk" className="hover:text-gray-400 transition">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
