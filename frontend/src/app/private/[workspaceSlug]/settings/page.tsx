'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [statusTab, setStatusTab] = useState<'diagram' | 'statuses' | 'transitions'>('diagram');
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
    if (!workspace || !newStatusKey.trim() || !newStatusLabel.trim()) return;
    setAddingStatus(true);
    try {
      await api.createStatusDefinition({
        workspace: workspace.id,
        key: newStatusKey.toUpperCase().replace(/\s+/g, '_'),
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

  // Diagram building functions
  const buildNodes = useMemo(() => {
    if (statuses.length === 0) return [];
    
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });
    g.setDefaultEdgeLabel(() => ({}));
    statuses.forEach((s) => g.setNode(String(s.id), { width: 140, height: 40 }));
    transitions.forEach((t) => g.setEdge(String(t.from_status), String(t.to_status)));
    dagre.layout(g);

    return statuses.map((s) => {
      const nd = g.node(String(s.id));
      const color = COLOR_HEX[s.color] || '#9ca3af';
      return {
        id: String(s.id),
        position: { x: (nd?.x ?? 0) - 70, y: (nd?.y ?? 0) - 20 },
        data: { label: s.is_bot_requires_approval ? `🔒 ${s.label}` : s.label },
        type: 'default',
        style: {
          background: 'white',
          border: `2px solid ${color}`,
          borderRadius: s.is_terminal ? '20px' : '8px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#1f2937',
          boxShadow: s.is_default ? `0 0 0 3px ${color}44` : '0 1px 4px rgba(0,0,0,0.1)',
          minWidth: '100px',
          textAlign: 'center' as const,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    });
  }, [statuses, transitions]);

  const buildEdges = useMemo(() => {
    const ACTOR_COLORS = {
      BOT: '#a855f7', 
      HUMAN: '#3b82f6', 
      ALL: '#6b7280',
    };

    return transitions.map((t) => {
      const targetStatus = statuses.find((s) => s.id === t.to_status);
      const isGatedBot = (t.actor_type === 'BOT' || t.actor_type === 'ALL') && targetStatus?.is_bot_requires_approval;
      const edgeColor = isGatedBot ? '#eab308' : ACTOR_COLORS[t.actor_type];
      
      return {
        id: `e${t.id}`,
        source: String(t.from_status),
        target: String(t.to_status),
        animated: t.actor_type === 'BOT' && !isGatedBot,
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
          strokeDasharray: t.actor_type === 'HUMAN' ? '5,5' : isGatedBot ? '8,4' : 'none',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 14,
          height: 14,
        },
        label: isGatedBot ? `${t.actor_type} 🔒` : t.actor_type,
        labelStyle: { fontSize: 9, fontWeight: 700, fill: edgeColor },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
      };
    });
  }, [transitions, statuses]);

  // Check for human-only terminals (for warnings)
  const humanOnlyTerminals = useMemo(() => {
    const botTransitions = transitions.filter((t) => t.actor_type === 'BOT' || t.actor_type === 'ALL');
    const defaultStatus = statuses.find((s) => s.is_default);
    if (!defaultStatus) return [];
    
    const reached = new Set<number>();
    const queue = [defaultStatus.id];
    while (queue.length) {
      const current = queue.shift()!;
      botTransitions.forEach((t) => {
        if (t.from_status === current && !reached.has(t.to_status)) {
          reached.add(t.to_status);
          queue.push(t.to_status);
        }
      });
    }
    
    return statuses.filter((s) => s.is_terminal && !reached.has(s.id));
  }, [statuses, transitions]);


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
        {settingsTab === 'state-machine' && (<>
        {/* Status State Machine */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Status Configuration</h2>
            <p className="text-xs text-gray-500 mt-1">Define statuses and allowed transitions for tickets in this workspace.</p>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-4 flex gap-2">
            <button onClick={() => setStatusTab('diagram')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${statusTab === 'diagram' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Diagram</button>
            <button onClick={() => setStatusTab('statuses')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${statusTab === 'statuses' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Statuses</button>
            <button onClick={() => setStatusTab('transitions')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${statusTab === 'transitions' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}>Transitions</button>
          </div>

          {statusTab === 'diagram' && (
            <div>
              <div style={{ 
                height: '500px',
                width: '100%', 
                background: 'white',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {statuses.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-4">⬡</div>
                      <p className="text-lg mb-2">No statuses defined yet</p>
                      <p className="text-sm opacity-70">Add statuses in the Statuses tab to see the diagram</p>
                    </div>
                  </div>
                ) : (
                  <ReactFlow
                    nodes={buildNodes}
                    edges={buildEdges}
                    fitView
                    fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.1}
                    maxZoom={2}
                    panOnScroll={true}
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                    panOnDrag={true}
                  >
                    <Background 
                      gap={20} 
                      size={1} 
                      color="#cbd5e1"
                    />
                    <Controls 
                      showInteractive={false}
                      position="bottom-right"
                    />
                  </ReactFlow>
                )}
              </div>
              
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-purple-500"></span>
                    <span>🤖 Bot (animated)</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-0.5 border-b-2 border-dashed border-blue-500"></span>
                    <span>👤 Human (dashed)</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-0.5 bg-gray-500"></span>
                    <span>🔄 All</span>
                  </span>
                  <span>⭐ Default state</span>
                  <span>🏁 Terminal state</span>
                </div>
                
                {humanOnlyTerminals.length > 0 && (
                  <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-sm font-medium text-amber-700">
                      ⚠ Human-only terminals: {humanOnlyTerminals.map((s) => s.label).join(', ')}
                    </span>
                  </div>
                )}
                
                {statuses.filter((s) => s.is_bot_requires_approval).length > 0 && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <span className="text-sm font-medium text-yellow-700">
                      🔒 Approval gates: {statuses.filter((s) => s.is_bot_requires_approval).map((s) => s.label).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

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
                      <button onClick={() => handleUpdateStatus(sd.id, { is_terminal: !sd.is_terminal })} className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 ${sd.is_terminal ? 'bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400 border border-dashed border-gray-300'}`}>{sd.is_terminal ? '● Terminal' : '○ Non-terminal'}</button>
                      <button onClick={() => handleUpdateStatus(sd.id, { is_bot_requires_approval: !sd.is_bot_requires_approval })} className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 ${sd.is_bot_requires_approval ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-50 text-gray-400 border border-dashed border-gray-300'}`}>{sd.is_bot_requires_approval ? '🔒 Approval Gate' : 'No gate'}</button>
                      {sd.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">Default</span>}
                      {sd.in_use && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">In Use</span>}
                    </div>
                    {/* Row 3: Edit controls */}
                    <div className="flex gap-2">
                      <input type="text" value={sd.label} className="px-4 py-3 text-sm border border-gray-200 rounded-xl flex-1 min-w-0" onBlur={e => { if (e.target.value !== sd.label) handleUpdateStatus(sd.id, { label: e.target.value }); }} onChange={e => { setStatuses(prev => prev.map(s => s.id === sd.id ? { ...s, label: e.target.value } : s)); }} />
                      <select value={sd.color} onChange={e => handleUpdateStatus(sd.id, { color: e.target.value })} className="px-4 py-3 h-[44px] text-sm border border-gray-200 rounded-xl bg-white">
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
                    <input type="text" value={newStatusKey} onChange={e => setNewStatusKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder="QA_REVIEW" className="px-4 py-3 text-sm border border-gray-300 rounded-xl w-full font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Label</label>
                    <input type="text" value={newStatusLabel} onChange={e => setNewStatusLabel(e.target.value)} placeholder="QA Review" className="px-4 py-3 text-sm border border-gray-300 rounded-xl w-full" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Color</label>
                    <select value={newStatusColor} onChange={e => setNewStatusColor(e.target.value)} className="px-4 py-3 h-[44px] text-sm border border-gray-300 rounded-xl bg-white">
                      {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer mt-4">
                    <input type="checkbox" checked={newStatusTerminal} onChange={e => setNewStatusTerminal(e.target.checked)} className="rounded" />
                    Terminal
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer mt-4">
                    <input type="checkbox" checked={newStatusApprovalGate} onChange={e => setNewStatusApprovalGate(e.target.checked)} className="rounded" />
                    Approval Gate
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
              <p className="text-xs text-gray-500 mb-3">Allowed moves between states. Each has an actor: <strong>Bot</strong>, <strong>Human</strong>, or <strong>All</strong>.</p>

              {/* Flat transition list */}
              <div className="divide-y divide-gray-100 mb-4">
                {transitions.map(t => {
                  const from = statuses.find(s => s.id === t.from_status);
                  const to = statuses.find(s => s.id === t.to_status);
                  return (
                    <div key={t.id} className="flex items-center gap-2 py-2">
                      <span className="text-sm text-gray-700 min-w-[80px]">{from?.label || '?'}</span>
                      <span className="text-gray-400 text-xs">→</span>
                      <span className="text-sm text-gray-700 min-w-[80px]">{to?.label || '?'}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded text-xs font-bold text-white ${t.actor_type === 'BOT' ? 'bg-purple-500' : t.actor_type === 'HUMAN' ? 'bg-blue-500' : 'bg-gray-500'}`}>{t.actor_type}</span>
                      <button onClick={() => handleDeleteTransition(t.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 min-w-[32px] min-h-[32px] flex items-center justify-center">✕</button>
                    </div>
                  );
                })}
                {transitions.length === 0 && <p className="py-4 text-sm text-gray-400 text-center">No transitions yet</p>}
              </div>

              {/* Add transition */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50">
                <select id="add-from" className="px-3 py-2 h-[40px] text-sm border border-gray-300 rounded-lg bg-white flex-1 min-w-[100px]" defaultValue="">
                  <option value="" disabled>From…</option>
                  {statuses.filter(s => !s.is_terminal).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <span className="text-gray-400 text-sm">→</span>
                <select id="add-to" className="px-3 py-2 h-[40px] text-sm border border-gray-300 rounded-lg bg-white flex-1 min-w-[100px]" defaultValue="">
                  <option value="" disabled>To…</option>
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select id="add-actor" className="px-3 py-2 h-[40px] text-sm border border-gray-300 rounded-lg bg-white" defaultValue="BOT">
                  <option value="BOT">Bot</option>
                  <option value="HUMAN">Human</option>
                  <option value="ALL">All</option>
                </select>
                <button onClick={() => {
                  const fromEl = document.getElementById('add-from') as HTMLSelectElement;
                  const toEl = document.getElementById('add-to') as HTMLSelectElement;
                  const actorEl = document.getElementById('add-actor') as HTMLSelectElement;
                  if (fromEl?.value && toEl?.value) {
                    handleAddTransition(Number(fromEl.value), Number(toEl.value), actorEl.value);
                    fromEl.value = ''; toEl.value = '';
                  }
                }} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 min-h-[40px]">+ Add</button>
              </div>
            </div>
          )}
        </div>
        </>)}
      </div>
    </Layout>
  );
}
