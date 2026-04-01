'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { useWorkspace } from '@/hooks/useWorkspace';
import OnboardingRamp from '@/components/OnboardingRamp';
import { api } from '@/lib/api';

export default function WorkspacesPage() {
  const { workspaces, currentWorkspace, setCurrentWorkspace, refreshWorkspaces, isLoading: wsLoading } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [showRamp, setShowRamp] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  // Show onboarding ramp if user has no workspaces
  if (!wsLoading && workspaces.length === 0) {
    return <OnboardingRamp onComplete={() => refreshWorkspaces()} />;
  }

  // Show ramp when explicitly requested (for creating additional workspaces)
  if (showRamp) {
    return <OnboardingRamp onComplete={() => { setShowRamp(false); refreshWorkspaces(); }} />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFieldErrors({});
    try {
      const ws = await api.createWorkspace({ name, slug });
      await refreshWorkspaces();
      setCurrentWorkspace(ws);
      toast('Workspace created');
      router.push(`/private/${ws.slug}/settings`);
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to create workspace', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = (ws: typeof workspaces[0]) => {
    setCurrentWorkspace(ws);
    router.push(`/private/${ws.slug}/projects`);
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <button
            onClick={() => setShowRamp(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            + New Workspace
          </button>
        </div>

        <div className="space-y-3">
          {workspaces.map(ws => (
            <button key={ws.slug} onClick={() => handleSelect(ws)} className="w-full bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{ws.name}</h2>
                  <p className="text-sm text-gray-500">/{ws.slug} · {ws.member_count} member{ws.member_count !== 1 ? 's' : ''}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
