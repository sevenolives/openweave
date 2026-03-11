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
  const [isSmall, setIsSmall] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [newActor, setNewActor] = useState<'BOT' | 'HUMAN' | 'ALL'>('BOT');
  const { toast } = useToast();

  useEffect(() => {
    const check = () => {
      const width = window.innerWidth;
      setIsSmall(width <= 768);
      setIsMobile(width <= 640);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
        {settingsTab === 'state-machine' && (() => {
          const COLORS_HEX: Record<string, string> = {
            gray: '#9ca3af', blue: '#3b82f6', red: '#ef4444', purple: '#a855f7',
            amber: '#f59e0b', green: '#22c55e', yellow: '#eab308', indigo: '#6366f1',
            pink: '#ec4899', orange: '#f97316',
          };

          const ACTOR_COLORS: Record<string, string> = {
            BOT: '#a855f7', HUMAN: '#3b82f6', ALL: '#6b7280',
          };

          const tabStyle = (v: 'diagram' | 'statuses' | 'transitions'): React.CSSProperties => ({
            padding: isMobile ? '16px 12px' : isSmall ? '14px 16px' : '12px 20px',
            fontSize: isMobile ? '15px' : isSmall ? '14px' : '13px',
            fontWeight: 600,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            borderBottom: statusTab === v ? '3px solid #818cf8' : '3px solid transparent',
            color: statusTab === v ? '#a5b4fc' : '#6b7280',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: isMobile ? '56px' : isSmall ? '48px' : 'auto',
            flex: isMobile || isSmall ? '1' : 'none',
            textAlign: 'center',
            position: 'relative',
          });

          const btnStyle: React.CSSProperties = {
            padding: isMobile ? '16px 24px' : isSmall ? '14px 20px' : '10px 18px',
            fontSize: isMobile ? '15px' : isSmall ? '14px' : '13px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            color: 'white',
            border: 'none',
            borderRadius: isMobile ? '12px' : '10px',
            cursor: 'pointer',
            minHeight: isMobile ? '52px' : isSmall ? '48px' : '38px',
            boxShadow: '0 4px 14px rgba(79,70,229,0.25), 0 1px 3px rgba(0,0,0,0.1)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            userSelect: 'none',
          };

          const inputStyle: React.CSSProperties = {
            padding: '12px 16px',
            fontSize: '14px',
            border: '1px solid #3f3f46',
            borderRadius: '12px',
            outline: 'none',
            background: 'rgba(24, 24, 27, 0.8)',
            backdropFilter: 'blur(8px)',
            color: '#e5e7eb',
            minHeight: '44px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          };

          const selectStyle: React.CSSProperties = { 
            ...inputStyle, 
            paddingRight: isMobile ? '48px' : '36px',
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none',
            height: '44px',
            boxSizing: 'border-box',
          };

          const removeBtnStyle: React.CSSProperties = {
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: isMobile ? '18px' : isSmall ? '16px' : '14px',
            padding: isMobile ? '12px' : isSmall ? '10px' : '8px',
            borderRadius: isMobile ? '10px' : '8px',
            minWidth: isMobile ? '44px' : isSmall ? '40px' : '32px',
            minHeight: isMobile ? '44px' : isSmall ? '40px' : '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            userSelect: 'none',
          };

          const addTransition = () => {
            if (!fromId || !toId || fromId === toId) return;
            const f = Number(fromId), t = Number(toId);
            if (transitions.some((tr: any) => tr.from_status === f && tr.to_status === t)) {
              toast('This transition already exists', 'error');
              return;
            }
            handleAddTransition(f, t, newActor);
            setFromId('');
            setToId('');
          };

          return (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #27272a', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', background: '#18181b' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #27272a', background: 'linear-gradient(135deg, #111 0%, #0f0f0f 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
                <button onClick={() => setStatusTab('diagram')} style={tabStyle('diagram')}>⬡ Diagram</button>
                <button onClick={() => setStatusTab('statuses')} style={tabStyle('statuses')}>● States</button>
                <button onClick={() => setStatusTab('transitions')} style={tabStyle('transitions')}>→ Transitions</button>
              </div>

              {/* Diagram tab */}
              {statusTab === 'diagram' && (
                <div>
                  <div style={{ 
                    height: isMobile ? 320 : isSmall ? 380 : 480, 
                    width: '100%', 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {statuses.length === 0 ? (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '60px 20px', 
                        color: '#6b7280', 
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '12px',
                        border: '1px dashed #374151',
                        margin: '40px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 'calc(100% - 80px)'
                      }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⬡</div>
                        <p style={{ fontSize: '16px', marginBottom: '8px', color: '#374151' }}>No states defined yet</p>
                        <p style={{ fontSize: '14px', opacity: 0.7, color: '#374151' }}>Add your first state in the States tab to get started</p>
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
                        panOnScroll={!isMobile}
                        zoomOnScroll={!isMobile}
                        zoomOnPinch={isMobile}
                        panOnDrag={true}
                        preventScrolling={isMobile}
                      >
                        <Background 
                          gap={isMobile ? 15 : 20} 
                          size={1} 
                          color="#cbd5e1"
                        />
                        <Controls 
                          showInteractive={false}
                          position={isMobile ? 'bottom-left' : 'bottom-right'}
                        />
                      </ReactFlow>
                    )}
                    
                    {/* Mobile help overlay */}
                    {isMobile && statuses.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.75)',
                        backdropFilter: 'blur(8px)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 500,
                        textAlign: 'center',
                        opacity: 0.9,
                        pointerEvents: 'none',
                        zIndex: 10,
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        👆 Pinch to zoom • Drag to pan
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: isSmall ? '16px 12px' : '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: isSmall ? 'flex-start' : 'center',
                    flexDirection: isSmall ? 'column' : 'row',
                    gap: isSmall ? '12px' : '8px',
                    borderTop: '1px solid #27272a',
                    background: '#111',
                  }}>
                    <div style={{ display: 'flex', gap: isSmall ? 8 : 16, fontSize: isSmall ? 12 : 11, color: '#6b7280', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span>🤖 <span style={{ color: '#a855f7' }}>Bot (animated)</span></span>
                      <span>👤 <span style={{ color: '#3b82f6' }}>Human (dashed)</span></span>
                      <span>🔄 <span style={{ color: '#6b7280' }}>All</span></span>
                      <span>⭐ Default state</span>
                      <span>🏁 Terminal state</span>
                    </div>
                    {humanOnlyTerminals.length > 0 && (
                      <div style={{
                        fontSize: isSmall ? 12 : 11,
                        color: '#d97706',
                        fontWeight: 600,
                        background: 'rgba(217,119,6,0.1)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(217,119,6,0.3)',
                      }}>
                        ⚠ Human-only: {humanOnlyTerminals.map((s) => s.label).join(', ')}
                      </div>
                    )}
                    {statuses.filter((s) => s.is_bot_requires_approval).length > 0 && (
                      <div style={{
                        fontSize: isSmall ? 13 : 12,
                        color: '#eab308',
                        fontWeight: 600,
                        background: 'rgba(234,179,8,0.1)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(234,179,8,0.2)',
                      }}>
                        🔒 Approval gate: {statuses.filter((s) => s.is_bot_requires_approval).map((s) => s.label).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* States tab */}
              {statusTab === 'statuses' && (
                <div style={{ padding: isSmall ? 12 : 16 }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: isSmall ? 16 : 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>Workflow States</h3>
                    <p style={{ fontSize: isSmall ? 14 : 13, color: '#9ca3af', lineHeight: 1.5 }}>
                      Define the statuses your tickets can be in. Mark terminal states and set one as default.
                    </p>
                  </div>

                  {statuses.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '60px 20px', 
                      color: '#6b7280', 
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '12px',
                      border: '1px dashed #374151'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>⬡</div>
                      <p style={{ fontSize: '16px', marginBottom: '8px' }}>No states defined yet</p>
                      <p style={{ fontSize: '14px', opacity: 0.7 }}>Add your first state below to get started</p>
                    </div>
                  ) : (
                    statuses.map((s) => (
                      <div key={s.id} style={{
                        display: 'flex',
                        alignItems: isMobile ? 'flex-start' : isSmall ? 'flex-start' : 'center',
                        gap: isMobile ? 12 : isSmall ? 10 : 12,
                        padding: isMobile ? '20px' : isSmall ? '16px' : '14px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        marginBottom: '12px',
                        flexDirection: isMobile || isSmall ? 'column' : 'row',
                        transition: 'all 0.2s ease',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            position: 'relative',
                            width: isMobile ? 24 : 20, 
                            height: isMobile ? 24 : 20,
                            borderRadius: '50%',
                            background: COLORS_HEX[s.color] || '#9ca3af',
                            flexShrink: 0,
                            boxShadow: `0 0 0 3px ${(COLORS_HEX[s.color] || '#9ca3af')}20`,
                            cursor: 'pointer'
                          }}>
                            <select
                              value={s.color}
                              onChange={(e) => handleUpdateStatus(s.id, { color: e.target.value })}
                              style={{ 
                                position: 'absolute',
                                inset: 0,
                                opacity: 0,
                                cursor: 'pointer',
                                width: '100%',
                                height: '100%'
                              }}
                              title="Change color"
                            >
                              {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <input
                            value={s.label}
                            onChange={(e) => {
                              const newLabel = e.target.value;
                              setStatuses(prev => prev.map(st => st.id === s.id ? { ...st, label: newLabel } : st));
                            }}
                            style={{ 
                              fontSize: isMobile ? 16 : isSmall ? 15 : 14, 
                              fontWeight: 600, 
                              color: '#e5e7eb', 
                              background: 'transparent', 
                              border: '1px solid transparent', 
                              borderRadius: '8px', 
                              padding: '8px 12px', 
                              outline: 'none', 
                              flex: 1, 
                              minWidth: 0,
                              transition: 'all 0.2s ease'
                            }}
                            onFocus={(e) => { 
                              e.target.style.borderColor = '#4f46e5'; 
                              e.target.style.background = 'rgba(24,24,27,0.8)';
                              e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)';
                            }}
                            onBlur={(e) => { 
                              e.target.style.borderColor = 'transparent'; 
                              e.target.style.background = 'transparent';
                              e.target.style.boxShadow = 'none';
                              if (e.target.value !== s.label) {
                                handleUpdateStatus(s.id, { label: e.target.value });
                              }
                            }}
                          />
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          gap: isMobile ? 10 : 8, 
                          alignItems: 'center', 
                          flexWrap: 'wrap',
                          width: isMobile || isSmall ? '100%' : 'auto'
                        }}>
                          <button
                            onClick={() => !s.is_default && handleSetDefault(s)}
                            disabled={s.is_default}
                            style={{
                              fontSize: isMobile ? 13 : isSmall ? 12 : 11,
                              background: s.is_default 
                                ? 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)' 
                                : 'rgba(39,39,42,0.8)',
                              color: s.is_default ? '#a5b4fc' : '#9ca3af',
                              border: s.is_default ? 'none' : '1px solid #3f3f46',
                              padding: isMobile ? '10px 16px' : isSmall ? '8px 12px' : '6px 10px',
                              borderRadius: isMobile ? '10px' : '8px',
                              fontWeight: 600,
                              cursor: s.is_default ? 'default' : 'pointer',
                              minHeight: isMobile ? '40px' : '32px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {s.is_default ? '⭐ Default' : 'Set Default'}
                          </button>
                          <button
                            onClick={() => {
                              handleUpdateStatus(s.id, { is_terminal: !s.is_terminal });
                            }}
                            style={{
                              fontSize: isMobile ? 13 : isSmall ? 12 : 11,
                              background: s.is_terminal ? 'rgba(39,39,42,0.8)' : 'transparent',
                              color: s.is_terminal ? '#9ca3af' : '#6b7280',
                              border: s.is_terminal ? '1px solid #3f3f46' : '1px dashed #3f3f46',
                              padding: isMobile ? '10px 16px' : isSmall ? '8px 12px' : '6px 10px',
                              borderRadius: isMobile ? '10px' : '8px',
                              fontWeight: 600, 
                              cursor: 'pointer',
                              minHeight: isMobile ? '40px' : '32px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {s.is_terminal ? '🏁 Terminal' : 'Non-terminal'}
                          </button>
                          <button
                            onClick={() => {
                              handleUpdateStatus(s.id, { is_bot_requires_approval: !s.is_bot_requires_approval });
                            }}
                            style={{
                              fontSize: isMobile ? 13 : isSmall ? 12 : 11,
                              background: s.is_bot_requires_approval ? 'rgba(234,179,8,0.15)' : 'transparent',
                              color: s.is_bot_requires_approval ? '#eab308' : '#6b7280',
                              border: s.is_bot_requires_approval ? '1px solid rgba(234,179,8,0.3)' : '1px dashed #3f3f46',
                              padding: isMobile ? '10px 16px' : isSmall ? '8px 12px' : '6px 10px',
                              borderRadius: isMobile ? '10px' : '8px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              minHeight: isMobile ? '40px' : '32px',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {s.is_bot_requires_approval ? '🔒 Approval Gate' : 'No gate'}
                          </button>
                          {!s.in_use && !s.is_default && (
                            <button onClick={() => handleDeleteStatus(s)} style={removeBtnStyle}>✕</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  <div style={{ display: 'flex', gap: isSmall ? 12 : 8, marginTop: 20, alignItems: isSmall ? 'stretch' : 'center', flexDirection: isSmall ? 'column' : 'row', flexWrap: isSmall ? 'nowrap' : 'wrap' }}>
                    <input
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddStatus()}
                      placeholder="Status name..."
                      style={{ ...inputStyle, flex: isSmall ? 'none' : '1', minWidth: isSmall ? '100%' : 120 }}
                    />
                    <div style={{ display: 'flex', gap: isSmall ? 12 : 8, alignItems: 'center', flexDirection: isSmall ? 'column' : 'row', width: isSmall ? '100%' : 'auto' }}>
                      <select value={newStatusColor} onChange={(e) => setNewStatusColor(e.target.value)} style={{ ...selectStyle, width: isSmall ? '100%' : 'auto' }}>
                        {COLORS.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                      <label style={{ fontSize: isSmall ? 14 : 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                        <input type="checkbox" checked={newStatusTerminal} onChange={(e) => setNewStatusTerminal(e.target.checked)} style={{ width: isSmall ? 18 : 14, height: isSmall ? 18 : 14, cursor: 'pointer' }} />
                        Terminal state
                      </label>
                      <button 
                        onClick={handleAddStatus} 
                        disabled={!newStatusLabel.trim()} 
                        style={{ 
                          ...btnStyle, 
                          opacity: !newStatusLabel.trim() ? 0.5 : 1, 
                          cursor: !newStatusLabel.trim() ? 'not-allowed' : 'pointer', 
                          width: isSmall ? '100%' : 'auto' 
                        }}
                      >
                        + Add Status
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Transitions tab */}
              {statusTab === 'transitions' && (
                <div style={{ padding: isSmall ? 12 : 16 }}>
                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: isSmall ? 16 : 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>State Transitions</h3>
                    <p style={{ fontSize: isSmall ? 14 : 13, color: '#9ca3af', lineHeight: 1.5 }}>
                      Define allowed moves between states and who can make them.
                    </p>
                  </div>

                  {transitions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280', fontStyle: 'italic' }}>
                      No transitions defined yet. Add your first transition below.
                    </div>
                  ) : (
                    transitions.map((t) => {
                      const f = statuses.find((s) => s.id === t.from_status);
                      const to = statuses.find((s) => s.id === t.to_status);
                      return (
                        <div key={t.id} style={{
                          display: 'flex',
                          alignItems: isSmall ? 'flex-start' : 'center',
                          gap: isSmall ? 6 : 10,
                          padding: isSmall ? '8px 0' : '8px 0',
                          borderBottom: '1px solid #27272a',
                          fontSize: isSmall ? 14 : 13,
                          flexDirection: isSmall ? 'column' : 'row',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                            <select
                              value={t.from_status}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (v === t.to_status) return;
                                // Update transition via API
                                handleDeleteTransition(t.id);
                                handleAddTransition(v, t.to_status, t.actor_type);
                              }}
                              style={{ ...selectStyle, fontSize: isSmall ? 13 : 12, padding: isSmall ? '0 14px' : '4px 8px', minWidth: isSmall ? 100 : 80, height: isSmall ? 44 : 'auto', minHeight: isSmall ? 44 : 'auto' }}
                            >
                              {statuses.filter((s) => !s.is_terminal).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <span style={{ color: '#6b7280', fontWeight: 600, fontSize: isSmall ? 16 : 14 }}>→</span>
                            <select
                              value={t.to_status}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (v === t.from_status) return;
                                // Update transition via API
                                handleDeleteTransition(t.id);
                                handleAddTransition(t.from_status, v, t.actor_type);
                              }}
                              style={{ ...selectStyle, fontSize: isSmall ? 13 : 12, padding: isSmall ? '0 14px' : '4px 8px', minWidth: isSmall ? 100 : 80, height: isSmall ? 44 : 'auto', minHeight: isSmall ? 44 : 'auto' }}
                            >
                              {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <select
                              value={t.actor_type}
                              onChange={(e) => {
                                // Update transition via API
                                handleDeleteTransition(t.id);
                                handleAddTransition(t.from_status, t.to_status, e.target.value);
                              }}
                              style={{
                                fontSize: isSmall ? 13 : 10, fontWeight: 700,
                                padding: isSmall ? '0 14px' : '4px 8px', borderRadius: isSmall ? 10 : 6,
                                color: 'white', background: ACTOR_COLORS[t.actor_type],
                                border: '1px solid ' + ACTOR_COLORS[t.actor_type],
                                cursor: 'pointer', height: isSmall ? 44 : 'auto', minHeight: isSmall ? 44 : 'auto',
                              }}
                            >
                              <option value="BOT" style={{ background: '#18181b', color: '#e5e7eb' }}>BOT</option>
                              <option value="HUMAN" style={{ background: '#18181b', color: '#e5e7eb' }}>HUMAN</option>
                              <option value="ALL" style={{ background: '#18181b', color: '#e5e7eb' }}>ALL</option>
                            </select>
                            <button onClick={() => handleDeleteTransition(t.id)} style={removeBtnStyle}>✕</button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div style={{ display: 'flex', gap: isSmall ? 12 : 8, marginTop: 20, alignItems: isSmall ? 'stretch' : 'center', flexDirection: isSmall ? 'column' : 'row', flexWrap: isSmall ? 'nowrap' : 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 6, flex: isSmall ? 'none' : '1', minWidth: isSmall ? '100%' : 200 }}>
                      <select value={fromId} onChange={(e) => setFromId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                        <option value="">From...</option>
                        {statuses.filter((s) => !s.is_terminal).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <span style={{ color: '#6b7280', fontWeight: 600, fontSize: isSmall ? 16 : 14, flexShrink: 0 }}>→</span>
                      <select value={toId} onChange={(e) => setToId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                        <option value="">To...</option>
                        {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: isSmall ? 12 : 8, alignItems: 'center', flexDirection: isSmall ? 'column' : 'row', width: isSmall ? '100%' : 'auto' }}>
                      <select value={newActor} onChange={(e) => setNewActor(e.target.value as 'BOT' | 'HUMAN' | 'ALL')} style={{ ...selectStyle, width: isSmall ? '100%' : 'auto' }}>
                        <option value="BOT">Bot Only</option>
                        <option value="HUMAN">Human Only</option>
                        <option value="ALL">Bot or Human</option>
                      </select>
                      <button
                        onClick={addTransition}
                        disabled={!fromId || !toId || fromId === toId}
                        style={{ ...btnStyle, opacity: (!fromId || !toId || fromId === toId) ? 0.5 : 1, cursor: (!fromId || !toId || fromId === toId) ? 'not-allowed' : 'pointer', width: isSmall ? '100%' : 'auto' }}
                      >
                        + Add Transition
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}
