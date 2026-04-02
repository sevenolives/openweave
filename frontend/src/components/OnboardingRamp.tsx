'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';

type Step = 'workspace' | 'project' | 'done';

export default function OnboardingRamp({ onComplete }: { onComplete?: () => void }) {
  const { workspaces, refreshWorkspaces, setCurrentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<Step>('workspace');
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [projName, setProjName] = useState('');
  const [projSlug, setProjSlug] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdWs, setCreatedWs] = useState<string | null>(null);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    setSaving(true);
    try {
      const ws = await api.createWorkspace({
        name: wsName.trim(),
        slug: wsSlug.trim() || wsName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      });
      await refreshWorkspaces();
      setCurrentWorkspace(ws);
      setCreatedWs(ws.slug);
      toast('Workspace created!');
      setStep('project');
    } catch (e: any) {
      toast(e?.message || 'Failed to create workspace', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !createdWs) return;
    setSaving(true);
    try {
      await api.createProject({
        name: projName.trim(),
        slug: projSlug.trim().toUpperCase() || undefined,
        about_text: projDesc.trim(),
        workspace: createdWs,
      });
      toast('Project created!');
      setStep('done');
      // Redirect to the new workspace's projects page
      setTimeout(() => {
        router.push(`/private/${createdWs}/projects`);
        onComplete?.();
      }, 1500);
    } catch (e: any) {
      toast(e?.message || 'Failed to create project', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['workspace', 'project', 'done'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === s ? 'bg-indigo-600 text-white scale-110' :
                ['workspace', 'project', 'done'].indexOf(step) > i ? 'bg-green-500 text-white' :
                'bg-gray-700 text-gray-400'
              }`}>
                {['workspace', 'project', 'done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && <div className={`w-12 h-0.5 ${['workspace', 'project', 'done'].indexOf(step) > i ? 'bg-green-500' : 'bg-gray-700'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Create Workspace */}
        {step === 'workspace' && (
          <div className="bg-[#111118] rounded-2xl border border-[#222233] p-8 shadow-sm">
            <div className="text-center mb-6">
              <span className="text-4xl mb-3 block">🏢</span>
              <h1 className="text-2xl font-bold text-white">Create your workspace</h1>
              <p className="text-sm text-gray-400 mt-2">A workspace is your team&apos;s home — it contains projects, members, and your state machine.</p>
            </div>
            <form onSubmit={handleCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Workspace name</label>
                <input
                  value={wsName}
                  onChange={e => { setWsName(e.target.value); setWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }}
                  className="w-full px-4 py-3 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#1a1a2e] text-white placeholder-gray-500"
                  placeholder="e.g. Acme Inc, My Team"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">URL slug</label>
                <div className="flex items-center gap-0 border border-[#222233] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="px-3 py-3 bg-[#1a1a2e] text-sm text-gray-500 border-r border-[#222233]">openweave.dev/</span>
                  <input
                    value={wsSlug}
                    onChange={e => setWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 px-3 py-3 text-sm border-0 focus:ring-0 outline-none bg-[#1a1a2e] text-white"
                    placeholder="my-team"
                  />
                </div>
              </div>
              <button type="submit" disabled={saving || !wsName.trim()} className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors">
                {saving ? 'Creating…' : 'Create Workspace →'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Create Project */}
        {step === 'project' && (
          <div className="bg-[#111118] rounded-2xl border border-[#222233] p-8 shadow-sm">
            <div className="text-center mb-6">
              <span className="text-4xl mb-3 block">📁</span>
              <h1 className="text-2xl font-bold text-white">Create your first project</h1>
              <p className="text-sm text-gray-400 mt-2">Projects group tickets and team members. You can create more later.</p>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Project name</label>
                <input
                  value={projName}
                  onChange={e => { setProjName(e.target.value); setProjSlug(e.target.value.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 5)); }}
                  className="w-full px-4 py-3 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#1a1a2e] text-white placeholder-gray-500"
                  placeholder="e.g. Website Redesign, Mobile App"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ticket prefix</label>
                <input
                  value={projSlug}
                  onChange={e => setProjSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                  className="w-full px-4 py-3 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#1a1a2e] text-white placeholder-gray-500"
                  placeholder="e.g. WR, APP"
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">Used in ticket IDs like {projSlug || 'WR'}-1, {projSlug || 'WR'}-2</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description <span className="text-gray-400">(optional)</span></label>
                <textarea
                  value={projDesc}
                  onChange={e => setProjDesc(e.target.value)}
                  className="w-full px-4 py-3 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[#1a1a2e] text-white placeholder-gray-500 resize-none"
                  rows={3}
                  placeholder="What is this project about?"
                />
              </div>
              <button type="submit" disabled={saving || !projName.trim()} className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors">
                {saving ? 'Creating…' : 'Create Project →'}
              </button>
              <button type="button" onClick={() => { router.push(`/private/${createdWs}/projects`); onComplete?.(); }}
                className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-300">
                Skip for now
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="bg-[#111118] rounded-2xl border border-[#222233] p-8 shadow-sm text-center">
            <span className="text-5xl mb-4 block">🎉</span>
            <h1 className="text-2xl font-bold text-white mb-2">You&apos;re all set!</h1>
            <p className="text-sm text-gray-500">Your workspace and project are ready. Taking you to your projects…</p>
          </div>
        )}
      </div>
    </div>
  );
}
