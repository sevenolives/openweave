'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

function Check() {
  return (
    <span className="inline-flex w-5 h-5 rounded bg-emerald-500/20 items-center justify-center">
      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

function Cross() {
  return (
    <span className="inline-flex w-5 h-5 rounded bg-white/5 items-center justify-center">
      <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

type CellValue = true | false | string;

const rows: { feature: string; values: [CellValue, CellValue, CellValue, CellValue] }[] = [
  { feature: 'Approach', values: ['Enforcement', 'Observability', 'Testing', 'Monitoring'] },
  { feature: 'When it acts', values: ['Before action', 'After', 'After', 'After'] },
  { feature: 'State machine enforcement', values: [true, false, false, false] },
  { feature: 'Visual state machine editor', values: [true, false, false, false] },
  { feature: 'Approval gates', values: [true, false, false, false] },
  { feature: 'Bot/Human role separation', values: [true, false, false, false] },
  { feature: 'Blocks invalid transitions', values: [true, false, false, false] },
  { feature: 'Audit trail', values: [true, true, false, true] },
  { feature: 'Self-hosted option', values: [true, false, false, false] },
  { feature: 'Open source', values: ['✓ (BSL)', false, true, true] },
  { feature: 'Pricing', values: ['$12/user/mo', '$39/seat/mo', '$0.25/msg', 'Contact us'] },
];

const competitors = ['OpenWeave', 'LangSmith', 'Guardrails AI', 'AgentOps'];

const sections = [
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Enforcement, not observation',
    desc: "OpenWeave doesn't just tell you what happened. It prevents what shouldn't happen. Your state machine rules are enforced at the API level — bots physically cannot enter states they're not allowed to.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Built for human-bot collaboration',
    desc: 'Different transition rules for humans and bots. Approval gates let humans review before bots enter critical states. Real governance, not just logging.',
  },
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      </svg>
    ),
    title: 'Open source, self-hosted',
    desc: 'Run OpenWeave in your own infrastructure. No data leaves your network. BSL 1.1 license, converts to Apache 2.0 in 2029.',
  },
];

function renderCell(value: CellValue) {
  if (value === true) return <Check />;
  if (value === false) return <Cross />;
  return <span className="text-sm text-gray-300">{value}</span>;
}

export default function ComparePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-semibold tracking-tight text-white">OpenWeave</a>
          <div className="hidden sm:flex items-center gap-4">
            <a href="/docs" className="text-sm text-gray-500 hover:text-gray-300 transition">Docs</a>
            <a href="/demo" className="text-sm text-gray-500 hover:text-gray-300 transition">Try Demo</a>
            <a href="/compare" className="text-sm text-gray-500 hover:text-gray-300 transition">Compare</a>
            <a href="/pricing" className="text-sm text-gray-500 hover:text-gray-300 transition">Pricing</a>
            <a href="/blog" className="text-sm text-gray-500 hover:text-gray-300 transition">Blog</a>
            <a href="https://github.com/sevenolives/openweave" className="text-sm text-gray-500 hover:text-gray-300 transition">⭐ GitHub</a>
            <a href={isLoggedIn ? '/private/workspaces' : '/login'} className="text-sm font-medium text-gray-300 hover:text-white transition">{isLoggedIn ? 'Dashboard →' : 'Sign In →'}</a>
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
            <a href="/docs" className="block text-sm text-gray-400 hover:text-white transition">Docs</a>
            <a href="/demo" className="block text-sm text-gray-400 hover:text-white transition">Try Demo</a>
            <a href="/compare" className="block text-sm text-gray-400 hover:text-white transition">Compare</a>
            <a href="/pricing" className="block text-sm text-gray-400 hover:text-white transition">Pricing</a>
            <a href="/blog" className="block text-sm text-gray-400 hover:text-white transition">Blog</a>
            <a href="https://github.com/sevenolives/openweave" className="block text-sm text-gray-400 hover:text-white transition">⭐ GitHub</a>
            <a href={isLoggedIn ? '/private/workspaces' : '/login'} className="block text-sm font-medium text-gray-300 hover:text-white transition">{isLoggedIn ? 'Dashboard →' : 'Sign In →'}</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-8 md:pt-28 md:pb-12 text-center">
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">Compare</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            Others observe.<br />We enforce.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            See how OpenWeave compares to monitoring and observability tools.
          </p>
        </div>
      </header>

      {/* Comparison Table */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-sm font-medium text-gray-500">Feature</th>
                {competitors.map((c, i) => (
                  <th
                    key={c}
                    className={`px-4 py-3 text-sm font-semibold ${
                      i === 0 ? 'text-emerald-400 bg-emerald-500/[0.04]' : 'text-gray-400'
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-sm text-gray-300 font-medium">{row.feature}</td>
                  {row.values.map((val, vi) => (
                    <td
                      key={vi}
                      className={`px-4 py-3 ${vi === 0 ? 'bg-emerald-500/[0.04]' : ''}`}
                    >
                      {renderCell(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-4xl mx-auto px-4 grid gap-8 md:grid-cols-3">
          {sections.map((s) => (
            <div key={s.title} className="p-6 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                {s.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to enforce?</h2>
          <p className="mt-4 text-gray-400 text-lg">Stop observing problems. Start preventing them.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/login" className="inline-flex items-center justify-center rounded-lg bg-emerald-500 text-white font-medium px-6 py-3 hover:bg-emerald-400 transition text-sm">
              Get Started Free →
            </a>
            <a href="/pricing" className="inline-flex items-center justify-center rounded-lg border border-white/10 text-gray-300 font-medium px-6 py-3 hover:bg-white/5 transition text-sm">
              View Pricing
            </a>
          </div>
        </div>
      </section>

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
