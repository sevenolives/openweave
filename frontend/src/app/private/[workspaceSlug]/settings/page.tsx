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
import { api, Workspace, WorkspaceMember, WorkspaceInvite, StatusDefinition, User } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

const COLORS = ['gray', 'blue', 'red', 'purple', 'amber', 'green', 'yellow', 'indigo', 'pink', 'orange'];

const COLOR_HEX: Record<string, string> = {
  gray: '#9ca3af', red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b', purple: '#a855f7', pink: '#ec4899', indigo: '#6366f1',
  yellow: '#eab308', orange: '#f97316', cyan: '#06b6d4',
};

/* ── State Machine Tab ── */

interface StateMachineSettingsProps {
  statuses: StatusDefinition[];
  setStatuses: React.Dispatch<React.SetStateAction<StatusDefinition[]>>;
  newStatusLabel: string;
  setNewStatusLabel: (v: string) => void;
  newStatusColor: string;
  setNewStatusColor: (v: string) => void;
  handleAddStatus: () => void;
  handleUpdateStatus: (id: number, data: Partial<StatusDefinition>) => Promise<void>;
  handleDeleteStatus: (sd: StatusDefinition) => Promise<void>;
  handleSetDefault: (sd: StatusDefinition) => Promise<void>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  workspaceMembers: User[];
}

function StateMachineSettings({
  statuses, setStatuses,
  newStatusLabel, setNewStatusLabel, newStatusColor, setNewStatusColor,
  handleAddStatus, handleUpdateStatus, handleDeleteStatus, handleSetDefault,
  toast, workspaceMembers,
}: StateMachineSettingsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [specificUserMode, setSpecificUserMode] = useState<Set<number>>(new Set());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Build diagram nodes/edges from statuses + allowed_from relationships
  const activeStatuses = useMemo(() => statuses.filter(s => !s.is_archived), [statuses]);
  const buildNodes = useMemo(() => {
    if (activeStatuses.length === 0) return [];
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });
    g.setDefaultEdgeLabel(() => ({}));
    activeStatuses.forEach((s) => g.setNode(String(s.id), { width: 140, height: 40 }));
    // Build edges from allowed_from relationships
    const activeIds = new Set(activeStatuses.map(s => s.id));
    activeStatuses.forEach((target) => {
      if (target.allowed_from && target.allowed_from.length > 0) {
        target.allowed_from.filter(id => activeIds.has(id)).forEach((srcId) => {
          g.setEdge(String(srcId), String(target.id));
        });
      }
    });
    dagre.layout(g);
    return activeStatuses.map((s) => {
      const nd = g.node(String(s.id));
      const color = COLOR_HEX[s.color] || '#9ca3af';
      return {
        id: String(s.id),
        position: { x: (nd?.x ?? 0) - 70, y: (nd?.y ?? 0) - 20 },
        data: { label: s.label },
        type: 'default',
        style: {
          background: 'white',
          border: `2px solid ${color}`,
          borderRadius: '8px',
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
  }, [activeStatuses]);

  const buildEdges = useMemo(() => {
    const edges: Edge[] = [];
    const activeIds = new Set(activeStatuses.map(s => s.id));
    activeStatuses.forEach((target) => {
      if (target.allowed_from && target.allowed_from.length > 0) {
        target.allowed_from.filter(id => activeIds.has(id)).forEach((srcId) => {
          const hasRestriction = target.allowed_users && target.allowed_users.length > 0;
          const color = hasRestriction ? '#f59e0b' : '#6b7280';
          edges.push({
            id: `e-${srcId}-${target.id}`,
            source: String(srcId),
            target: String(target.id),
            animated: false,
            style: { stroke: color, strokeWidth: 2, strokeDasharray: hasRestriction ? '5,5' : 'none' },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
            label: hasRestriction ? 'restricted' : '',
            labelStyle: { fontSize: 9, fontWeight: 700, fill: color },
            labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
          });
        });
      }
    });
    return edges;
  }, [activeStatuses]);

  const updateLocalStatus = (id: number, updates: Partial<StatusDefinition>) => {
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Track original values for blur-save comparison
  const focusRef = React.useRef<Record<string, string>>({});

  // Auto-save when gate settings change — send only the changed fields
  const updateAndSave = async (id: number, updates: Partial<StatusDefinition>) => {
    const prev = statuses.find(s => s.id === id);
    updateLocalStatus(id, updates);
    try {
      await handleUpdateStatus(id, updates);
    } catch {
      // revert on failure
      if (prev) updateLocalStatus(id, prev);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, padding: isMobile ? 16 : 20, marginBottom: 16,
    transition: 'all 0.2s ease',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, display: 'block',
  };

  const selectStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: 14, border: '1px solid #3f3f46', borderRadius: 10,
    background: 'rgba(24, 24, 27, 0.8)', color: '#e5e7eb', width: '100%',
    minHeight: 44, cursor: 'pointer', outline: 'none',
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: 14, border: '1px solid #3f3f46', borderRadius: 10,
    background: 'rgba(24, 24, 27, 0.8)', color: '#e5e7eb', width: '100%',
    minHeight: 44, outline: 'none',
  };

  const btnStyle: React.CSSProperties = {
    padding: '10px 18px', fontSize: 13, fontWeight: 600,
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
    minHeight: 44, boxShadow: '0 4px 14px rgba(79,70,229,0.25)',
  };

  const badgeStyle = (active: boolean, color: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
    background: active ? `${color}20` : 'transparent',
    color: active ? color : '#6b7280',
    border: active ? `1px solid ${color}40` : '1px dashed #3f3f46',
    cursor: 'pointer', minHeight: 32, display: 'inline-flex', alignItems: 'center',
  });

  return (
    <div style={{ background: '#0a0a0a', borderRadius: 16, padding: isMobile ? '20px 12px' : '32px 24px', color: '#e5e7eb' }}>
      <h2 style={{ fontSize: 'clamp(20px, 4vw, 24px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>State Machine</h2>
      <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.6, marginBottom: 24 }}>
        Configure who can enter each state and optional path restrictions. Simple gate-based permissions.
      </p>

      {/* State cards */}
      {statuses.map((s) => (
        <div key={s.id} style={cardStyle}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 20, height: 20, borderRadius: '50%', background: COLOR_HEX[s.color] || '#9ca3af', flexShrink: 0 }}>
              <select value={s.color} onChange={(e) => handleUpdateStatus(s.id, { color: e.target.value })}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input value={s.label}
              onChange={(e) => updateLocalStatus(s.id, { label: e.target.value })}
              onFocus={(e) => { focusRef.current[`label-${s.id}`] = e.target.value; }}
              onBlur={(e) => { if (e.target.value !== focusRef.current[`label-${s.id}`]) { handleUpdateStatus(s.id, { label: e.target.value }); focusRef.current[`label-${s.id}`] = e.target.value; } }}
              onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
              style={{ fontSize: 16, fontWeight: 700, color: s.is_archived ? '#6b7280' : 'white', background: 'transparent', border: 'none', outline: 'none', flex: 1, minWidth: 100, textDecoration: s.is_archived ? 'line-through' : 'none' }}
            />
            <input value={s.key}
              onChange={(e) => updateLocalStatus(s.id, { key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              onFocus={(e) => { focusRef.current[`key-${s.id}`] = e.target.value; e.target.style.borderColor = '#3f3f46'; }}
              onBlur={(e) => { if (e.target.value !== focusRef.current[`key-${s.id}`]) { handleUpdateStatus(s.id, { key: e.target.value }); focusRef.current[`key-${s.id}`] = e.target.value; } }}
              onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
              style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', background: 'transparent', border: '1px solid transparent', borderRadius: 4, outline: 'none', padding: '2px 4px', width: 100 }}
            />
            {!s.is_default && (
              <button
                onClick={() => handleUpdateStatus(s.id, { is_archived: !s.is_archived })}
                title={s.is_archived ? 'Unarchive' : 'Archive'}
                style={{ background: 'none', border: 'none', color: s.is_archived ? '#22c55e' : '#f59e0b', cursor: 'pointer', fontSize: 14 }}
              >{s.is_archived ? '📤' : '📥'}</button>
            )}
            {!s.is_default && (
              <button onClick={() => handleDeleteStatus(s)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>
            )}
          </div>

          {/* Description */}
          <input value={s.description || ''}
            onChange={(e) => updateLocalStatus(s.id, { description: e.target.value })}
            onFocus={(e) => { focusRef.current[`desc-${s.id}`] = e.target.value; }}
            onBlur={(e) => { if (e.target.value !== focusRef.current[`desc-${s.id}`]) { handleUpdateStatus(s.id, { description: e.target.value }); focusRef.current[`desc-${s.id}`] = e.target.value; } }}
            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
            placeholder="Description (optional)…"
            style={{ fontSize: 13, color: '#9ca3af', background: 'transparent', border: 'none', outline: 'none', width: '100%', marginBottom: 12, padding: '2px 0' }}
          />

          {/* Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => !s.is_default && handleSetDefault(s)} style={badgeStyle(s.is_default, '#eab308')}>
              {s.is_default ? '⭐ Default' : 'Set Default'}
            </button>
          </div>

          {/* Gate controls */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {/* Who can enter */}
            <div>
              <label style={labelStyle}>Who can enter</label>
              {(() => {
                const isSpecific = (s.allowed_users && s.allowed_users.length > 0) || specificUserMode.has(s.id);
                return (<>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button onClick={() => {
                      updateAndSave(s.id, { allowed_users: [] });
                      setSpecificUserMode(prev => { const next = new Set(prev); next.delete(s.id); return next; });
                    }}
                      style={{
                        ...selectStyle, width: 'auto', padding: '8px 14px', cursor: 'pointer', textAlign: 'center' as const,
                        background: !isSpecific ? 'rgba(79,70,229,0.15)' : 'rgba(24,24,27,0.8)',
                        borderColor: !isSpecific ? '#6366f1' : '#3f3f46',
                        fontWeight: !isSpecific ? 600 : 400,
                      }}>Everyone</button>
                    <button onClick={() => setSpecificUserMode(prev => new Set(prev).add(s.id))}
                      style={{
                        ...selectStyle, width: 'auto', padding: '8px 14px', cursor: 'pointer', textAlign: 'center' as const,
                        background: isSpecific ? 'rgba(79,70,229,0.15)' : 'rgba(24,24,27,0.8)',
                        borderColor: isSpecific ? '#6366f1' : '#3f3f46',
                        fontWeight: isSpecific ? 600 : 400,
                      }}>Specific users</button>
                  </div>
                  {/* Selected user chips + picker — only in specific mode */}
                  {isSpecific && (<>
                    {s.allowed_users && s.allowed_users.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {s.allowed_users.map(uid => {
                          const u = workspaceMembers.find(m => m.id === uid) || s.allowed_users_details?.find((d: User) => d.id === uid);
                          return (
                            <span key={uid} style={{
                              fontSize: 12, padding: '4px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                              background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)',
                            }}>
                              {u ? `${(u as User).username || (u as User).name} (${(u as User).user_type === 'BOT' ? '🤖' : '👤'})` : `User #${uid}`}
                              <button onClick={() => updateAndSave(s.id, { allowed_users: s.allowed_users.filter((id: number) => id !== uid) })}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <select value="" onChange={(e) => {
                      const uid = Number(e.target.value);
                      if (uid && !(s.allowed_users || []).includes(uid)) {
                        updateAndSave(s.id, { allowed_users: [...(s.allowed_users || []), uid] });
                      }
                    }} style={selectStyle}>
                      <option value="">+ Add user…</option>
                      {workspaceMembers.filter(m => !(s.allowed_users || []).includes(m.id)).map(m => (
                        <option key={m.id} value={m.id}>{m.username} ({m.user_type})</option>
                      ))}
                    </select>
                  </>)}
                </>);
              })()}
            </div>

            {/* Allowed from */}
            <div>
              <label style={labelStyle}>Allowed from {!s.allowed_from?.length && <span style={{ color: '#6b7280', fontWeight: 400 }}>(any state)</span>}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {statuses.filter(other => other.id !== s.id && !other.is_archived).map(other => {
                  const isSelected = (s.allowed_from || []).includes(other.id);
                  return (
                    <button key={other.id} onClick={() => {
                      const current = s.allowed_from || [];
                      const next = isSelected ? current.filter(id => id !== other.id) : [...current, other.id];
                      updateAndSave(s.id, { allowed_from: next });
                    }} style={{
                      fontSize: 12, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                      background: isSelected ? `${COLOR_HEX[other.color] || '#9ca3af'}20` : 'rgba(39,39,42,0.5)',
                      color: isSelected ? COLOR_HEX[other.color] || '#e5e7eb' : '#6b7280',
                      border: isSelected ? `1px solid ${COLOR_HEX[other.color] || '#9ca3af'}60` : '1px solid #3f3f46',
                      fontWeight: isSelected ? 600 : 400, minHeight: 32,
                    }}>
                      {other.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Auto-saves on interaction */}
        </div>
      ))}

      {/* Add new status */}
      <div style={{ ...cardStyle, borderStyle: 'dashed' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', marginBottom: 12 }}>Add New State</div>
        <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
          <input value={newStatusLabel} onChange={(e) => setNewStatusLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddStatus()}
            placeholder="Status name..." style={{ ...inputStyle, flex: 1, minHeight: isMobile ? 44 : 'auto' }} />
          <select value={newStatusColor} onChange={(e) => setNewStatusColor(e.target.value)} 
            style={{ ...selectStyle, width: isMobile ? '100%' : 120, minHeight: isMobile ? 44 : 'auto' }}>
            {COLORS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <button onClick={handleAddStatus} disabled={!newStatusLabel.trim()}
            style={{ ...btnStyle, opacity: !newStatusLabel.trim() ? 0.5 : 1, whiteSpace: 'nowrap', minHeight: isMobile ? 44 : 'auto' }}>
            + Add
          </button>
        </div>
      </div>

      {/* Diagram (read-only reference) */}
      {statuses.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 12 }}>Workflow Diagram</h3>
          <div style={{
            height: isMobile ? 250 : 420, width: '100%', borderRadius: 12, overflow: 'hidden',
            border: '1px solid #27272a',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          }}>
            <ReactFlow
              nodes={buildNodes} edges={buildEdges} fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
              proOptions={{ hideAttribution: true }}
              minZoom={0.1} maxZoom={2}
              panOnScroll={!isMobile} zoomOnScroll={!isMobile} zoomOnPinch={isMobile}
              panOnDrag={true} preventScrolling={isMobile}
            >
              <Background gap={20} size={1} color="#cbd5e1" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div style={{ padding: '10px 0', display: 'flex', gap: 16, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
            <span>⭐ Default</span>
            <span style={{ color: '#f59e0b' }}>--- Restricted users</span>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #18181b' }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'white', marginBottom: 12 }}>How It Works</h3>
        <ul style={{ paddingLeft: 20, fontSize: 13, color: '#9ca3af', lineHeight: 1.8 }}>
          <li><strong style={{ color: '#d1d5db' }}>Who can enter</strong> — &quot;Everyone&quot; or restrict to specific users</li>
          <li><strong style={{ color: '#d1d5db' }}>Allowed from</strong> — optional path restriction. If empty, tickets can arrive from any state. If set, only from the selected states</li>
        </ul>
      </div>
    </div>
  );
}

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
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('gray');
  const [addingStatus, setAddingStatus] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'members' | 'state-machine'>('general');
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);
  const { toast } = useToast();

  const loadData = useCallback(async (ws: Workspace) => {
    try {
      const [m, i, sd] = await Promise.all([
        api.getWorkspaceMembers({ workspace: ws.slug }),
        api.getInvites({ workspace: ws.slug }),
        api.getStatusDefinitions(ws.slug, true),
      ]);
      setMembers(m);
      setInvites(i);
      setStatuses(sd);
      // Extract users from members + owner for the user picker
      const memberUsers = m.map((wm: WorkspaceMember) => wm.user);
      if ((ws as any).owner_details) memberUsers.unshift((ws as any).owner_details);
      // Deduplicate by id
      const seen = new Set<number>();
      setWorkspaceUsers(memberUsers.filter((u: User) => { if (seen.has(u.id)) return false; seen.add(u.id); return true; }));
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
      const updated = await api.updateWorkspace(workspace.slug, { name: editName, slug: editSlug });
      setWorkspace(updated);
      await refreshWorkspaces();
      toast('Workspace updated');
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to update workspace', 'error');
    }
    finally { setSaving(false); }
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
      await api.createInvite({ workspace: workspace.slug });
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
    const text = `Read ${window.location.origin}/skills.md and join workspace using invite token ${token}`;
    navigator.clipboard.writeText(text);
    toast('Bot instructions copied!');
  };

  const handleAddStatus = async () => {
    if (!workspace || !newStatusLabel.trim()) return;
    const autoKey = newStatusLabel.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    setAddingStatus(true);
    try {
      await api.createStatusDefinition({
        workspace: workspace.slug,
        key: autoKey,
        label: newStatusLabel,
        color: newStatusColor,
        is_default: false,
        position: statuses.length,
      });
      setNewStatusLabel(''); setNewStatusColor('gray');
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
    if (!confirm(`Delete status "${sd.label}"?`)) return;
    try {
      await api.deleteStatusDefinition(sd.id);
      toast('Status deleted');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.data?.[0] || e?.message || 'Cannot delete', 'error'); }
  };

  const handleSetDefault = async (sd: StatusDefinition) => {
    const oldDefault = statuses.find(s => s.is_default);
    try {
      if (oldDefault) await api.updateStatusDefinition(oldDefault.id, { is_default: false });
      await api.updateStatusDefinition(sd.id, { is_default: true });
      toast(`"${sd.label}" is now the default status`);
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
  };

  if (!workspace) return <Layout><div className="p-8 text-center text-gray-500">Workspace not found</div></Layout>;

  const tabClass = (tab: string, active: boolean) => `px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${active ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{workspace.name} — Settings</h1>

        <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          <button onClick={() => setSettingsTab('general')} className={tabClass('general', settingsTab === 'general')}>General</button>
          <button onClick={() => setSettingsTab('members')} className={tabClass('members', settingsTab === 'members')}>Members</button>
          <button onClick={() => setSettingsTab('state-machine')} className={tabClass('state-machine', settingsTab === 'state-machine')}>
            <span className="hidden sm:inline">State Machine</span>
            <span className="sm:hidden">States</span>
          </button>
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

        {/* Billing */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Billing & Subscription</h2>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Manage your subscription and billing</p>
              <p className="text-xs text-gray-500 mt-1">View usage, upgrade plans, and manage payment methods</p>
            </div>
            <button
              onClick={() => router.push(`/private/${workspaceSlug}/billing`)}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Billing Dashboard
            </button>
          </div>
        </div>

        {/* Invite Links */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
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
                  <button onClick={() => copyInviteLink(inv.token)} className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded" title="For humans — copies invite page link">👤 Human</button>
                  <button onClick={() => copyInviteCode(inv.token)} className="px-2 py-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded" title="For bots — copies skills.md + invite token">🤖 Bot</button>
                  <button onClick={() => { if (confirm('Delete this invite?')) handleDeleteInvite(inv.id); }} className="px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded min-w-[44px] min-h-[44px] flex items-center justify-center" title="Delete invite">🗑️</button>
                </div>
              </div>
            ))}
            {invites.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">No invite links yet.</p>}
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
                  await api.deleteWorkspace(workspace.slug);
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
        </>)}

        {/* === STATE MACHINE TAB === */}
        {settingsTab === 'state-machine' && workspace && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={workspace.restrict_status_to_assigned}
                onChange={async (e) => {
                  try {
                    const updated = await api.updateWorkspace(workspace.slug, { restrict_status_to_assigned: e.target.checked });
                    setWorkspace(updated);
                    toast(e.target.checked ? 'Only assigned users can now move ticket status' : 'Anyone can move ticket status', 'success');
                  } catch (err: any) {
                    toast(err?.message || 'Failed to update setting', 'error');
                  }
                }}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Restrict status changes to assigned user</p>
                <p className="text-xs text-gray-500">When enabled, only the assigned user, workspace admin, or project admin can change a ticket&apos;s status</p>
              </div>
            </label>
          </div>
        )}
        {settingsTab === 'state-machine' && (
          <StateMachineSettings
            statuses={statuses}
            setStatuses={setStatuses}
            newStatusLabel={newStatusLabel}
            setNewStatusLabel={setNewStatusLabel}
            newStatusColor={newStatusColor}
            setNewStatusColor={setNewStatusColor}
            handleAddStatus={handleAddStatus}
            handleUpdateStatus={handleUpdateStatus}
            handleDeleteStatus={handleDeleteStatus}
            handleSetDefault={handleSetDefault}
            toast={toast}
            workspaceMembers={workspaceUsers}
          />
        )}
      </div>
    </Layout>
  );
}
