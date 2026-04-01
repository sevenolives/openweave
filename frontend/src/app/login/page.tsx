'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import PublicNav from '@/components/PublicNav';

function LoginForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setFieldErrors({});

    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register({ username: email, name, email, password });
      }
      const redirect = searchParams.get('redirect');
      router.push(redirect || '/private/workspaces');
    } catch (err: any) {
      // Parse field-level errors
      if (err && typeof err === 'object' && 'fieldErrors' in err) {
        const fe: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(err.fieldErrors as Record<string, string[]>)) {
          fe[key] = (msgs as string[]).join(', ');
        }
        setFieldErrors(fe);
      }
      setError(err instanceof Error ? err.message : (mode === 'login' ? 'Login failed' : 'Registration failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <PublicNav />
      <div className="flex items-center justify-center px-4 py-8" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            OpenWeave
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Agentic support & ticketing system
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#111118] rounded-2xl shadow-xl border border-[#222233] p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex mb-6 bg-[#0a0a0f] rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${mode === 'login' ? 'bg-[#1a1a2e] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${mode === 'register' ? 'bg-[#1a1a2e] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Create account
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="email"
                  required
                  className={`block w-full px-4 py-2.5 bg-[#1a1a2e] border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent focus:bg-[#1a1a2e] transition-all text-sm ${fieldErrors.username ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-[#222233] focus:ring-indigo-500'}`}
                  placeholder="you@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                {fieldErrors.username && <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>}
              </div>
            ) : (
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`block w-full px-4 py-2.5 bg-[#1a1a2e] border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent focus:bg-[#1a1a2e] transition-all text-sm ${fieldErrors.email ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-[#222233] focus:ring-indigo-500'}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {fieldErrors.email && <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Display name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className={`block w-full px-4 py-2.5 bg-[#1a1a2e] border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent focus:bg-[#1a1a2e] transition-all text-sm ${fieldErrors.name ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-[#222233] focus:ring-indigo-500'}`}
                  placeholder="Enter your display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
              </div>
            )}
            
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                {mode === 'login' && (
                  <Link
                    href="/forgot-password"
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                className={`block w-full px-4 py-2.5 bg-[#1a1a2e] border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-transparent focus:bg-[#1a1a2e] transition-all text-sm ${fieldErrors.password ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-[#222233] focus:ring-indigo-500'}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fieldErrors.password && <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>}
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>
        </div>

        {/* Footer */}
      </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
