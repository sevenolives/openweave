'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api, Project, User } from '@/lib/api';

export default function ProjectSettingsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTickets, setHasTickets] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [projectAgents, setProjectAgents] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [memberSaving, setMemberSaving] = useState(false);

  const router = useRouter();
  const params = useParams<{ workspaceSlug: string; id: string }>();
  const workspaceSlug = params.workspaceSlug;
  const projectId = parseInt(params.id);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const isAdmin = currentWorkspace?.owner_details?.id === currentUser?.id;

  const fetchData = async () => {
    try {
      const [p, agents, ticketResp] = await Promise.all([api.getProject(projectId), api.getProjectAgents(projectId), api.getTicketsPaginated({ project: String(projectId) })]);
      setHasTickets((ticketResp.count || 0) > 0);
      setProject(p); setProjectAgents(agents); setEditName(p.name); setEditSlug(p.slug || ''); setEditDesc(p.description);
      if (p.workspace) {
        api.getUsers({ workspace: String(p.workspace) }).then(setAllUsers).catch(() => {});
      }
    } catch (e: any) { toast(e?.message || 'Failed to load project', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const availableUsers = allUsers.filter(u => !projectAgents.some(a => a.id === u.id));

  const handleSaveSettings = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await api.updateProject(project.id, { name: editName, slug: editSlug, description: editDesc });
      setProject(updated);
      toast('Settings saved');
    } catch (e: any) { toast(e?.message || 'Failed to save settings', 'error'); }
    finally { setSaving(false); }
  };

  const handleAddMember = async () => {
    if (!project || !selectedUserId) return;
    setMemberSaving(true);
    try {
      const currentIds = projectAgents.map(a => a.id);
      await api.updateProject(project.id, { agent_ids: [...currentIds, Number(selectedUserId)] });
      setSelectedUserId('');
      const agents = await api.getProjectAgents(projectId);
      setProjectAgents(agents);
      toast('Member added');
    } catch (e: any) { toast(e?.message || 'Failed to add member', 'error'); }
    finally { setMemberSaving(false); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!project) return;
    setMemberSaving(true);
    try {
      const currentIds = projectAgents.map(a => a.id).filter(id => id !== userId);
      await api.updateProject(project.id, { agent_ids: currentIds });
      const agents = await api.getProjectAgents(projectId);
      setProjectAgents(agents);
      toast('Member removed');
    } catch (e: any) { toast(e?.message || 'Failed to remove member', 'error'); }
    finally { setMemberSaving(false); }
  };

  if (loading) return <Layout><div className="p-8 text-center text-gray-400">Loading…</div></Layout>;
  if (!project) return <Layout><div className="p-8 text-center text-gray-400">Project not found</div></Layout>;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/private/${workspaceSlug}/projects`)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500">Project Settings</p>
          </div>
          <button onClick={() => router.push(`/private/${workspaceSlug}/tickets?project=${project.id}`)} className="ml-auto px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            View Tickets →
          </button>
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">General</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} disabled={hasTickets} className={`w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${hasTickets ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} maxLength={10} placeholder="e.g. SA, PROJ" />
                <p className="text-xs text-gray-400 mt-1">{hasTickets ? 'Cannot change slug after tickets have been created' : 'Used in ticket IDs like SA-1, SA-2'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" rows={4} />
              </div>
              <button onClick={handleSaveSettings} disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Members */}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Members</h3>
              <div className="space-y-2 mb-4">
                {projectAgents.length === 0 ? (
                  <p className="text-sm text-gray-400">No members yet.</p>
                ) : (
                  projectAgents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${agent.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                          {agent.username[0].toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{agent.username}</div>
                          {agent.name && <div className="text-xs text-gray-500 truncate">{agent.name}</div>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 ${agent.user_type === 'BOT' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {agent.user_type}
                        </span>
                      </div>
                      <button onClick={() => handleRemoveMember(agent.id)} disabled={memberSaving} className="ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Remove">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
              {availableUsers.length > 0 && (
                <div className="flex gap-2">
                  <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white min-h-[44px]">
                    <option value="">Select a user…</option>
                    {availableUsers.map(u => <option key={u.id} value={u.id}>{u.username} ({u.user_type})</option>)}
                  </select>
                  <button onClick={handleAddMember} disabled={!selectedUserId || memberSaving} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors min-h-[44px]">
                    Add
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
