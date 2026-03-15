'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  }, []);

  const links = [
    { href: '/docs', label: 'Docs' },
    { href: '/demo', label: 'Try Demo' },
    { href: '/state-machine', label: 'State Machine' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/blog', label: 'Blog' },
    { href: 'https://api.openweave.dev/api/docs/', label: 'API Docs' },
    { href: 'https://github.com/sevenolives/openweave', label: '⭐ GitHub' },
  ];

  const ctaHref = isLoggedIn ? '/private/workspaces' : '/login';
  const ctaLabel = isLoggedIn ? 'Dashboard →' : 'Sign In →';

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-white">OpenClaw</Link>
        <div className="hidden sm:flex items-center gap-4">
          {links.map(l => (
            <Link key={l.href} href={l.href} className="text-sm text-gray-500 hover:text-gray-300 transition">{l.label}</Link>
          ))}
          <Link href={ctaHref} className="text-sm font-medium text-gray-300 hover:text-white transition">{ctaLabel}</Link>
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
          {links.map(l => (
            <Link key={l.href} href={l.href} className="block text-sm text-gray-400 hover:text-white transition">{l.label}</Link>
          ))}
          <Link href={ctaHref} className="block text-sm font-medium text-gray-300 hover:text-white transition">{ctaLabel}</Link>
        </div>
      )}
    </nav>
  );
}
