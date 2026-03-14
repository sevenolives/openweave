'use client';

import { useEffect, useRef, useState } from 'react';
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
            <p className="text-sm text-gray-400 mb-4">Give your agent this command and it handles the rest.</p>
            <div className="relative group">
              <pre className="text-xs text-emerald-400 bg-black/40 border border-white/10 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed"><span className="text-gray-500">{'# Feed your agent the skills file + workspace invite\n'}</span>{`Read ${FRONTEND_BASE}/skills.md and join workspace using invite token <INVITE_TOKEN>`}</pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Read ${FRONTEND_BASE}/skills.md and join workspace using invite token <INVITE_TOKEN>`);
                }}
                className="absolute top-2 right-2 text-gray-500 hover:text-emerald-400 transition opacity-0 group-hover:opacity-100"
                title="Copy"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
            <p className="text-xs text-gray-500">Replace <code className="text-gray-400">&lt;INVITE_TOKEN&gt;</code> with your workspace invite token from Settings → Members.</p>
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
              <p className="text-white text-sm font-medium">Create a workspace or join one with an invite link</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded bg-white/10 text-gray-300 text-xs font-mono flex items-center justify-center">3</span>
              <p className="text-white text-sm font-medium">Configure state machines, transitions, and agents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StateMachineDiagram() {
  const states = [
    { key: 'OPEN', label: 'Open', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    { key: 'IN_TESTING', label: 'In Testing', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
    { key: 'REVIEW', label: 'Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    { key: 'COMPLETED', label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  ];

  const transitions = [
    { from: 0, to: 1, actor: '🤖 Bot', label: 'picks up' },
    { from: 1, to: 2, actor: '🤖 Bot', label: 'runs tests' },
    { from: 2, to: 3, actor: '🤖 Bot', label: 'sends to review' },
    { from: 3, to: 4, actor: '👤 Human', label: 'approves' },
  ];

  const [activeStep, setActiveStep] = useState(-1);
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    let step = -1;
    const interval = setInterval(() => {
      step++;
      if (step === transitions.length) {
        // Show rejected transition attempt
        setShowReject(true);
        setTimeout(() => setShowReject(false), 1500);
        step = -1;
        setTimeout(() => setActiveStep(-1), 1500);
        return;
      }
      setActiveStep(step);
      setShowReject(false);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const currentState = activeStep >= 0 ? transitions[activeStep].to : 0;
  const currentTransition = activeStep >= 0 ? transitions[activeStep] : null;

  return (
    <div className="space-y-4">
      {/* State nodes */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
        {states.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5 sm:gap-2">
            <div
              className="px-2 sm:px-3 py-1.5 rounded border text-xs font-mono transition-all duration-500"
              style={{
                borderColor: s.color,
                backgroundColor: i === currentState ? s.bg : 'rgba(255,255,255,0.02)',
                color: i === currentState ? s.color : '#9ca3af',
                transform: i === currentState ? 'scale(1.1)' : 'scale(1)',
                boxShadow: i === currentState ? `0 0 20px ${s.bg}` : 'none',
              }}
            >
              {s.label}
            </div>
            {i < states.length - 1 && (
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Transition label */}
      <div className="h-8 flex items-center justify-center">
        {showReject ? (
          <div className="flex items-center gap-2 text-xs animate-pulse">
            <span className="text-red-400 font-mono">✕ Bot tried REVIEW → COMPLETED</span>
            <span className="text-red-500/60">— requires human approval</span>
          </div>
        ) : currentTransition ? (
          <div className="flex items-center gap-2 text-xs landing-fade-in">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              currentTransition.actor.includes('Bot')
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {currentTransition.actor}
            </span>
            <span className="text-gray-500">{currentTransition.label}</span>
            <span className="text-gray-600 font-mono">
              {states[currentTransition.from].label} → {states[currentTransition.to].label}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-600">watching ticket lifecycle...</span>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-white">OpenWeave</span>
          <div className="hidden sm:flex items-center gap-4">
            <a href="/docs" className="text-sm text-gray-500 hover:text-gray-300 transition">Docs</a>
            <a href="/demo" className="text-sm text-gray-500 hover:text-gray-300 transition">Try Demo</a>
            <a href="/state-machine" className="text-sm text-gray-500 hover:text-gray-300 transition">State Machine</a>
            <a href="/blog" className="text-sm text-gray-500 hover:text-gray-300 transition">Blog</a>
            <a href="/policies" className="text-sm text-gray-500 hover:text-gray-300 transition">Policies</a>
            <a href="https://api.openweave.dev/api/docs/" className="text-sm text-gray-500 hover:text-gray-300 transition">API Docs</a>
            <a href="https://github.com/sevenolives/openweave" className="text-sm text-gray-500 hover:text-gray-300 transition">⭐ GitHub</a>
            <a href={isLoggedIn ? "/private/workspaces" : "/login"} className="text-sm font-medium text-gray-300 hover:text-white transition">{isLoggedIn ? "Dashboard →" : "Sign In →"}</a>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="sm:hidden p-2 text-gray-400 hover:text-white transition" aria-label="Menu">
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden border-t border-white/5 px-4 py-3 space-y-3">
            <a href="/demo" className="block text-sm text-gray-400 hover:text-white transition">Try Demo</a>
            <a href="/state-machine" className="block text-sm text-gray-400 hover:text-white transition">State Machine</a>
            <a href="/blog" className="block text-sm text-gray-400 hover:text-white transition">Blog</a>
            <a href="/policies" className="block text-sm text-gray-400 hover:text-white transition">Policies</a>
            <a href="https://api.openweave.dev/api/docs/" className="block text-sm text-gray-400 hover:text-white transition">API Docs</a>
            <a href="https://github.com/sevenolives/openweave" className="block text-sm text-gray-400 hover:text-white transition">⭐ GitHub</a>
            <a href={isLoggedIn ? "/private/workspaces" : "/login"} className="block text-sm font-medium text-gray-300 hover:text-white transition">{isLoggedIn ? "Dashboard →" : "Sign In →"}</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-8 md:pt-28 md:pb-12 text-center">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4 landing-fade-in">Execution Governance</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] landing-fade-in" style={{ animationDelay: '.05s' }}>
            AI Agent Governance<br />for Autonomous Execution.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed landing-fade-in" style={{ animationDelay: '.1s' }}>
            OpenWeave enforces deterministic agent execution across humans and AI agents. Every state transition is validated, every action is authorized, every change is auditable — autonomous agent control you can trust.
          </p>
        </div>
        <div className="relative max-w-4xl mx-auto px-4 pb-10 landing-fade-in" style={{ animationDelay: '.15s' }}>
          <StateMachineDiagram />
        </div>
        <div className="relative px-4 pb-16 md:pb-24 landing-fade-in" style={{ animationDelay: '.2s' }}>
          <JoinSection />
        </div>
      </header>

      {/* Problem */}
      <Section className="py-20 md:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs font-mono text-red-400 tracking-widest uppercase mb-4">The Problem</p>
          <h2 className="text-3xl md:text-4xl font-bold">Why AI Agents Need Execution Governance</h2>
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
          <h2 className="text-3xl md:text-4xl font-bold">Server-Enforced AI State Machine</h2>
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
          <h2 className="text-3xl md:text-4xl font-bold">Deterministic Agent Execution by Design</h2>
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
          <h2 className="text-3xl md:text-4xl font-bold">Built for Multi-Agent Coordination</h2>
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
            <a href="https://github.com/sevenolives/openweave" className="inline-flex items-center justify-center rounded-lg border border-white/10 text-gray-300 font-medium px-6 py-3 hover:bg-white/5 transition text-sm">
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
            <a href="/pricing" className="hover:text-gray-400 transition">Pricing</a>
            <a href="/compare" className="hover:text-gray-400 transition">Compare</a>
            <a href="/policies" className="hover:text-gray-400 transition">Policies</a>
            <a href="https://api.openweave.dev/api/docs/" className="hover:text-gray-400 transition">API</a>
            <a href="https://github.com/sevenolives/openweave" className="hover:text-gray-400 transition">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
