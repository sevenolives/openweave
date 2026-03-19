'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api, Project, User, ProjectAgentMembership, Phase, StatusDefinition, ProjectStatusPermission } from '@/lib/api';

export default function ProjectSettingsPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasTickets, setHasTickets] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [projectAgents, setProjectAgents] = useState<User[]>([]);
  const [agentMemberships, setAgentMemberships] = useState<ProjectAgentMembership[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [memberSaving, setMemberSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'phases' | 'permissions'>('general');
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [statusPerms, setStatusPerms] = useState<ProjectStatusPermission[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseDesc, setNewPhaseDesc] = useState('');
  const [addingPhase, setAddingPhase] = useState(false);
  const [editingPhase, setEditingPhase] = useState<number | null>(null);
  const [editPhaseName, setEditPhaseName] = useState('');
  const [editPhaseDesc, setEditPhaseDesc] = useState('');

  const router = useRouter();
  const params = useParams<{ workspaceSlug: string; id: string }>();
  const workspaceSlug = params.workspaceSlug;
  const projectSlug = params.id;
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const isAdmin = currentWorkspace?.owner_details?.id === currentUser?.id;

  const fetchData = async () => {
    try {
      const [p, agents, ticketResp, memberships, ph, perms] = await Promise.all([
        api.getProject(projectSlug), api.getProjectAgents(projectSlug),
        api.getTicketsPaginated({ project: projectSlug }),
        api.getProjectAgentMemberships(projectSlug),
        api.getPhases(projectSlug),
        api.getProjectStatusPermissions(projectSlug),
      ]);
      setHasTickets((ticketResp.count || 0) > 0);
      setProject(p); setProjectAgents(agents); setAgentMemberships(memberships); setPhases(ph); setStatusPerms(perms);
      // Load workspace statuses
      if (p.workspace) {
        api.getStatusDefinitions(String(p.workspace)).then(setStatuses).catch(() => {});
      }
      setEditName(p.name); setEditSlug(p.slug || ''); setEditDesc(p.description); setEditNotes(p.notes || '');
      if (p.workspace) {
        api.getUsers({ workspace: String(p.workspace) }).then(setAllUsers).catch(() => {});
      }
    } catch (e: any) { toast(e?.message || 'Failed to load project', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [projectSlug]);

  const availableUsers = allUsers.filter(u => !projectAgents.some(a => a.id === u.id));

  const handleSaveSettings = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await api.updateProject(project.slug, { name: editName, slug: editSlug, description: editDesc, notes: editNotes });
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
      await api.updateProject(project.slug, { agent_ids: [...currentIds, Number(selectedUserId)] });
      setSelectedUserId('');
      const agents = await api.getProjectAgents(projectSlug);
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
      await api.updateProject(project.slug, { agent_ids: currentIds });
      const agents = await api.getProjectAgents(projectSlug);
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
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => router.push(`/private/${workspaceSlug}/projects/${project.slug}/chat`)} className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              💬 Activity
            </button>
            <button onClick={() => router.push(`/private/${workspaceSlug}/tickets?project=${project.slug}`)} className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              View Tickets →
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
          {(['general', 'members', 'phases', 'permissions'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab === 'general' ? '⚙️ General' : tab === 'members' ? '👥 Members' : tab === 'phases' ? '📋 Phases' : '🔒 Permissions'}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && <div className="bg-white rounded-xl border border-gray-200 p-6">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Notes</label>
                <p className="text-xs text-gray-400 mb-2">Instructions for bots — process guidelines, conventions, important context. Bots read this before working on tickets.</p>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono" rows={8} placeholder="e.g. All PRs must target the develop branch. Use conventional commits. Never merge without review..." />
              </div>
              <button onClick={handleSaveSettings} disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>}

          {/* Members */}
          {activeTab === 'members' && <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                    {isAdmin && (
                      <>
                        <div className="flex items-center gap-2">
                          <select
                            value={agentMemberships.find(m => m.user.id === agent.id)?.role || 'MEMBER'}
                            onChange={async (e) => {
                              const membership = agentMemberships.find(m => m.user.id === agent.id);
                              if (membership) {
                                try {
                                  await api.updateProjectAgentRole(membership.id, e.target.value);
                                  const updated = await api.getProjectAgentMemberships(projectSlug);
                                  setAgentMemberships(updated);
                                  toast('Role updated');
                                } catch (err: any) { toast(err?.message || 'Failed', 'error'); }
                              }
                            }}
                            className="px-4 py-3 text-sm border border-gray-300 rounded-xl bg-white"
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="MEMBER">Member</option>
                          </select>
                          {/* approval permission removed */}
                        </div>
                        <button onClick={() => handleRemoveMember(agent.id)} disabled={memberSaving} className="ml-2 min-w-[44px] h-[44px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Remove">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </>
                    )}
                    {!isAdmin && (
                      <span className="text-xs text-gray-500 px-2">
                        {agentMemberships.find(m => m.user.id === agent.id)?.role || 'MEMBER'}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            {isAdmin && availableUsers.length > 0 && (
              <div className="flex gap-2">
                <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white h-[44px]">
                  <option value="">Select a user…</option>
                  {availableUsers.map(u => <option key={u.id} value={u.id}>{u.username} ({u.user_type})</option>)}
                </select>
                <button onClick={handleAddMember} disabled={!selectedUserId || memberSaving} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors h-[44px]">
                  Add
                </button>
              </div>
            )}
          </div>}

          {/* Phases */}
          {activeTab === 'phases' && <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Phases</h3>
                <p className="text-sm text-gray-500 mt-0.5">Define project phases so bots and team members know what stage the project is in</p>
              </div>
            </div>

            {/* Phase list */}
            <div className="space-y-3 mb-6">
              {phases.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No phases yet. Add your first phase below.</p>
              ) : phases.map((phase, idx) => {
                const statusColors = { UPCOMING: 'border-gray-200', ACTIVE: 'border-indigo-300 bg-indigo-50/50', COMPLETED: 'border-green-200 bg-green-50/30' };
                const badgeColors = { UPCOMING: 'bg-gray-100 text-gray-500', ACTIVE: 'bg-indigo-100 text-indigo-700', COMPLETED: 'bg-green-100 text-green-700' };
                return (
                <div key={phase.id} className={`rounded-xl border p-4 transition-all ${statusColors[phase.status] || statusColors.UPCOMING}`}>
                  {editingPhase === phase.id ? (
                    <div className="space-y-3">
                      <input value={editPhaseName} onChange={e => setEditPhaseName(e.target.value)} autoFocus
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Phase name" />
                      <textarea value={editPhaseDesc} onChange={e => setEditPhaseDesc(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 resize-none" rows={4} placeholder="Goals and scope of this phase..." />
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          try {
                            await api.updatePhase(phase.id, { name: editPhaseName, description: editPhaseDesc });
                            setEditingPhase(null);
                            const ph = await api.getPhases(projectSlug); setPhases(ph);
                            toast('Phase updated');
                          } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                        }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
                        <button onClick={() => setEditingPhase(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-400">#{idx + 1}</span>
                          <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${badgeColors[phase.status] || badgeColors.UPCOMING}`}>{phase.status}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {phase.status !== 'ACTIVE' && (
                            <button onClick={async () => {
                              try {
                                await api.updatePhase(phase.id, { status: 'ACTIVE' });
                                const ph = await api.getPhases(projectSlug); setPhases(ph);
                                toast('Phase activated');
                              } catch (err: any) { toast(err?.message || 'Failed', 'error'); }
                            }} className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg">
                              Set Active
                            </button>
                          )}
                          <button onClick={() => { setEditingPhase(phase.id); setEditPhaseName(phase.name || ''); setEditPhaseDesc(phase.description || ''); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`Delete phase "${phase.name}"?`)) return;
                            try {
                              await api.deletePhase(phase.id);
                              const ph = await api.getPhases(projectSlug); setPhases(ph);
                              toast('Phase deleted');
                            } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                          }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      {phase.description && <p className="text-sm text-gray-600 mt-1">{phase.description}</p>}
                      {phase.started_at && <p className="text-xs text-gray-400 mt-2">Started {new Date(phase.started_at).toLocaleDateString()}{phase.completed_at ? ` · Completed ${new Date(phase.completed_at).toLocaleDateString()}` : ''}</p>}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {/* Add new phase */}
            <div className="border border-dashed border-gray-300 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add Phase</h4>
              <div className="space-y-3">
                <input value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Phase name (e.g. MVP, Beta Launch, V2)" />
                <textarea value={newPhaseDesc} onChange={e => setNewPhaseDesc(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 resize-none" rows={3} placeholder="Goals, scope, and success criteria for this phase..." />
                <button onClick={async () => {
                  if (!newPhaseName.trim()) return;
                  setAddingPhase(true);
                  try {
                    await api.createPhase({ project: projectSlug, name: newPhaseName.trim(), description: newPhaseDesc.trim(), position: phases.length });
                    setNewPhaseName(''); setNewPhaseDesc('');
                    const ph = await api.getPhases(projectSlug); setPhases(ph);
                    toast('Phase added');
                  } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                  finally { setAddingPhase(false); }
                }} disabled={!newPhaseName.trim() || addingPhase}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                  {addingPhase ? 'Adding…' : 'Add Phase'}
                </button>
              </div>
            </div>
          </div>}

          {/* Status Permissions */}
          {activeTab === 'permissions' && <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Status Permissions</h3>
              <p className="text-sm text-gray-500 mt-0.5">Control who can move tickets into each status on this project. If no restriction is set, any project member can enter that status.</p>
            </div>

            <div className="space-y-4">
              {statuses.filter(s => !s.is_archived).map(s => {
                const perm = statusPerms.find(p => p.status_definition === s.id);
                const hasRestriction = perm && perm.allowed_users.length > 0;
                return (
                  <div key={s.id} className={`rounded-xl border p-4 ${hasRestriction ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color === 'gray' ? '#9ca3af' : s.color === 'blue' ? '#3b82f6' : s.color === 'red' ? '#ef4444' : s.color === 'green' ? '#22c55e' : s.color === 'yellow' ? '#eab308' : s.color === 'purple' ? '#a855f7' : s.color === 'orange' ? '#f97316' : s.color === 'indigo' ? '#6366f1' : s.color === 'pink' ? '#ec4899' : '#9ca3af' }} />
                        <span className="font-medium text-gray-900 text-sm">{s.label}</span>
                        <span className="text-xs text-gray-400 font-mono">{s.key}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hasRestriction ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {hasRestriction ? `${perm!.allowed_users.length} user${perm!.allowed_users.length !== 1 ? 's' : ''}` : 'Everyone'}
                      </span>
                    </div>

                    {/* User chips */}
                    {hasRestriction && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {perm!.allowed_users_details.map(u => (
                          <span key={u.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-white border border-gray-200">
                            {u.user_type === 'BOT' ? '🤖' : '👤'} {u.username}
                            <button onClick={async () => {
                              try {
                                const newUsers = perm!.allowed_users.filter(uid => uid !== u.id);
                                if (newUsers.length === 0) {
                                  await api.deleteProjectStatusPermission(perm!.id);
                                } else {
                                  await api.updateProjectStatusPermission(perm!.id, { allowed_users: newUsers });
                                }
                                setStatusPerms(await api.getProjectStatusPermissions(projectSlug));
                              } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                            }} className="text-red-400 hover:text-red-600 ml-0.5">×</button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Add user */}
                    <select value="" onChange={async (e) => {
                      const uid = Number(e.target.value);
                      if (!uid) return;
                      try {
                        if (perm) {
                          await api.updateProjectStatusPermission(perm.id, { allowed_users: [...perm.allowed_users, uid] });
                        } else {
                          await api.createProjectStatusPermission({ project: projectSlug, status_definition: s.id, allowed_users: [uid] });
                        }
                        setStatusPerms(await api.getProjectStatusPermissions(projectSlug));
                      } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                    }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="">+ Restrict to user…</option>
                      {projectAgents.filter(a => !perm?.allowed_users.includes(a.id)).map(a => (
                        <option key={a.id} value={a.id}>{a.username} ({a.user_type === 'BOT' ? '🤖' : '👤'})</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>}
        </div>
      </div>
    </Layout>
  );
}
