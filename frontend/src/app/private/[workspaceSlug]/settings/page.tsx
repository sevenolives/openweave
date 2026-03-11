'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
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

const COLOR_HEX: Record<string, string> = {
  gray: '#9ca3af', red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b', purple: '#a855f7', pink: '#ec4899', indigo: '#6366f1',
  yellow: '#eab308', orange: '#f97316',
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
  const [newStatusApprovalGate, setNewStatusApprovalGate] = useState(false);
  const [addingStatus, setAddingStatus] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'members' | 'state-machine'>('general');
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

  // Roles are managed at project level, not workspace level

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
    if (!workspace || !newStatusLabel.trim()) return;
    const autoKey = newStatusLabel.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    setAddingStatus(true);
    try {
      await api.createStatusDefinition({
        workspace: workspace.id,
        key: autoKey,
        label: newStatusLabel,
        color: newStatusColor,
        is_terminal: newStatusTerminal,
        is_bot_requires_approval: newStatusApprovalGate,
        is_default: false,
        position: statuses.length,
      });
      setNewStatusKey(''); setNewStatusLabel(''); setNewStatusColor('gray'); setNewStatusTerminal(false); setNewStatusApprovalGate(false);
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

  const tabClass = (tab: string, active: boolean) => `px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${active ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{workspace.name} — Settings</h1>

        {/* Top-level tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button onClick={() => setSettingsTab('general')} className={tabClass('general', settingsTab === 'general')}>General</button>
          <button onClick={() => setSettingsTab('members')} className={tabClass('members', settingsTab === 'members')}>Members</button>
          <button onClick={() => setSettingsTab('state-machine')} className={tabClass('state-machine', settingsTab === 'state-machine')}>State Machine</button>
        </div>

        {/* === GENERAL TAB === */}
        {settingsTab === 'general' && (<>
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
        </>)}

        {/* === MEMBERS TAB === */}
        {settingsTab === 'members' && (<>
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
                  <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">Member</span>
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
        </>)}

        {/* === STATE MACHINE TAB === */}
        {settingsTab === 'state-machine' && (
          <StateMachineSettings
            statuses={statuses}
            transitions={transitions}
            setStatuses={setStatuses}
            newStatusLabel={newStatusLabel}
            setNewStatusLabel={setNewStatusLabel}
            newStatusColor={newStatusColor}
            setNewStatusColor={setNewStatusColor}
            newStatusTerminal={newStatusTerminal}
            setNewStatusTerminal={setNewStatusTerminal}
            handleAddStatus={handleAddStatus}
            handleUpdateStatus={handleUpdateStatus}
            handleDeleteStatus={handleDeleteStatus}
            handleSetDefault={handleSetDefault}
            handleAddTransition={handleAddTransition}
            handleDeleteTransition={handleDeleteTransition}
            toast={toast}
          />
        )}
      </div>
    </Layout>
  );
}
