'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api } from '@/lib/api';

export default function InviteJoinPage() {
  const params = useParams();
  const token = params.token as string;
  const { isLoggedIn, isLoading } = useAuth();
  const { setCurrentWorkspace, refreshWorkspaces } = useWorkspace();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" /></div>;
  }

  if (!isLoggedIn) {
    if (typeof window !== 'undefined') {
      router.push(`/login?redirect=/invite/${token}`);
    }
    return null;
  }

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      const ws = await api.joinWorkspace(token);
      await refreshWorkspaces();
      setCurrentWorkspace(ws);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to join workspace');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Join Workspace</h1>
        <p className="text-sm text-gray-500 mb-6">You&apos;ve been invited to join a workspace.</p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button onClick={handleJoin} disabled={joining} className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
          {joining ? 'Joining...' : 'Join Workspace'}
        </button>
      </div>
    </div>
  );
}
