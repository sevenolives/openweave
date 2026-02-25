'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { api, Workspace, WorkspaceMember, WorkspaceInvite, StatusDefinition, StatusTransition } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

const COLORS = ['gray', 'blue', 'red', 'purple', 'amber', 'green', 'yellow', 'indigo', 'pink', 'orange'];
const COLOR_CLASSES: Record<string, string> = {
  gray: 'bg-gray-400', blue: 'bg-blue-500', red: 'bg-red-500', purple: 'bg-purple-500',
  amber: 'bg-amber-500', green: 'bg-green-500', yellow: 'bg-yellow-500', indigo: 'bg-indigo-500',
  pink: 'bg-pink-500', orange: 'bg-orange-500',
};

export default function WorkspaceSettingsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const { workspaces, refreshWorkspaces } = useWorkspace();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [transitions, setTransitions] = useState<StatusTransition[]>([]);
  const [newStatusKey, setNewStatusKey] = useState('');
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('gray');
  const [newStatusTerminal, setNewStatusTerminal] = useState(false);
  const [addingStatus, setAddingStatus] = useState(false);
  const [statusTab, setStatusTab] = useState<'statuses' | 'transitions'>('statuses');
  const { toast } = useToast();

  const loadData = useCallback(async (ws: Workspace) => {
    try {
      const [m, i, sd, st] = await Promise.all([
        api.getWorkspaceMembers({ workspace: String(ws.id) }),
        api.getInvites({ workspace: String(ws.id) }),
        api.getStatusDefinitions(ws.id),
        api.getStatusTransitions(ws.id),
      ]);
      setMembers(m);
      setInvites(i);
      setStatuses(sd);
      setTransitions(st);
    } catch (e: any) { toast(e?.message || 'Failed to load workspace data', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    const ws = workspaces.find(w => w.slug === workspaceSlug);
    if (ws) {
      setWorkspace(ws);
      setEditName(ws.name);
      setEditSlug(ws.slug);
      loadData(ws);
    }
  }, [workspaceSlug, workspaces, loadData]);

  const handleSaveWorkspace = async () => {
    if (!workspace) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const updated = await api.updateWorkspace(workspace.id, { name: editName, slug: editSlug });
      setWorkspace(updated);
      await refreshWorkspaces();
      toast('Workspace updated');
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to update workspace', 'error');
    }
    finally { setSaving(false); }
  };

  const handleRoleChange = async (memberId: number, role: string) => {
    try {
      await api.updateWorkspaceMember(memberId, { role });
      toast('Role updated');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to update role', 'error'); }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.removeWorkspaceMember(memberId);
      toast('Member removed');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to remove member', 'error'); }
  };

  const handleCreateInvite = async () => {
    if (!workspace) return;
    try {
      await api.createInvite({ workspace: workspace.id });
      toast('Invite created');
      loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to create invite', 'error'); }
  };

  const handleDeleteInvite = async (id: number) => {
    try {
      await api.deleteInvite(id);
      toast('Invite deleted');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to delete invite', 'error'); }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast('Invite link copied!');
  };

  const copyInviteCode = (token: string) => {
    navigator.clipboard.writeText(token);
    toast('Invite code copied for bot!');
  };

  const handleAddStatus = async () => {
    if (!workspace || !newStatusKey.trim() || !newStatusLabel.trim()) return;
    setAddingStatus(true);
    try {
      await api.createStatusDefinition({
        workspace: workspace.id,
        key: newStatusKey.toUpperCase().replace(/\s+/g, '_'),
        label: newStatusLabel,
        color: newStatusColor,
        is_terminal: newStatusTerminal,
        is_default: false,
        position: statuses.length,
      });
      setNewStatusKey(''); setNewStatusLabel(''); setNewStatusColor('gray'); setNewStatusTerminal(false);
      toast('Status created');
      loadData(workspace);
    } catch (e: any) { toast(e?.data?.key?.[0] || e?.data?.detail || e?.message || 'Failed', 'error'); }
    finally { setAddingStatus(false); }
  };

  const handleUpdateStatus = async (id: number, data: Partial<StatusDefinition>) => {
    try {
      await api.updateStatusDefinition(id, data);
      toast('Status updated');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to update', 'error'); }
  };

  const handleDeleteStatus = async (sd: StatusDefinition) => {
    if (!confirm(`Delete status "${sd.label}"? This will also remove its transitions.`)) return;
    try {
      await api.deleteStatusDefinition(sd.id);
      toast('Status deleted');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.data?.[0] || e?.message || 'Cannot delete', 'error'); }
  };

  const handleSetDefault = async (sd: StatusDefinition) => {
    // Unset old default, set new
    const oldDefault = statuses.find(s => s.is_default);
    try {
      if (oldDefault) await api.updateStatusDefinition(oldDefault.id, { is_default: false });
      await api.updateStatusDefinition(sd.id, { is_default: true });
      toast(`"${sd.label}" is now the default status`);
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };

  const handleAddTransition = async (fromId: number, toId: number, actorType: string) => {
    if (!workspace) return;
    try {
      await api.createStatusTransition({ workspace: workspace.id, from_status: fromId, to_status: toId, actor_type: actorType as StatusTransition['actor_type'] });
      toast('Transition added');
      loadData(workspace);
    } catch (e: any) { toast(e?.data?.non_field_errors?.[0] || e?.message || 'Failed', 'error'); }
  };

  const handleDeleteTransition = async (id: number) => {
    try {
      await api.deleteStatusTransition(id);
      toast('Transition removed');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };


  if (!workspace) return <Layout><div className="p-8 text-center text-gray-500">Workspace not found</div></Layout>;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{workspace.name} — Settings</h1>

        {/* Workspace Details */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Workspace Details</h2>
          </div>
          <div className="p-5 space-y-4">
            <FormField label="Name" error={fieldErrors.name} required>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass(fieldErrors.name)} />
            </FormField>
            <FormField label="Slug" error={fieldErrors.slug} required>
              <input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value)} className={inputClass(fieldErrors.slug)} />
            </FormField>
            <button onClick={handleSaveWorkspace} disabled={saving || !editName.trim() || !editSlug.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Members ({members.filter(m => m.user.id !== workspace?.owner).length + 1})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {/* Owner — always first, not removable */}
            {(workspace as any).owner_details && (
              <div className="px-5 py-3 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-amber-500">
                    {(workspace as any).owner_details.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{(workspace as any).owner_details.username}</p>
                    <p className="text-xs text-gray-500">{(workspace as any).owner_details.email}</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 text-sm font-semibold text-amber-700 bg-amber-100 rounded-lg">Owner</span>
              </div>
            )}
            {/* Regular members */}
            {members.filter(m => m.user.id !== workspace.owner).map(m => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${m.user.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                    {m.user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.user.username}</p>
                    <p className="text-xs text-gray-500">{m.user.email} · <span className={m.user.user_type === 'BOT' ? 'text-purple-600' : ''}>{m.user.user_type}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  <button onClick={() => handleRemoveMember(m.id)} className="px-3 py-2 text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-colors min-w-[80px]">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invites */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Invite Links</h2>
            <button onClick={handleCreateInvite} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">New Invite</button>
          </div>
          <div className="divide-y divide-gray-50">
            {invites.map(inv => (
              <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-700">{inv.token.slice(0, 8)}...</p>
                  <p className="text-xs text-gray-500">Uses: {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''} · {inv.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyInviteLink(inv.token)} className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded" title="For humans — opens invite page">👤 Link</button>
                  <button onClick={() => copyInviteCode(inv.token)} className="px-2 py-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded" title="Copy invite code for bots">🤖 Code</button>
                  <button onClick={() => { if (confirm('Delete this invite?')) handleDeleteInvite(inv.id); }} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded min-w-[44px] min-h-[44px] flex items-center justify-center" title="Delete invite">🗑️</button>
                </div>
              </div>
            ))}
            {invites.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">No invite links yet.</p>}
          </div>
        </div>
        {/* Status State Machine */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Status Configuration</h2>
            <p className="text-xs text-gray-500 mt-1">Define statuses and allowed transitions for tickets in this workspace.</p>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-4 flex gap-2">
            <button onClick={() => setStatusTab('statuses')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${statusTab === 'statuses' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Statuses</button>
            <button onClick={() => setStatusTab('transitions')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${statusTab === 'transitions' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Transitions</button>
          </div>

          {statusTab === 'statuses' && (
            <div className="p-5">
              {/* Status list */}
              <div className="space-y-2 mb-4">
                {statuses.map(sd => (
                  <div key={sd.id} className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
                    {/* Row 1: Color dot + label display + badges + actions */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_CLASSES[sd.color] || 'bg-gray-400'}`} />
                      <span className="text-sm font-semibold text-gray-900">{sd.label}</span>
                      <span className="text-xs font-mono text-gray-400">{sd.key}</span>
                      <div className="flex-1" />
                      {!sd.is_default && (
                        <button onClick={() => handleSetDefault(sd)} className="text-xs text-indigo-600 hover:text-indigo-800 p-1.5 rounded hover:bg-indigo-50 min-w-[44px] min-h-[44px] flex items-center justify-center" title="Set as default">⭐</button>
                      )}
                      {!sd.in_use && !sd.is_default && (
                        <button onClick={() => handleDeleteStatus(sd)} className="text-xs text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 min-w-[44px] min-h-[44px] flex items-center justify-center" title="Delete status">🗑️</button>
                      )}
                    </div>
                    {/* Row 2: Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {sd.is_terminal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Terminal</span>}
                      {sd.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">Default</span>}
                      {sd.in_use && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">In Use</span>}
                    </div>
                    {/* Row 3: Edit controls */}
                    <div className="flex gap-2">
                      <input type="text" value={sd.label} className="text-sm border border-gray-200 rounded px-2 py-1.5 flex-1 min-w-0" onBlur={e => { if (e.target.value !== sd.label) handleUpdateStatus(sd.id, { label: e.target.value }); }} onChange={e => { setStatuses(prev => prev.map(s => s.id === sd.id ? { ...s, label: e.target.value } : s)); }} />
                      <select value={sd.color} onChange={e => handleUpdateStatus(sd.id, { color: e.target.value })} className="text-sm border border-gray-200 rounded px-2 py-1.5 bg-white">
                        {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new status */}
              <div className="p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 space-y-3">
                <p className="text-xs font-medium text-gray-500">Add new status</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Key</label>
                    <input type="text" value={newStatusKey} onChange={e => setNewStatusKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder="QA_REVIEW" className="text-sm border border-gray-300 rounded px-2 py-2 w-full font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Label</label>
                    <input type="text" value={newStatusLabel} onChange={e => setNewStatusLabel(e.target.value)} placeholder="QA Review" className="text-sm border border-gray-300 rounded px-2 py-2 w-full" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Color</label>
                    <select value={newStatusColor} onChange={e => setNewStatusColor(e.target.value)} className="text-sm border border-gray-300 rounded px-2 py-2 bg-white">
                      {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer mt-4">
                    <input type="checkbox" checked={newStatusTerminal} onChange={e => setNewStatusTerminal(e.target.checked)} className="rounded" />
                    Terminal
                  </label>
                </div>
                <button onClick={handleAddStatus} disabled={addingStatus || !newStatusKey.trim() || !newStatusLabel.trim()} className="w-full px-3 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition min-h-[44px]">
                  {addingStatus ? 'Adding…' : '+ Add Status'}
                </button>
              </div>
            </div>
          )}

          {statusTab === 'transitions' && (
            <div className="p-5">
              <p className="text-xs text-gray-500 mb-4">Define which transitions are allowed. <strong>BOT</strong> transitions enforce rules for agents. <strong>HUMAN</strong> transitions allow humans to move between states. <strong>ALL</strong> applies to both.</p>

              {/* Transition matrix grouped by from_status */}
              {statuses.filter(s => !s.is_terminal).map(fromStatus => {
                const fromTransitions = transitions.filter(t => t.from_status === fromStatus.id);
                return (
                  <div key={fromStatus.id} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${COLOR_CLASSES[fromStatus.color] || 'bg-gray-400'}`} />
                      <span className="text-sm font-semibold text-gray-700">{fromStatus.label}</span>
                      <span className="text-xs text-gray-400">→</span>
                    </div>
                    <div className="ml-4 space-y-1">
                      {fromTransitions.map(t => {
                        const toStatus = statuses.find(s => s.id === t.to_status);
                        return (
                          <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.actor_type === 'BOT' ? 'bg-purple-100 text-purple-700' : t.actor_type === 'HUMAN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{t.actor_type}</span>
                            <span className="text-gray-600">{toStatus?.label || '?'}</span>
                            <button onClick={() => handleDeleteTransition(t.id)} className="text-red-400 hover:text-red-600 text-xs ml-auto">✕</button>
                          </div>
                        );
                      })}
                      {/* Add transition from this status */}
                      <div className="flex items-center gap-2 mt-1">
                        <select id={`add-to-${fromStatus.id}`} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white" defaultValue="">
                          <option value="" disabled>→ target…</option>
                          {statuses.filter(s => s.id !== fromStatus.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <select id={`add-actor-${fromStatus.id}`} className="text-xs border border-gray-200 rounded px-2 py-1 bg-white" defaultValue="BOT">
                          <option value="BOT">BOT</option>
                          <option value="HUMAN">HUMAN</option>
                          <option value="ALL">ALL</option>
                        </select>
                        <button onClick={() => {
                          const toEl = document.getElementById(`add-to-${fromStatus.id}`) as HTMLSelectElement;
                          const actorEl = document.getElementById(`add-actor-${fromStatus.id}`) as HTMLSelectElement;
                          if (toEl?.value) {
                            handleAddTransition(fromStatus.id, Number(toEl.value), actorEl.value);
                            toEl.value = '';
                          }
                        }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50">+ Add</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {statuses.filter(s => s.is_terminal).length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500"><strong>Terminal states</strong> (no outgoing transitions):</p>
                  <div className="flex gap-2 mt-1">
                    {statuses.filter(s => s.is_terminal).map(s => (
                      <span key={s.id} className="text-xs font-mono text-gray-600 px-2 py-0.5 rounded bg-white border border-gray-200">{s.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-red-200">
          <div className="px-5 py-4 border-b border-red-100">
            <h2 className="font-semibold text-red-600">Danger Zone</h2>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Delete this workspace</p>
              <p className="text-xs text-gray-500">This action cannot be undone. All projects, tickets, and data will be permanently deleted.</p>
            </div>
            <button
              onClick={async () => {
                if (!workspace) return;
                const confirmed = confirm(`Are you sure you want to delete "${workspace.name}"? This cannot be undone.`);
                if (!confirmed) return;
                try {
                  await api.deleteWorkspace(workspace.id);
                  toast('Workspace deleted');
                  await refreshWorkspaces();
                  router.push('/private/workspaces');
                } catch (e: any) { toast(e?.message || 'Failed to delete workspace', 'error'); }
              }}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors flex-shrink-0"
            >
              Delete Workspace
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
