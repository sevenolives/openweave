'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api } from '@/lib/api';

export default function InviteJoinPage() {
  const params = useParams();
  const token = params.token as string;
  const { user, isLoggedIn, isLoading } = useAuth();
  const { setCurrentWorkspace, refreshWorkspaces } = useWorkspace();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" /></div>;
  }

  const handleJoinAuthed = async () => {
    setJoining(true);
    setError('');
    try {
      const ws = await api.joinWorkspace(token);
      await refreshWorkspaces();
      setCurrentWorkspace(ws);
      router.push('/private/workspaces');
    } catch (err: any) {
      setError(err.message || 'Failed to join workspace');
    } finally {
      setJoining(false);
    }
  };

  const handleRegisterAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setError('');
    try {
      const result = await api.registerAndJoin({
        project: token,
        username,
        name,
        password,
      });
      await refreshWorkspaces();
      if (result.workspace) setCurrentWorkspace(result.workspace);
      router.push('/private/workspaces');
    } catch (err: any) {
      setError(err.message || 'Failed to join workspace');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4 py-8">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 p-6 sm:p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Join Workspace</h1>
          <p className="text-sm text-gray-500">You&apos;ve been invited to join a workspace.</p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl mb-4">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {isLoggedIn ? (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">Signed in as <span className="font-semibold">{user?.name || user?.username}</span></p>
            <button
              onClick={handleJoinAuthed}
              disabled={joining}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {joining ? 'Joining...' : 'Join Workspace'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegisterAndJoin} className="space-y-5">
            <p className="text-sm text-gray-500 text-center">Create an account to join this workspace.</p>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                id="username"
                type="text"
                required
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all text-sm"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
              <input
                id="name"
                type="text"
                required
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all text-sm"
                placeholder="Enter your display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all text-sm"
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={joining}
              className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {joining ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </span>
              ) : 'Create account & join'}
            </button>
            <p className="text-xs text-center text-gray-400">
              Already have an account? <a href={`/login?redirect=/invite/${token}`} className="text-indigo-600 hover:text-indigo-700 font-medium">Sign in</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
