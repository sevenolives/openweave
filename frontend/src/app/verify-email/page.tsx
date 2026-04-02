'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { isLoggedIn, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Wait for auth to load
    if (!isLoggedIn) {
      router.push('/login');
    } else if (user?.email_verified) {
      router.push('/private/workspaces');
    }
  }, [isLoading, isLoggedIn, user, router]);

  const handleSendCode = async () => {
    setSendingCode(true);
    setError('');
    
    try {
      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || '/api') + '/auth/send-verification/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.detail || 'Failed to send verification code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || '/api') + '/auth/verify-email/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ otp }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        // Refresh user data
        setTimeout(() => {
          window.location.reload(); // Force refresh to update auth state
        }, 2000);
      } else {
        setError(data.detail || 'Failed to verify email');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/private/workspaces');
  };

  if (isLoading || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#111118] rounded-2xl border border-[#222233] p-8 shadow-sm text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
            <p className="text-sm text-gray-400 mb-4">
              Your email has been verified successfully. You'll be redirected to your workspaces in a moment.
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#111118] rounded-2xl border border-[#222233] p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="text-4xl mb-3 block">📧</span>
            <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
            <p className="text-sm text-gray-400 mt-2">
              We need to verify your email address to keep your account secure.
            </p>
            {user?.email && (
              <p className="text-sm font-medium text-gray-300 mt-1">
                {user.email}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-[#18181b] border border-[#3f3f46] rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center font-mono text-lg tracking-widest"
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          {/* Resend code */}
          <div className="mt-6 text-center space-y-3">
            <button
              onClick={handleSendCode}
              disabled={sendingCode}
              className="text-sm text-indigo-400 hover:text-indigo-300 disabled:text-gray-500"
            >
              {sendingCode ? 'Sending...' : 'Resend verification code'}
            </button>
            
            <div>
              <button
                onClick={handleSkip}
                className="text-sm text-gray-400 hover:text-gray-300"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}