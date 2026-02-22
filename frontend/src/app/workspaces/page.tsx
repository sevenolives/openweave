'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api } from '@/lib/api';

export default function WorkspacesPage() {
  const { workspaces, setCurrentWorkspace, refreshWorkspaces } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const ws = await api.createWorkspace({ name, slug });
      await refreshWorkspaces();
      setCurrentWorkspace(ws);
      router.push('/dashboard');
    } catch (err) {
      alert('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = (ws: typeof workspaces[0]) => {
    setCurrentWorkspace(ws);
    router.push('/dashboard');
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            New Workspace
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={name} onChange={e => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input value={slug} onChange={e => setSlug(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <button type="submit" disabled={creating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}

        <div className="space-y-3">
          {workspaces.map(ws => (
            <button key={ws.id} onClick={() => handleSelect(ws)} className="w-full bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{ws.name}</h2>
                  <p className="text-sm text-gray-500">/{ws.slug} · {ws.member_count} member{ws.member_count !== 1 ? 's' : ''}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
          {workspaces.length === 0 && (
            <p className="text-center text-gray-500 py-8">No workspaces yet. Create one to get started.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
