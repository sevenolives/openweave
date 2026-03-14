'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const tiers = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    unit: '',
    features: [
      'Up to 3 users',
      '1 workspace',
      '2 projects per workspace',
      '2 bot agents',
      'Default state machine only',
      'No approval gates',
      '24-hour audit log retention',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/login',
    highlighted: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 12,
    annualPrice: 10,
    unit: '/user/mo',
    features: [
      'Unlimited users',
      'Unlimited workspaces',
      'Unlimited projects',
      'Unlimited bot agents',
      'Full custom state machines',
      'Approval gates',
      '1 year audit log retention',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    href: '/login',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: -1,
    annualPrice: -1,
    unit: '',
    features: [
      'Everything in Pro',
      'SSO / SAML',
      'Self-hosted deployment',
      'Custom audit log retention',
      'Dedicated support',
      'SLA',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@openweave.dev',
    highlighted: false,
  },
];

const faqs = [
  {
    q: 'Can I self-host for free?',
    a: 'Yes. OpenWeave is available under the BSL 1.1 license. You can self-host for internal use at no cost. Production use as a commercial service requires a commercial license.',
  },
  {
    q: 'What counts as a user?',
    a: 'Any member of a workspace — human or bot — counts as a user for billing purposes.',
  },
  {
    q: 'Can I change plans?',
    a: 'Yes, you can upgrade or downgrade at any time. Changes take effect immediately and billing is prorated.',
  },
];

export default function PricingPage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleProClick = () => {
    if (isLoggedIn) {
      // Redirect to workspaces — user picks workspace then goes to billing
      router.push('/private/workspaces');
    } else {
      router.push('/login');
    }
  };

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
          <p className="text-xs font-mono text-emerald-500 tracking-widest uppercase mb-4">Pricing</p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Start free. Scale when you&apos;re ready.
          </p>
        </div>
      </header>

      {/* Toggle */}
      <div className="flex justify-center pb-12">
        <div className="inline-flex items-center gap-3 rounded-lg border border-white/10 p-1 bg-white/5">
          <button
            onClick={() => setAnnual(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!annual ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${annual ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Annual <span className="text-emerald-300 text-xs ml-1">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Tiers */}
      <div className="max-w-5xl mx-auto px-4 pb-20 grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const price = annual ? tier.annualPrice : tier.monthlyPrice;
          return (
            <div
              key={tier.name}
              className={`relative rounded-xl border p-6 flex flex-col ${
                tier.highlighted
                  ? 'border-emerald-500/50 bg-emerald-500/[0.04] shadow-[0_0_40px_rgba(16,185,129,0.08)]'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                  Recommended
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <div className="mt-4 mb-6">
                {price === -1 ? (
                  <span className="text-3xl font-bold text-white">Custom</span>
                ) : price === 0 ? (
                  <span className="text-3xl font-bold text-white">$0</span>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-white">${price}</span>
                    <span className="text-sm text-gray-400">{tier.unit}</span>
                    {annual && tier.monthlyPrice > 0 && (
                      <span className="ml-2 text-sm text-gray-600 line-through">${tier.monthlyPrice}</span>
                    )}
                  </div>
                )}
              </div>
              <ul className="space-y-3 flex-1">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              {tier.name === 'Pro' ? (
                <button
                  onClick={handleProClick}
                  className="mt-8 block w-full text-center rounded-lg px-6 py-3 text-sm font-medium transition bg-emerald-500 text-white hover:bg-emerald-400"
                >
                  {isLoggedIn ? 'Upgrade to Pro' : 'Start Free Trial'}
                </button>
              ) : (
                <a
                  href={tier.href}
                  className={`mt-8 block text-center rounded-lg px-6 py-3 text-sm font-medium transition ${
                    tier.highlighted
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                      : 'border border-white/10 text-gray-300 hover:bg-white/5'
                  }`}
                >
                  {tier.cta}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <section className="border-t border-white/5 py-20">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-8">
            {faqs.map((faq, i) => (
              <div key={i}>
                <h3 className="text-base font-semibold text-white">{faq.q}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
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
