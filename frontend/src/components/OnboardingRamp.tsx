'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import AccountSettingsModal from '@/components/AccountSettingsModal';

type Step = 'workspace' | 'project' | 'done';

export default function OnboardingRamp({ onComplete }: { onComplete?: () => void }) {
  const { workspaces, refreshWorkspaces, setCurrentWorkspace } = useWorkspace();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<Step>('workspace');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
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
      {/* User menu — top right */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111118] border border-[#222233] hover:bg-[#1a1a2e] transition-colors"
        >
          <div className="w-7 h-7 bg-indigo-500/20 rounded-full flex items-center justify-center text-xs font-bold text-indigo-400">
            {(user?.name?.[0] || user?.username?.[0] || '?').toUpperCase()}
          </div>
          <span className="text-sm text-gray-300 hidden sm:inline">{user?.name || user?.username}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-[#111118] border border-[#222233] rounded-xl shadow-lg z-50 py-1">
              <div className="px-4 py-2 border-b border-[#222233]">
                <p className="text-sm font-medium text-white truncate">{user?.name || user?.username}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button onClick={() => { setUserMenuOpen(false); setAccountSettingsOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1a1a2e] flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Account Settings
              </button>
              <hr className="my-1 border-[#222233]" />
              <button onClick={() => { setUserMenuOpen(false); logout(); router.push('/login'); }} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/10 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>

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

    {accountSettingsOpen && <AccountSettingsModal onClose={() => setAccountSettingsOpen(false)} />}
  );
}
