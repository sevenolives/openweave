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
  const { isLoggedIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
    } else if (user?.email_verified) {
      router.push('/private/workspaces');
    }
  }, [isLoggedIn, user, router]);

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

  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
            <p className="text-sm text-gray-600 mb-4">
              Your email has been verified successfully. You'll be redirected to your workspaces in a moment.
            </p>
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <span className="text-4xl mb-3 block">📧</span>
            <h1 className="text-2xl font-bold text-gray-900">Verify Your Email</h1>
            <p className="text-sm text-gray-500 mt-2">
              We need to verify your email address to keep your account secure.
            </p>
            {user?.email && (
              <p className="text-sm font-medium text-gray-700 mt-1">
                {user.email}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center font-mono text-lg tracking-widest"
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          {/* Resend code */}
          <div className="mt-6 text-center space-y-3">
            <button
              onClick={handleSendCode}
              disabled={sendingCode}
              className="text-sm text-indigo-600 hover:text-indigo-500 disabled:text-gray-400"
            >
              {sendingCode ? 'Sending...' : 'Resend verification code'}
            </button>
            
            <div>
              <button
                onClick={handleSkip}
                className="text-sm text-gray-500 hover:text-gray-700"
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