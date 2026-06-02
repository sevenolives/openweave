'use client';

import { useState, useRef, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import PublicNav from '@/components/PublicNav';

const RESEND_COOLDOWN = 60;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();
  const redirectTo = searchParams.get('redirect') || '/private/workspaces';

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRef.current?.focus(), 50);
    else setTimeout(() => emailRef.current?.focus(), 50);
  }, [step]);

  async function handleSendCode(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!isValidEmail) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.otpRequest(email.trim().toLowerCase());
      setIsNewAccount(res.is_new_account);
      setCooldown(RESEND_COOLDOWN);
      setOtp('');
      setStep('otp');
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setError(
        status === 429
          ? 'Too many requests. Please try again later.'
          : err instanceof Error ? err.message : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const tokens = await api.otpVerify(email.trim().toLowerCase(), otp);
      loginWithTokens(tokens);
      router.push(redirectTo);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setError(
        status === 429 ? 'Too many attempts. Please wait.'
        : status === 400 ? 'Invalid or expired code.'
        : err instanceof Error ? err.message : 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError('');
    try {
      await api.otpRequest(email.trim().toLowerCase());
      setCooldown(RESEND_COOLDOWN);
      setOtp('');
      otpRef.current?.focus();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setError(status === 429 ? 'Too many requests.' : 'Could not resend code.');
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <PublicNav />
      <div className="flex items-center justify-center px-4 py-8" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-md">

          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">OpenWeave</h1>
            <p className="mt-2 text-sm text-gray-400">Agentic support &amp; ticketing system</p>
          </div>

          {/* Card */}
          <div className="bg-[#111118] rounded-2xl shadow-xl border border-[#222233] p-6 sm:p-8">

            {step === 'email' ? (
              <>
                <h2 className="text-xl font-bold text-white mb-1">Sign in</h2>
                <p className="text-sm text-gray-400 mb-6">No password needed — we&apos;ll send you a secure code.</p>

                {error && (
                  <div className="mb-4 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                      Email address
                    </label>
                    <input
                      id="email"
                      ref={emailRef}
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
                      className="block w-full px-4 py-2.5 bg-[#1a1a2e] border border-[#222233] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                      placeholder="you@example.com"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !isValidEmail}
                    className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending code…
                      </span>
                    ) : 'Send sign-in code'}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white mb-1">
                  {isNewAccount ? 'Create your account' : 'Enter your code'}
                </h2>
                <p className="text-sm text-gray-400 mb-6">
                  Code sent to <span className="font-medium text-gray-200">{email}</span>.
                </p>

                {error && (
                  <div className="mb-4 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleVerify} className="space-y-4">
                  <div>
                    <label htmlFor="otp-input" className="block text-sm font-medium text-gray-300 mb-1.5">
                      6-digit code
                    </label>
                    <input
                      id="otp-input"
                      ref={otpRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otp}
                      onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); if (error) setError(''); }}
                      onPaste={e => { e.preventDefault(); setOtp(e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)); }}
                      className="block w-full px-4 py-3 bg-[#1a1a2e] border border-[#222233] rounded-xl text-center text-2xl tracking-[0.5em] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono"
                      placeholder="——————"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Verifying…
                      </span>
                    ) : isNewAccount ? 'Create account' : 'Sign in'}
                  </button>
                </form>

                <div className="mt-5 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                    className="text-gray-400 hover:text-gray-200 transition"
                  >
                    ← Change email
                  </button>
                  {cooldown > 0 ? (
                    <span className="text-gray-500">Resend in 0:{String(cooldown).padStart(2, '0')}</span>
                  ) : (
                    <button type="button" onClick={handleResend} className="text-indigo-400 hover:text-indigo-300 transition">
                      Resend code
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
