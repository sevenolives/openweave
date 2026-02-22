'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const GITHUB = 'https://github.com/saltyprojects/agent-desk';

const features = [
  { icon: '📋', title: 'Kanban Boards', desc: 'Visualise ticket flow across customisable stages — drag, drop, done.' },
  { icon: '🎫', title: 'Ticket Management', desc: 'Create, assign, prioritise and resolve tickets in one place.' },
  { icon: '🤖', title: 'Human + Bot Agents', desc: 'Blend AI automation with human oversight for the best outcomes.' },
  { icon: '📁', title: 'Project-Scoped Workflows', desc: 'Isolate work by project so every team stays focused.' },
  { icon: '📝', title: 'Audit Logging', desc: 'Full history of every action for compliance and debugging.' },
  { icon: '🔐', title: 'JWT Authentication', desc: 'Secure, stateless auth out of the box — no sessions to manage.' },
];

const steps = [
  { num: '1', title: 'Create a Project', desc: 'Set up a workspace with its own board, agents, and settings.' },
  { num: '2', title: 'Assign Agents', desc: 'Add human or bot agents and define their roles.' },
  { num: '3', title: 'Track Tickets', desc: 'Watch tickets flow through your pipeline in real time.' },
];

const tech = ['Python', 'Django', 'Django REST Framework', 'Next.js', 'Tailwind CSS', 'JWT'];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('landing-fade-in'); obs.unobserve(el); } },
      { threshold: 0.15 }
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

export default function HomePage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.push('/dashboard');
    }
  }, [isLoggedIn, isLoading, router]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Agent Desk...</p>
        </div>
      </div>
    );
  }

  // If logged in, show nothing while redirecting
  if (isLoggedIn) return null;

  // Public landing page
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold text-indigo-600">Agent Desk</span>
          <a href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition">
            Sign In →
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-24 md:py-36 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight landing-fade-in">
            AI-Powered Support,<br />Human-Level Care
          </h1>
          <p className="mt-6 text-lg md:text-xl text-indigo-100 max-w-2xl mx-auto landing-fade-in" style={{ animationDelay: '.15s' }}>
            Agent Desk blends bot automation with human oversight so your team can resolve tickets faster — without losing the personal touch.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center landing-fade-in" style={{ animationDelay: '.3s' }}>
            <a href="/login" className="inline-flex items-center justify-center rounded-xl bg-white text-indigo-700 font-semibold px-8 py-3.5 hover:bg-indigo-50 transition shadow-lg shadow-indigo-900/30">
              Get Started Free
            </a>
            <a href={GITHUB} className="inline-flex items-center justify-center rounded-xl border border-white/30 text-white font-semibold px-8 py-3.5 hover:bg-white/10 transition">
              View on GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Features */}
      <Section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center">Everything you need</h2>
          <p className="mt-3 text-gray-500 text-center max-w-xl mx-auto">Powerful features to manage support at any scale.</p>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
          <p className="mt-3 text-gray-500 max-w-lg mx-auto">Three steps to a calmer support queue.</p>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.num} className="flex flex-col items-center">
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-100 text-indigo-700 text-xl font-bold">{s.num}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Tech stack */}
      <Section className="py-20 md:py-28 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Built with modern tech</h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {tech.map((t) => (
              <span key={t} className="rounded-full bg-white border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700 shadow-sm">{t}</span>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section className="py-20 md:py-28 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to streamline your support?</h2>
          <p className="mt-4 text-indigo-100 text-lg">Start using Agent Desk today — it&apos;s free and open source.</p>
          <a href="/login" className="mt-8 inline-flex items-center justify-center rounded-xl bg-white text-indigo-700 font-semibold px-8 py-3.5 hover:bg-indigo-50 transition shadow-lg">
            Get Started →
          </a>
        </div>
      </Section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <span>© {new Date().getFullYear()} Agent Desk</span>
          <a href={GITHUB} className="hover:text-white transition">GitHub ↗</a>
        </div>
      </footer>
    </div>
  );
}
