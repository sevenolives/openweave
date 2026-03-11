'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ColorName =
  | 'gray' | 'blue' | 'red' | 'purple' | 'amber'
  | 'green' | 'yellow' | 'indigo' | 'pink' | 'orange';

type ActorType = 'BOT' | 'HUMAN' | 'ALL';

interface WorkflowState {
  id: number;
  key: string;
  label: string;
  color: ColorName;
  is_terminal: boolean;
  is_default: boolean;
  pos: number;
}

interface Transition {
  id: number;
  from: number;
  to: number;
  actor: ActorType;
}

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLORS: Record<ColorName, string> = {
  gray: '#9ca3af', blue: '#3b82f6', red: '#ef4444', purple: '#a855f7',
  amber: '#f59e0b', green: '#22c55e', yellow: '#eab308', indigo: '#6366f1',
  pink: '#ec4899', orange: '#f97316',
};

const ACTOR_COLORS: Record<ActorType, string> = {
  BOT: '#a855f7', HUMAN: '#3b82f6', ALL: '#6b7280',
};

const DEFAULT_STATES: WorkflowState[] = [
  { id: 1, key: 'OPEN', label: 'Open', color: 'gray', is_terminal: false, is_default: true, pos: 0 },
  { id: 2, key: 'IN_PROGRESS', label: 'In Progress', color: 'blue', is_terminal: false, is_default: false, pos: 1 },
  { id: 3, key: 'BLOCKED', label: 'Blocked', color: 'red', is_terminal: false, is_default: false, pos: 2 },
  { id: 4, key: 'IN_TESTING', label: 'In Testing', color: 'purple', is_terminal: false, is_default: false, pos: 3 },
  { id: 5, key: 'REVIEW', label: 'Review', color: 'amber', is_terminal: false, is_default: false, pos: 4 },
  { id: 6, key: 'COMPLETED', label: 'Completed', color: 'green', is_terminal: true, is_default: false, pos: 5 },
  { id: 7, key: 'CANCELLED', label: 'Cancelled', color: 'gray', is_terminal: true, is_default: false, pos: 6 },
];

const DEFAULT_TRANSITIONS: Transition[] = [
  { id: 1, from: 1, to: 2, actor: 'BOT' }, { id: 2, from: 1, to: 3, actor: 'BOT' },
  { id: 3, from: 1, to: 7, actor: 'BOT' }, { id: 4, from: 2, to: 4, actor: 'BOT' },
  { id: 5, from: 2, to: 3, actor: 'BOT' }, { id: 6, from: 2, to: 5, actor: 'BOT' },
  { id: 7, from: 3, to: 2, actor: 'BOT' }, { id: 8, from: 4, to: 5, actor: 'BOT' },
  { id: 9, from: 4, to: 3, actor: 'BOT' }, { id: 10, from: 5, to: 6, actor: 'HUMAN' },
  { id: 11, from: 5, to: 2, actor: 'BOT' },
];

/* ------------------------------------------------------------------ */
/*  Dagre layout                                                       */
/* ------------------------------------------------------------------ */

function buildNodes(states: WorkflowState[], transitions: Transition[], isMobile: boolean = false): Node[] {
  const g = new dagre.graphlib.Graph();
  const nodesep = isMobile ? 60 : 80;
  const ranksep = isMobile ? 80 : 100;
  const nodeWidth = isMobile ? 140 : 160;
  const nodeHeight = isMobile ? 45 : 50;
  
  g.setGraph({ rankdir: 'TB', nodesep, ranksep });
  g.setDefaultEdgeLabel(() => ({}));
  states.forEach((s) => g.setNode(String(s.id), { width: nodeWidth, height: nodeHeight }));
  transitions.forEach((t) => g.setEdge(String(t.from), String(t.to)));
  dagre.layout(g);

  return states.map((s) => {
    const nd = g.node(String(s.id));
    const color = COLORS[s.color] || '#9ca3af';
    const halfWidth = nodeWidth / 2;
    const halfHeight = nodeHeight / 2;
    
    return {
      id: String(s.id),
      position: { x: (nd?.x ?? 0) - halfWidth, y: (nd?.y ?? 0) - halfHeight },
      data: {
        label: s.label + (s.is_default ? ' ⭐' : '') + (s.is_terminal ? ' 🏁' : ''),
      },
      type: 'default',
      style: {
        background: s.is_default
          ? `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`
          : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: `${isMobile ? 3 : 2}px solid ${color}`,
        borderRadius: s.is_terminal ? (isMobile ? '22px' : '25px') : (isMobile ? '10px' : '12px'),
        padding: isMobile ? '8px 12px' : '10px 16px',
        fontSize: isMobile ? '12px' : '13px',
        fontWeight: 600,
        color: s.is_default ? color : '#1e293b',
        boxShadow: s.is_default
          ? `0 0 0 ${isMobile ? 2 : 3}px ${color}33, 0 6px 20px ${color}20`
          : '0 3px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
        minWidth: `${nodeWidth - 20}px`,
        textAlign: 'center' as const,
        cursor: 'default',
        userSelect: 'none' as const,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: s.is_default ? 'scale(1.05)' : 'scale(1)',
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
}

function buildEdges(transitions: Transition[]): Edge[] {
  return transitions.map((t) => ({
    id: `e${t.id}`,
    source: String(t.from),
    target: String(t.to),
    animated: t.actor === 'BOT',
    style: {
      stroke: ACTOR_COLORS[t.actor],
      strokeWidth: t.actor === 'BOT' ? 3 : 2,
      strokeDasharray: t.actor === 'HUMAN' ? '5,5' : 'none',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: ACTOR_COLORS[t.actor],
      width: 18,
      height: 18,
    },
    label: t.actor === 'BOT' ? '🤖 Bot' : t.actor === 'HUMAN' ? '👤 Human' : '🔄 All',
    labelStyle: { fontSize: 10, fontWeight: 700, fill: ACTOR_COLORS[t.actor] },
    labelBgStyle: { fill: 'white', fillOpacity: 0.95, rx: 4, ry: 4 },
    labelBgPadding: [4, 8] as [number, number],
    labelShowBg: true,
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type TabKey = 'diagram' | 'states' | 'transitions';

export default function StateMachinePage() {
  const [states, setStates] = useState<WorkflowState[]>(DEFAULT_STATES);
  const [transitions, setTransitions] = useState<Transition[]>(DEFAULT_TRANSITIONS);
  const [tab, setTab] = useState<TabKey>('diagram');
  const [nextStateId, setNextStateId] = useState(8);
  const [nextTransitionId, setNextTransitionId] = useState(12);

  // Form fields
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState<ColorName>('blue');
  const [newTerminal, setNewTerminal] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [newActor, setNewActor] = useState<ActorType>('BOT');

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSmall, setIsSmall] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [diagramKey, setDiagramKey] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

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

  // Force diagram re-render when data changes for better mobile layout
  useEffect(() => {
    setDiagramKey(prev => prev + 1);
  }, [states, transitions]);

  const nodes = useMemo(() => buildNodes(states, transitions, isMobile), [states, transitions, isMobile]);
  const edges = useMemo(() => buildEdges(transitions), [transitions]);

  /* Toast helper */
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  /* Bot reachability */
  const humanOnlyTerminals = useMemo(() => {
    const botTr = transitions.filter((t) => t.actor === 'BOT' || t.actor === 'ALL');
    const def = states.find((s) => s.is_default);
    if (!def) return [];
    const reached = new Set<number>();
    const q = [def.id];
    while (q.length) {
      const c = q.shift()!;
      botTr.forEach((t) => {
        if (t.from === c && !reached.has(t.to)) { reached.add(t.to); q.push(t.to); }
      });
    }
    return states.filter((s) => s.is_terminal && !reached.has(s.id));
  }, [states, transitions]);

  /* Actions */
  const setDefaultState = (id: number) => {
    setStates((p) => p.map((s) => ({ ...s, is_default: s.id === id })));
    const st = states.find((s) => s.id === id);
    showToast(`Set "${st?.label}" as default state`, 'success');
  };

  const addState = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (states.some((s) => s.label.toLowerCase() === trimmed.toLowerCase())) {
      showToast('A state with this name already exists', 'error');
      return;
    }
    const key = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const isFirst = states.length === 0;
    setStates((p) => [...p, { id: nextStateId, key, label: trimmed, color: newColor, is_terminal: newTerminal, is_default: isFirst, pos: p.length }]);
    setNextStateId((n) => n + 1);
    setNewLabel('');
    setNewTerminal(false);
    showToast(`Added state "${trimmed}"${isFirst ? ' as default' : ''}`, 'success');
  };

  const removeState = (id: number) => {
    const st = states.find((s) => s.id === id);
    const affected = transitions.filter((t) => t.from === id || t.to === id);
    setStates((p) => {
      const next = p.filter((s) => s.id !== id);
      if (st?.is_default && next.length > 0 && !next.some((s) => s.is_default)) {
        next[0] = { ...next[0], is_default: true };
      }
      return next;
    });
    setTransitions((p) => p.filter((t) => t.from !== id && t.to !== id));
    showToast(`Removed "${st?.label}"${affected.length ? ` and ${affected.length} transition(s)` : ''}`, 'warning');
  };

  const addTransition = () => {
    if (!fromId || !toId || fromId === toId) return;
    const f = Number(fromId), t = Number(toId);
    if (transitions.some((tr) => tr.from === f && tr.to === t)) {
      showToast('This transition already exists', 'error');
      return;
    }
    setTransitions((p) => [...p, { id: nextTransitionId, from: f, to: t, actor: newActor }]);
    setNextTransitionId((n) => n + 1);
    setFromId('');
    setToId('');
    const fromSt = states.find((s) => s.id === f);
    const toSt = states.find((s) => s.id === t);
    showToast(`Added ${newActor.toLowerCase()} transition: ${fromSt?.label} → ${toSt?.label}`, 'success');
  };

  const removeTransition = (id: number) => {
    const tr = transitions.find((t) => t.id === id);
    setTransitions((p) => p.filter((t) => t.id !== id));
    if (tr) {
      const f = states.find((s) => s.id === tr.from);
      const t = states.find((s) => s.id === tr.to);
      showToast(`Removed transition: ${f?.label} → ${t?.label}`, 'warning');
    }
  };

  const exportConfig = useCallback(() => {
    const config = {
      states: states.map((s) => ({ key: s.key, label: s.label, color: s.color, is_terminal: s.is_terminal, is_default: s.is_default })),
      transitions: transitions.map((t) => {
        const f = states.find((s) => s.id === t.from);
        const to = states.find((s) => s.id === t.to);
        return { from: f?.key ?? null, to: to?.key ?? null, actor: t.actor };
      }),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'state-machine-config.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration exported', 'success');
  }, [states, transitions, showToast]);

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string);
        if (!config.states || !config.transitions) { showToast('Invalid config format', 'error'); return; }
        const idMap: Record<string, number> = {};
        const newStates: WorkflowState[] = config.states.map((s: any, i: number) => {
          const nid = 100 + i;
          idMap[s.key] = nid;
          return { id: nid, key: s.key, label: s.label, color: s.color || 'blue', is_terminal: !!s.is_terminal, is_default: !!s.is_default, pos: i };
        });
        const newTr: Transition[] = config.transitions
          .map((t: any, i: number) => ({ id: 200 + i, from: idMap[t.from], to: idMap[t.to], actor: t.actor || 'BOT' }))
          .filter((t: Transition) => t.from && t.to);
        setStates(newStates);
        setTransitions(newTr);
        setNextStateId(100 + newStates.length);
        setNextTransitionId(200 + newTr.length);
        setTab('diagram');
        showToast('Configuration imported', 'success');
      } catch (err: any) {
        showToast('Parse error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      switch (e.key) {
        case 'e': e.preventDefault(); exportConfig(); break;
        case '1': e.preventDefault(); setTab('diagram'); break;
        case '2': e.preventDefault(); setTab('states'); break;
        case '3': e.preventDefault(); setTab('transitions'); break;
        case 'Enter':
          e.preventDefault();
          if (tab === 'states') addState();
          else if (tab === 'transitions') addTransition();
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, newLabel, fromId, toId, exportConfig]);

  /* ---- Styles ---- */
  const tabStyle = (v: TabKey): React.CSSProperties => ({
    padding: isSmall ? '12px 16px' : '10px 18px',
    fontSize: isSmall ? '14px' : '13px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: tab === v ? '2px solid #818cf8' : '2px solid transparent',
    color: tab === v ? '#a5b4fc' : '#6b7280',
    transition: 'all 0.2s ease',
    minHeight: isSmall ? '48px' : 'auto',
    flex: isSmall ? '1' : 'none',
    textAlign: 'center',
  });

  const btnStyle: React.CSSProperties = {
    padding: isSmall ? '12px 20px' : '8px 16px',
    fontSize: isSmall ? '14px' : '12px',
    fontWeight: 600,
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    minHeight: isSmall ? '44px' : '32px',
    boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
  };

  const inputStyle: React.CSSProperties = {
    padding: isSmall ? '12px 14px' : '8px 12px',
    fontSize: isSmall ? '16px' : '13px',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    outline: 'none',
    background: '#18181b',
    color: '#e5e7eb',
    minHeight: isSmall ? '44px' : '32px',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, paddingRight: '32px' };

  const removeBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: isSmall ? '18px' : '14px',
    padding: isSmall ? '8px' : '4px 8px',
    borderRadius: '4px',
    minWidth: isSmall ? '40px' : '24px',
    minHeight: isSmall ? '40px' : '24px',
  };

  /* ---- Render ---- */
  return (
    <div style={{ background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isSmall ? '24px 16px 16px' : '40px 24px 24px' }}>
        <a href="/blog" style={{ display: 'inline-block', marginBottom: 16, fontSize: 13, color: '#6ee7b7', textDecoration: 'none' }}>← Back to Blog</a>
        <h1 style={{ fontSize: 'clamp(24px, 5vw, 28px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>Design Your Workflow</h1>
        <p style={{ fontSize: 'clamp(14px, 3vw, 15px)', color: '#9ca3af', lineHeight: 1.6 }}>
          Every team works differently. Define your states, draw the transitions, and see your workflow take shape.
        </p>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isSmall ? '0 8px 24px' : '0 16px 40px' }}>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #27272a', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', background: '#18181b' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #27272a', background: 'linear-gradient(135deg, #111 0%, #0f0f0f 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
            <button onClick={() => setTab('diagram')} style={tabStyle('diagram')}>{isSmall ? '⬡' : '⬡ Diagram'}</button>
            <button onClick={() => setTab('states')} style={tabStyle('states')}>{isSmall ? '●' : '● States'}</button>
            <button onClick={() => setTab('transitions')} style={tabStyle('transitions')}>{isSmall ? '→' : '→ Transitions'}</button>
          </div>

          {/* Diagram tab */}
          {tab === 'diagram' && (
            <div>
              <div style={{ height: isSmall ? 360 : 440, width: '100%', background: 'white' }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  fitView
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  proOptions={{ hideAttribution: true }}
                  minZoom={0.2}
                  maxZoom={2}
                >
                  <Background gap={20} size={1} color="#f1f5f9" />
                  <Controls showInteractive={false} />
                </ReactFlow>
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
              </div>
            </div>
          )}

          {/* States tab */}
          {tab === 'states' && (
            <div style={{ padding: isSmall ? 12 : 16 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: isSmall ? 16 : 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>Workflow States</h3>
                <p style={{ fontSize: isSmall ? 14 : 13, color: '#9ca3af', lineHeight: 1.5 }}>
                  Define the statuses your tickets can be in. Mark terminal states and set one as default.
                </p>
              </div>

              {states.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280', fontStyle: 'italic' }}>
                  No states defined yet. Add your first state below.
                </div>
              ) : (
                states.map((s) => (
                  <div key={s.id} style={{
                    display: 'flex',
                    alignItems: isSmall ? 'flex-start' : 'center',
                    gap: isSmall ? 8 : 12,
                    padding: isSmall ? '12px 0' : '10px 0',
                    borderBottom: '1px solid #27272a',
                    flexDirection: isSmall ? 'column' : 'row',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <select
                        value={s.color}
                        onChange={(e) => setStates((p) => p.map((st) => st.id === s.id ? { ...st, color: e.target.value as ColorName } : st))}
                        style={{ width: isSmall ? 24 : 20, height: isSmall ? 24 : 20, borderRadius: '50%', background: COLORS[s.color], border: '2px solid #3f3f46', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', flexShrink: 0, padding: 0 }}
                        title="Change color"
                      >
                        {(Object.keys(COLORS) as ColorName[]).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        value={s.label}
                        onChange={(e) => setStates((p) => p.map((st) => st.id === s.id ? { ...st, label: e.target.value } : st))}
                        style={{ fontSize: isSmall ? 15 : 13, fontWeight: 600, color: '#e5e7eb', background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 6px', outline: 'none', flex: 1, minWidth: 0 }}
                        onFocus={(e) => { e.target.style.borderColor = '#3f3f46'; e.target.style.background = '#27272a'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => !s.is_default && setDefaultState(s.id)}
                        disabled={s.is_default}
                        style={{
                          fontSize: isSmall ? 11 : 10,
                          background: s.is_default ? '#312e81' : '#27272a',
                          color: s.is_default ? '#a5b4fc' : '#9ca3af',
                          border: s.is_default ? 'none' : '1px solid #3f3f46',
                          padding: isSmall ? '4px 8px' : '3px 6px',
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: s.is_default ? 'default' : 'pointer',
                        }}
                      >
                        {s.is_default ? 'Default' : 'Set Default'}
                      </button>
                      <button
                        onClick={() => {
                          setStates((p) => p.map((st) => st.id === s.id ? { ...st, is_terminal: !st.is_terminal } : st));
                          showToast(`${s.label} is ${s.is_terminal ? 'no longer' : 'now'} terminal`, 'info');
                        }}
                        style={{
                          fontSize: isSmall ? 11 : 10,
                          background: s.is_terminal ? '#27272a' : 'transparent',
                          color: s.is_terminal ? '#9ca3af' : '#6b7280',
                          border: s.is_terminal ? 'none' : '1px dashed #3f3f46',
                          padding: isSmall ? '4px 8px' : '3px 6px',
                          borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {s.is_terminal ? 'Terminal' : 'Non-terminal'}
                      </button>
                      <button onClick={() => removeState(s.id)} style={removeBtnStyle}>✕</button>
                    </div>
                  </div>
                ))
              )}

              <div style={{ display: 'flex', gap: isSmall ? 12 : 8, marginTop: 20, alignItems: isSmall ? 'stretch' : 'center', flexDirection: isSmall ? 'column' : 'row', flexWrap: isSmall ? 'nowrap' : 'wrap' }}>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addState()}
                  placeholder="Status name..."
                  style={{ ...inputStyle, flex: isSmall ? 'none' : '1', minWidth: isSmall ? '100%' : 120 }}
                />
                <div style={{ display: 'flex', gap: isSmall ? 12 : 8, alignItems: 'center', flexDirection: isSmall ? 'column' : 'row', width: isSmall ? '100%' : 'auto' }}>
                  <select value={newColor} onChange={(e) => setNewColor(e.target.value as ColorName)} style={{ ...selectStyle, width: isSmall ? '100%' : 'auto' }}>
                    {(Object.keys(COLORS) as ColorName[]).map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: isSmall ? 14 : 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked={newTerminal} onChange={(e) => setNewTerminal(e.target.checked)} style={{ width: isSmall ? 18 : 14, height: isSmall ? 18 : 14, cursor: 'pointer' }} />
                    Terminal state
                  </label>
                  <button onClick={addState} disabled={!newLabel.trim()} style={{ ...btnStyle, opacity: !newLabel.trim() ? 0.5 : 1, cursor: !newLabel.trim() ? 'not-allowed' : 'pointer', width: isSmall ? '100%' : 'auto' }}>
                    + Add Status
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transitions tab */}
          {tab === 'transitions' && (
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
                  const f = states.find((s) => s.id === t.from);
                  const to = states.find((s) => s.id === t.to);
                  return (
                    <div key={t.id} style={{
                      display: 'flex',
                      alignItems: isSmall ? 'flex-start' : 'center',
                      gap: isSmall ? 8 : 10,
                      padding: isSmall ? '12px 0' : '8px 0',
                      borderBottom: '1px solid #27272a',
                      fontSize: isSmall ? 14 : 13,
                      flexDirection: isSmall ? 'column' : 'row',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                        <select
                          value={t.from}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v === t.to) return;
                            setTransitions((p) => p.map((tr) => tr.id === t.id ? { ...tr, from: v } : tr));
                          }}
                          style={{ ...selectStyle, fontSize: isSmall ? 13 : 12, padding: isSmall ? '6px 10px' : '4px 8px', minWidth: isSmall ? 100 : 80, minHeight: 'auto' }}
                        >
                          {states.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <span style={{ color: '#6b7280', fontWeight: 600, fontSize: isSmall ? 16 : 14 }}>→</span>
                        <select
                          value={t.to}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v === t.from) return;
                            setTransitions((p) => p.map((tr) => tr.id === t.id ? { ...tr, to: v } : tr));
                          }}
                          style={{ ...selectStyle, fontSize: isSmall ? 13 : 12, padding: isSmall ? '6px 10px' : '4px 8px', minWidth: isSmall ? 100 : 80, minHeight: 'auto' }}
                        >
                          {states.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={t.actor}
                          onChange={(e) => setTransitions((p) => p.map((tr) => tr.id === t.id ? { ...tr, actor: e.target.value as ActorType } : tr))}
                          style={{
                            fontSize: isSmall ? 12 : 10, fontWeight: 700,
                            padding: isSmall ? '6px 10px' : '4px 8px', borderRadius: 6,
                            color: 'white', background: ACTOR_COLORS[t.actor],
                            border: '1px solid ' + ACTOR_COLORS[t.actor],
                            cursor: 'pointer', minHeight: 'auto',
                          }}
                        >
                          <option value="BOT" style={{ background: '#18181b', color: '#e5e7eb' }}>BOT</option>
                          <option value="HUMAN" style={{ background: '#18181b', color: '#e5e7eb' }}>HUMAN</option>
                          <option value="ALL" style={{ background: '#18181b', color: '#e5e7eb' }}>ALL</option>
                        </select>
                        <button onClick={() => removeTransition(t.id)} style={removeBtnStyle}>✕</button>
                      </div>
                    </div>
                  );
                })
              )}

              <div style={{ display: 'flex', gap: isSmall ? 12 : 8, marginTop: 20, alignItems: isSmall ? 'stretch' : 'center', flexDirection: isSmall ? 'column' : 'row', flexWrap: isSmall ? 'nowrap' : 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isSmall ? 8 : 6, flex: isSmall ? 'none' : '1', minWidth: isSmall ? '100%' : 200 }}>
                  <select value={fromId} onChange={(e) => setFromId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                    <option value="">From...</option>
                    {states.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <span style={{ color: '#6b7280', fontWeight: 600, fontSize: isSmall ? 16 : 14, flexShrink: 0 }}>→</span>
                  <select value={toId} onChange={(e) => setToId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                    <option value="">To...</option>
                    {states.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: isSmall ? 12 : 8, alignItems: 'center', flexDirection: isSmall ? 'column' : 'row', width: isSmall ? '100%' : 'auto' }}>
                  <select value={newActor} onChange={(e) => setNewActor(e.target.value as ActorType)} style={{ ...selectStyle, width: isSmall ? '100%' : 'auto' }}>
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

          {/* Export / Import bar */}
          <div style={{ background: '#111', borderTop: '1px solid #27272a', padding: '12px 16px', fontSize: 12, color: '#9ca3af', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Quick actions:</span>
              <button onClick={exportConfig} style={{ ...btnStyle, fontSize: 11, padding: '6px 12px', minHeight: 'auto', background: '#374151' }}>↓ Export</button>
              <input ref={importRef} type="file" accept=".json" onChange={importConfig} style={{ display: 'none' }} />
              <button onClick={() => importRef.current?.click()} style={{ ...btnStyle, fontSize: 11, padding: '6px 12px', minHeight: 'auto', background: '#374151' }}>↑ Import</button>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <span><kbd style={kbdStyle}>Ctrl/⌘</kbd> + <kbd style={kbdStyle}>1-3</kbd> Switch tabs</span>
              <span><kbd style={kbdStyle}>Ctrl/⌘</kbd> + <kbd style={kbdStyle}>E</kbd> Export</span>
              <span><kbd style={kbdStyle}>Ctrl/⌘</kbd> + <kbd style={kbdStyle}>↵</kbd> Add item</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isSmall ? '24px 16px' : '32px 24px', borderTop: '1px solid #18181b' }}>
        <h2 style={{ fontSize: 'clamp(16px, 4vw, 18px)', fontWeight: 600, color: 'white', marginBottom: 12 }}>How It Works</h2>
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 8 }}>
          <strong style={{ color: '#d1d5db' }}>States</strong> are the statuses your tickets can be in. Mark them <em style={{ color: '#6ee7b7', fontStyle: 'normal' }}>terminal</em> when they are end states. One state is the <em style={{ color: '#6ee7b7', fontStyle: 'normal' }}>default</em> — where new tickets start.
        </p>
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 8 }}>
          <strong style={{ color: '#d1d5db' }}>Transitions</strong> are the allowed moves. Each one has an actor type:
        </p>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <li style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 4 }}><strong style={{ color: '#d1d5db' }}>Bot</strong> — the agent can make this move autonomously</li>
          <li style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 4 }}><strong style={{ color: '#d1d5db' }}>Human</strong> — only a person can make this move</li>
          <li style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 4 }}><strong style={{ color: '#d1d5db' }}>All</strong> — either can</li>
        </ul>
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 8 }}>
          The diagram builds itself as you configure. Purple animated edges are bot paths. Blue edges are human-only. If a terminal state has no bot path leading to it, the ⚠ warning tells you — that is a human checkpoint.
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid #18181b', margin: '20px 0' }} />
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7 }}>
          This is how <a href="https://openweave.dev" style={{ color: '#6ee7b7', textDecoration: 'none' }}>OpenWeave</a> handles execution governance. The state machine is workspace-level config — no code, no deploys. Admins draw the lines, bots follow them.
        </p>
      </div>

      {/* Toasts */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, pointerEvents: 'none' }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{
            background: '#1f1f1f',
            border: `1px solid ${toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#22c55e' : toast.type === 'warning' ? '#f59e0b' : '#374151'}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 8,
            color: '#e5e7eb',
            fontSize: 14,
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
            maxWidth: 320,
            wordWrap: 'break-word',
            animation: 'slideIn 0.3s ease',
          }}>
            {toast.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  background: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 10,
  fontFamily: 'monospace',
  color: '#d1d5db',
};
