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
import { api, Workspace, WorkspaceMember, StatusDefinition, User } from '@/lib/api';

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
    activeStatuses.forEach((s) => g.setNode(s.key, { width: 140, height: 40 }));
    // Build edges from allowed_from relationships (keys now)
    const activeKeys = new Set(activeStatuses.map(s => s.key));
    activeStatuses.forEach((target) => {
      if (target.allowed_from && target.allowed_from.length > 0) {
        target.allowed_from.filter((k: string) => activeKeys.has(k)).forEach((srcKey: string) => {
          g.setEdge(srcKey, target.key);
        });
      }
    });
    dagre.layout(g);
    return activeStatuses.map((s) => {
      const nd = g.node(s.key);
      const color = COLOR_HEX[s.color] || '#9ca3af';
      return {
        id: s.key,
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
    const activeKeys2 = new Set(activeStatuses.map(s => s.key));
    activeStatuses.forEach((target) => {
      if (target.allowed_from && target.allowed_from.length > 0) {
        target.allowed_from.filter((k: string) => activeKeys2.has(k)).forEach((srcKey: string) => {
          const color = '#6b7280';
          edges.push({
            id: `e-${srcKey}-${target.key}`,
            source: srcKey,
            target: target.key,
            animated: false,
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
            label: '',
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
      {statuses.map((s, idx) => (
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
            {/* Reorder buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginLeft: 'auto' }}>
              <button
                disabled={idx === 0}
                onClick={async () => {
                  const prev = statuses[idx - 1];
                  if (!prev) return;
                  // Swap positions using index-based values to avoid collisions
                  await handleUpdateStatus(s.id, { position: idx - 1 });
                  await handleUpdateStatus(prev.id, { position: idx });
                }}
                style={{ background: 'none', border: '1px solid #3f3f46', borderRadius: 4, color: idx === 0 ? '#3f3f46' : '#9ca3af', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, padding: '2px 6px', lineHeight: 1, minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Move up"
              >▲</button>
              <button
                disabled={idx === statuses.length - 1}
                onClick={async () => {
                  const next = statuses[idx + 1];
                  if (!next) return;
                  await handleUpdateStatus(s.id, { position: idx + 1 });
                  await handleUpdateStatus(next.id, { position: idx });
                }}
                style={{ background: 'none', border: '1px solid #3f3f46', borderRadius: 4, color: idx === statuses.length - 1 ? '#3f3f46' : '#9ca3af', cursor: idx === statuses.length - 1 ? 'default' : 'pointer', fontSize: 11, padding: '2px 6px', lineHeight: 1, minWidth: 28, minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Move down"
              >▼</button>
            </div>
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
            {/* Who can enter — now project-level */}
            <div>
              <label style={labelStyle}>Who can enter</label>
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>User permissions are set per-project in Project Settings → Phases tab</p>
            </div>

            {/* Allowed from */}
            <div>
              <label style={labelStyle}>Allowed from {!s.allowed_from?.length && <span style={{ color: '#6b7280', fontWeight: 400 }}>(any state)</span>}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {statuses.filter(other => other.id !== s.id && !other.is_archived).map(other => {
                  const isSelected = (s.allowed_from || []).includes(other.key);
                  return (
                    <button key={other.key} onClick={() => {
                      const current = s.allowed_from || [];
                      const next = isSelected ? current.filter((k: string) => k !== other.key) : [...current, other.key];
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

  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('gray');
  const [addingStatus, setAddingStatus] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'members' | 'bots' | 'state-machine'>('general');
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [syncSource, setSyncSource] = useState('');
  const [showSyncConfirm, setShowSyncConfirm] = useState<'states' | 'transitions' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [bots, setBots] = useState<(User & { api_token?: string })[]>([]);
  const [loadingBots, setLoadingBots] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadBots = useCallback(async (ws: Workspace) => {
    setLoadingBots(true);
    try {
      const botsList = await api.getBots(ws.slug);
      setBots(botsList);
    } catch (e: any) {
      toast(e?.message || 'Failed to load bots', 'error');
    } finally {
      setLoadingBots(false);
    }
  }, [toast]);

  const loadData = useCallback(async (ws: Workspace) => {
    try {
      const [m, sd] = await Promise.all([
        api.getWorkspaceMembers({ workspace: ws.slug }),
        api.getStatusDefinitions(ws.slug, true),
      ]);
      setMembers(m);
      setStatuses(sd);
      // Extract users from members + owner for the user picker
      const memberUsers = m.map((wm: WorkspaceMember) => wm.user);
      if ((ws as any).owner_details) memberUsers.unshift((ws as any).owner_details);
      // Deduplicate by id
      const seen = new Set<number>();
      setWorkspaceUsers(memberUsers.filter((u: User) => { if (seen.has(u.id)) return false; seen.add(u.id); return true; }));
      // Load all workspaces for sync picker
      api.getWorkspaces().then(wsList => setAllWorkspaces(wsList.filter(w => w.slug !== ws.slug))).catch(() => {});
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

  // Load bots when switching to bots tab
  useEffect(() => {
    if (settingsTab === 'bots' && workspace) {
      loadBots(workspace);
    }
  }, [settingsTab, workspace, loadBots]);

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

  const handleRegenerateToken = async (bot: User & { api_token?: string }) => {
    if (!confirm(`Regenerate token for ${bot.username}? This will invalidate the current token.`)) return;
    try {
      const result = await api.regenerateToken(bot.username);
      setBots(prev => prev.map(b => b.username === bot.username ? { ...b, api_token: result.api_token } : b));
      toast(`Token regenerated for ${bot.username}`);
      // Reveal the new token temporarily
      setRevealedTokens(prev => new Set(prev).add(bot.username));
    } catch (e: any) {
      toast(e?.message || 'Failed to regenerate token', 'error');
    }
  };

  const handleDeleteBot = async (bot: User & { api_token?: string }) => {
    if (!confirm(`Delete bot ${bot.username}? This action cannot be undone.`)) return;
    try {
      await api.deleteUser(bot.username as any);
      setBots(prev => prev.filter((b: any) => b.username !== bot.username));
      toast(`Bot ${bot.username} deleted`);
    } catch (e: any) {
      toast(e?.message || 'Failed to delete bot', 'error');
    }
  };

  const maskToken = (token: string) => {
    if (token.length <= 8) return token;
    return token.slice(0, 4) + '...' + token.slice(-4);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Token copied to clipboard');
    } catch (e) {
      toast('Failed to copy token', 'error');
    }
  };

  if (!workspace) return <Layout><div className="p-8 text-center text-gray-500">Workspace not found</div></Layout>;

  const tabClass = (tab: string, active: boolean) => `px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${active ? 'border-indigo-500 text-indigo-400 bg-[#111118]' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'}`;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">{workspace.name} — Settings</h1>

        <div className="flex gap-1 mb-6 border-b border-[#222233] overflow-x-auto">
          <button onClick={() => setSettingsTab('general')} className={tabClass('general', settingsTab === 'general')}>General</button>
          <button onClick={() => setSettingsTab('members')} className={tabClass('members', settingsTab === 'members')}>Members</button>
          <button onClick={() => setSettingsTab('bots')} className={tabClass('bots', settingsTab === 'bots')}>🤖 Bots</button>
          <button onClick={() => setSettingsTab('state-machine')} className={tabClass('state-machine', settingsTab === 'state-machine')}>
            <span className="hidden sm:inline">State Machine</span>
            <span className="sm:hidden">States</span>
          </button>
        </div>

        {/* === GENERAL TAB === */}
        {settingsTab === 'general' && (<>
        <div className="bg-[#111118] border border-[#222233] rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-[#222233]">
            <h2 className="font-semibold text-white">Workspace Details</h2>
          </div>
          <div className="p-5 space-y-4">
            <FormField label="Name" error={fieldErrors.name} required>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass(fieldErrors.name)} />
            </FormField>
            <FormField label="Slug" error={fieldErrors.slug} required>
              <input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value)} className={inputClass(fieldErrors.slug)} />
            </FormField>
            <button onClick={handleSaveWorkspace} disabled={saving || !editName.trim() || !editSlug.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-[#111118] border border-[#222233] rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-[#222233]">
            <h2 className="font-semibold text-white">Billing & Subscription</h2>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Manage your subscription and billing</p>
              <p className="text-xs text-gray-400 mt-1">View usage, upgrade plans, and manage payment methods</p>
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

        

        {/* Danger Zone */}
        <div className="bg-[#111118] rounded-xl border border-red-500/30">
          <div className="px-5 py-4 border-b border-red-500/20">
            <h2 className="font-semibold text-red-400">Danger Zone</h2>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Delete this workspace</p>
              <p className="text-xs text-gray-400">This action cannot be undone. All projects, tickets, and data will be permanently deleted.</p>
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
        <div className="bg-[#111118] border border-[#222233] rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-[#222233]">
            <h2 className="font-semibold text-white">Members ({members.filter(m => m.user.id !== workspace?.owner).length + 1})</h2>
          </div>
          <div className="divide-y divide-[#222233]">
            {(workspace as any).owner_details && (
              <div className="px-5 py-3 flex items-center justify-between bg-amber-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-amber-500">
                    {(workspace as any).owner_details.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{(workspace as any).owner_details.username}</p>
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
                    <p className="text-sm font-medium text-white">{m.user.username}</p>
                    <p className="text-xs text-gray-400">{m.user.email} · <span className={m.user.user_type === 'BOT' ? 'text-purple-600' : ''}>{m.user.user_type}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 px-2 py-1 bg-[#1a1a2e] rounded">Member</span>
                  <button onClick={() => handleRemoveMember(m.id)} className="px-3 py-2 text-sm font-medium text-red-400 hover:text-white hover:bg-red-600 border border-red-500/30 hover:border-red-600 rounded-lg transition-colors min-w-[80px]">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        </>)}

        {/* === BOTS TAB === */}
        {settingsTab === 'bots' && (<>
        <div className="bg-[#111118] border border-[#222233] rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-[#222233]">
            <h2 className="font-semibold text-white">🤖 Bot Token Management</h2>
            <p className="text-sm text-gray-400 mt-1">Manage API tokens for bots in this workspace. Only workspace admins can view and manage tokens.</p>
          </div>
          {loadingBots ? (
            <div className="p-5 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
              <p className="text-sm text-gray-400 mt-2">Loading bots...</p>
            </div>
          ) : bots.length === 0 ? (
            <div className="p-5 text-center">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">No bots found in this workspace.</p>
              <p className="text-xs text-gray-500 mt-1">Contact support to create bot users for this workspace.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#222233]">
              {bots.map(bot => (
                <div key={bot.username} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {bot.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-white">{bot.username}</h3>
                        <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded">BOT</span>
                        {!bot.is_active && <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded">INACTIVE</span>}
                      </div>
                      {bot.name && <p className="text-sm text-gray-400 mb-2">{bot.name}</p>}
                      {bot.description && <p className="text-sm text-gray-400 mb-3">{bot.description}</p>}
                      
                      <div className="bg-[#1a1a2e] rounded-lg p-3 mb-3">
                        <label className="block text-xs font-medium text-gray-300 mb-1">API Token</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm font-mono text-gray-200 bg-[#0a0a0f] border border-[#222233] rounded px-2 py-1 select-all">
                            {revealedTokens.has(bot.username) ? bot.api_token : maskToken(bot.api_token || '')}
                          </code>
                          <button
                            onClick={() => {
                              if (revealedTokens.has(bot.username)) {
                                setRevealedTokens(prev => {
                                  const next = new Set(prev);
                                  next.delete(bot.username);
                                  return next;
                                });
                              } else {
                                setRevealedTokens(prev => new Set(prev).add(bot.username));
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-300 rounded"
                            title={revealedTokens.has(bot.username) ? "Hide token" : "Show full token"}
                          >
                            {revealedTokens.has(bot.username) ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(bot.api_token || '')}
                            className="p-1.5 text-gray-400 hover:text-gray-300 rounded"
                            title="Copy token"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleRegenerateToken(bot)}
                          className="px-3 py-1.5 text-sm font-medium text-orange-400 hover:text-white hover:bg-orange-600 border border-orange-500/30 hover:border-orange-600 rounded-lg transition-colors"
                        >
                          Regenerate Token
                        </button>
                        <button
                          onClick={() => handleDeleteBot(bot)}
                          className="px-3 py-1.5 text-sm font-medium text-red-400 hover:text-white hover:bg-red-600 border border-red-500/30 hover:border-red-600 rounded-lg transition-colors"
                        >
                          Delete Bot
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>)}

        {/* === STATE MACHINE TAB === */}
        {settingsTab === 'state-machine' && workspace && (
          <div className="bg-[#111118] rounded-xl border border-[#222233] p-5 mb-6">
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
                className="w-5 h-5 rounded border-[#222233] text-indigo-400 focus:ring-indigo-500 bg-[#1a1a2e]"
              />
              <div>
                <p className="text-sm font-medium text-white">Restrict status changes to assigned user</p>
                <p className="text-xs text-gray-400">When enabled, only the assigned user, workspace admin, or project admin can change a ticket&apos;s status</p>
              </div>
            </label>
          </div>
        )}
        {/* Starter Templates */}
        {settingsTab === 'state-machine' && workspace && (
          <div style={{ background: '#0a0a0a', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>Starter Templates</h3>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>Two-step process: ① Sync States (additive) → ② Sync Transitions (replaces rules). You can also preview each template.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: 'software_dev', name: '💻 Software Dev', desc: 'Open → Dev → Testing → Review → Completed' },
                { id: 'software_dev_ext', name: '💻 Software Dev (Extended)', desc: 'Open → Spec → Dev → QA Local → Deploy → QA Pass/Fail — SevenOlives workflow' },
                { id: 'kanban', name: '📋 Kanban', desc: 'To Do → In Progress → Review → Done' },
                { id: 'agency', name: '🏢 Agency', desc: 'Brief → Scope → Build → Client Review → Deliver' },
                { id: 'support', name: '🎧 Support', desc: 'New → Triage → Investigate → Resolve → Close' },
                { id: 'content', name: '✍️ Content', desc: 'Idea → Draft → Edit → Ready → Publish' },
              ].map(t => (
                <div key={t.id} style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{t.desc}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => window.open(`/state-machine?template=${t.id}`, '_blank')}
                        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                        Preview
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`Sync states from "${t.name}"? Adds missing states, keeps existing.`)) return;
                        try {
                          const result = await api.applyStateTemplate(workspace.slug, t.id, 'additive');
                          setStatuses(result.statuses);
                          toast(`Added ${result.added} states (${result.skipped} already existed)`);
                        } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                      }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                        ① Sync States
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`Replace ALL transition rules with "${t.name}" template? This is destructive — existing rules will be overwritten.`)) return;
                        try {
                          const result = await api.applyStateTemplate(workspace.slug, t.id, 'replace');
                          setStatuses(result.statuses);
                          toast(`Transitions synced`);
                        } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                      }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                        ② Sync Transitions
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {settingsTab === 'state-machine' && workspace && allWorkspaces.length > 0 && (
          <div style={{ background: '#0a0a0a', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>Sync from another workspace</h3>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>Import a state machine from another workspace. Two-step process:</p>
            <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm font-medium text-white">Sync States</p>
                  <p className="text-xs text-gray-500"><strong>Additive</strong> — new statuses are added (name, color, description). Existing statuses with the same key are kept untouched. Nothing is deleted.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-sm font-medium text-white">Sync Transitions</p>
                  <p className="text-xs text-gray-500"><strong>Destructive</strong> — all existing allowed_from rules are replaced with the source workspace&apos;s rules. Previous transition paths are deleted. This requires all states to exist first (run Step 1 first).</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center mb-3">
              <select value={syncSource} onChange={e => setSyncSource(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-[#3f3f46] rounded-xl text-sm bg-[#18181b] text-white">
                <option value="">Select source workspace…</option>
                {allWorkspaces.map(w => <option key={w.slug} value={w.slug}>{w.name} ({w.slug})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { if (syncSource) setShowSyncConfirm('states'); }}
                disabled={!syncSource || syncing}
                style={{ flex: 1, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: !syncSource ? 'default' : 'pointer', background: !syncSource ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.15)', border: `1px solid ${!syncSource ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.3)'}`, color: !syncSource ? '#4b5563' : '#a5b4fc' }}>
                {syncing ? 'Syncing…' : '① Sync States'}
              </button>
              <button onClick={() => { if (syncSource) setShowSyncConfirm('transitions'); }}
                disabled={!syncSource || syncing}
                style={{ flex: 1, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: !syncSource ? 'default' : 'pointer', background: !syncSource ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.15)', border: `1px solid ${!syncSource ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.3)'}`, color: !syncSource ? '#4b5563' : '#fca5a5' }}>
                {syncing ? 'Syncing…' : '② Sync Transitions'}
              </button>
            </div>
          </div>
        )}

        {/* Sync confirmation dialog */}
        {showSyncConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSyncConfirm(null)}>
            <div className="bg-[#111118] rounded-2xl p-6 max-w-md w-full border border-[#222233]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{showSyncConfirm === 'states' ? '📋' : '⚠️'}</span>
                <h3 className="text-lg font-bold text-white">{showSyncConfirm === 'states' ? 'Sync States' : 'Sync Transitions'}</h3>
              </div>
              {showSyncConfirm === 'states' ? (
                <div className="bg-indigo-900/20 border border-indigo-800 rounded-xl p-4 mb-4">
                  <p className="text-sm text-indigo-800 font-medium mb-1">Additive — safe operation</p>
                  <p className="text-xs text-indigo-300">New statuses from <strong>{syncSource}</strong> will be added. Existing statuses with matching keys are kept untouched. Nothing is deleted or overwritten.</p>
                </div>
              ) : (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-4">
                  <p className="text-sm text-red-800 font-medium mb-1">Destructive — cannot be undone</p>
                  <p className="text-xs text-red-600">All existing transition rules (allowed_from) will be <strong>deleted and replaced</strong> with the rules from <strong>{syncSource}</strong>. Make sure you&apos;ve run Step 1 (Sync States) first so all required states exist.</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowSyncConfirm(null)} className="flex-1 px-4 py-3 border border-[#222233] rounded-xl text-sm font-medium text-gray-300 hover:bg-[#1a1a2e]">Cancel</button>
                <button onClick={async () => {
                  if (!workspace) return;
                  const mode = showSyncConfirm;
                  setSyncing(true);
                  setShowSyncConfirm(null);
                  try {
                    const result = await api.syncStatusDefinitions(workspace.slug, syncSource, mode);
                    setStatuses(result.statuses);
                    if (mode === 'states') {
                      toast(`Added ${result.added} statuses, ${result.skipped} already existed`);
                    } else {
                      toast(`Transitions synced for ${result.updated} statuses${result.warning ? '. ' + result.warning : ''}`);
                    }
                  } catch (e: any) { toast(e?.message || e?.detail || 'Sync failed', 'error'); }
                  finally { setSyncing(false); }
                }} disabled={syncing}
                  className={`flex-1 px-4 py-3 text-white rounded-xl text-sm font-medium disabled:opacity-50 ${showSyncConfirm === 'states' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {syncing ? 'Syncing…' : showSyncConfirm === 'states' ? 'Add States' : 'Replace Transitions'}
                </button>
              </div>
            </div>
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
