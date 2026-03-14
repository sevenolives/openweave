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
  is_bot_requires_approval: boolean;
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
  { id: 1, key: 'OPEN', label: 'Open', color: 'gray', is_terminal: false, is_default: true, is_bot_requires_approval: false, pos: 0 },
  { id: 2, key: 'IN_PROGRESS', label: 'In Progress', color: 'blue', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 1 },
  { id: 3, key: 'BLOCKED', label: 'Blocked', color: 'red', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 2 },
  { id: 4, key: 'IN_TESTING', label: 'In Testing', color: 'purple', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 3 },
  { id: 5, key: 'REVIEW', label: 'Review', color: 'amber', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 4 },
  { id: 6, key: 'COMPLETED', label: 'Completed', color: 'green', is_terminal: true, is_default: false, is_bot_requires_approval: true, pos: 5 },
  { id: 7, key: 'CANCELLED', label: 'Cancelled', color: 'gray', is_terminal: true, is_default: false, is_bot_requires_approval: false, pos: 6 },
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

function buildNodes(states: WorkflowState[], transitions: Transition[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));
  states.forEach((s) => g.setNode(String(s.id), { width: 140, height: 40 }));
  transitions.forEach((t) => g.setEdge(String(t.from), String(t.to)));
  dagre.layout(g);

  return states.map((s) => {
    const nd = g.node(String(s.id));
    const color = COLORS[s.color] || '#9ca3af';
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
}

function buildEdges(transitions: Transition[], states: WorkflowState[]): Edge[] {
  return transitions.map((t) => {
    const targetState = states.find((s) => s.id === t.to);
    const isGatedBot = (t.actor === 'BOT' || t.actor === 'ALL') && targetState?.is_bot_requires_approval;
    const edgeColor = isGatedBot ? '#eab308' : ACTOR_COLORS[t.actor];
    return {
    id: `e${t.id}`,
    source: String(t.from),
    target: String(t.to),
    animated: t.actor === 'BOT' && !isGatedBot,
    style: {
      stroke: edgeColor,
      strokeWidth: 2,
      strokeDasharray: t.actor === 'HUMAN' ? '5,5' : isGatedBot ? '8,4' : 'none',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeColor,
      width: 14,
      height: 14,
    },
    label: isGatedBot ? `${t.actor} 🔒` : t.actor,
    labelStyle: { fontSize: 9, fontWeight: 700, fill: edgeColor },
    labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
  };});
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

  const nodes = useMemo(() => buildNodes(states, transitions), [states, transitions]);
  const edges = useMemo(() => buildEdges(transitions, states), [transitions, states]);

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
    setStates((p) => [...p, { id: nextStateId, key, label: trimmed, color: newColor, is_terminal: newTerminal, is_default: isFirst, is_bot_requires_approval: false, pos: p.length }]);
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
      states: states.map((s) => ({ key: s.key, label: s.label, color: s.color, is_terminal: s.is_terminal, is_default: s.is_default, is_bot_requires_approval: s.is_bot_requires_approval })),
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
          return { id: nid, key: s.key, label: s.label, color: s.color || 'blue', is_terminal: !!s.is_terminal, is_default: !!s.is_default, is_bot_requires_approval: !!s.is_bot_requires_approval, pos: i };
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
    padding: isMobile ? '16px 12px' : isSmall ? '14px 16px' : '12px 20px',
    fontSize: isMobile ? '15px' : isSmall ? '14px' : '13px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: tab === v ? '3px solid #818cf8' : '3px solid transparent',
    color: tab === v ? '#a5b4fc' : '#6b7280',
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

  /* ---- Render ---- */
  return (
    <div style={{ background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ fontSize: 18, fontWeight: 600, color: 'white', textDecoration: 'none', letterSpacing: '-0.02em' }}>OpenWeave</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="/docs" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none' }}>Docs</a>
            <a href="/blog" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none' }}>Blog</a>
            <a href="/policies" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none' }}>Policies</a>
            <a href="https://github.com/sevenolives/openweave" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none' }}>GitHub</a>
            <a href="/login" style={{ fontSize: 14, fontWeight: 500, color: '#d1d5db', textDecoration: 'none' }}>Sign In →</a>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isSmall ? '24px 16px 16px' : '40px 24px 24px' }}>
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
            <button onClick={() => setTab('diagram')} style={tabStyle('diagram')}>⬡ Diagram</button>
            <button onClick={() => setTab('states')} style={tabStyle('states')}>● States</button>
            <button onClick={() => setTab('transitions')} style={tabStyle('transitions')}>→ Transitions</button>
          </div>

          {/* Diagram tab */}
          {tab === 'diagram' && (
            <div>
              <div style={{ 
                height: isMobile ? 320 : isSmall ? 380 : 480, 
                width: '100%', 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '0 0 12px 12px'
              }}>
                <ReactFlow
                  key={diagramKey}
                  nodes={nodes}
                  edges={edges}
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
                
                {/* Mobile help overlay */}
                {isMobile && (
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
                {states.filter((s) => s.is_bot_requires_approval).length > 0 && (
                  <div style={{
                    fontSize: isSmall ? 13 : 12,
                    color: '#eab308',
                    fontWeight: 600,
                    background: 'rgba(234,179,8,0.1)',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(234,179,8,0.2)',
                  }}>
                    🔒 Approval gate: {states.filter((s) => s.is_bot_requires_approval).map((s) => s.label).join(', ')}
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
                states.map((s) => (
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
                        background: COLORS[s.color],
                        flexShrink: 0,
                        boxShadow: `0 0 0 3px ${COLORS[s.color]}20`,
                        cursor: 'pointer'
                      }}>
                        <select
                          value={s.color}
                          onChange={(e) => setStates((p) => p.map((st) => st.id === s.id ? { ...st, color: e.target.value as ColorName } : st))}
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
                          {(Object.keys(COLORS) as ColorName[]).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <input
                        value={s.label}
                        onChange={(e) => setStates((p) => p.map((st) => st.id === s.id ? { ...st, label: e.target.value } : st))}
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
                        onClick={() => !s.is_default && setDefaultState(s.id)}
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
                          setStates((p) => p.map((st) => st.id === s.id ? { ...st, is_terminal: !st.is_terminal } : st));
                          showToast(`${s.label} is ${s.is_terminal ? 'no longer' : 'now'} terminal`, 'info');
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
                          setStates((p) => p.map((st) => st.id === s.id ? { ...st, is_bot_requires_approval: !st.is_bot_requires_approval } : st));
                          showToast(`${s.label} ${s.is_bot_requires_approval ? 'no longer' : 'now'} requires approval`, 'info');
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
                      gap: isSmall ? 6 : 10,
                      padding: isSmall ? '8px 0' : '8px 0',
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
                          style={{ ...selectStyle, fontSize: isSmall ? 13 : 12, padding: isSmall ? '0 14px' : '4px 8px', minWidth: isSmall ? 100 : 80, height: isSmall ? 44 : 'auto', minHeight: isSmall ? 44 : 'auto' }}
                        >
                          {states.filter((s) => !s.is_terminal).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                        <span style={{ color: '#6b7280', fontWeight: 600, fontSize: isSmall ? 16 : 14 }}>→</span>
                        <select
                          value={t.to}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v === t.from) return;
                            setTransitions((p) => p.map((tr) => tr.id === t.id ? { ...tr, to: v } : tr));
                          }}
                          style={{ ...selectStyle, fontSize: isSmall ? 13 : 12, padding: isSmall ? '0 14px' : '4px 8px', minWidth: isSmall ? 100 : 80, height: isSmall ? 44 : 'auto', minHeight: isSmall ? 44 : 'auto' }}
                        >
                          {states.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={t.actor}
                          onChange={(e) => setTransitions((p) => p.map((tr) => tr.id === t.id ? { ...tr, actor: e.target.value as ActorType } : tr))}
                          style={{
                            fontSize: isSmall ? 13 : 10, fontWeight: 700,
                            padding: isSmall ? '0 14px' : '4px 8px', borderRadius: isSmall ? 10 : 6,
                            color: 'white', background: ACTOR_COLORS[t.actor],
                            border: '1px solid ' + ACTOR_COLORS[t.actor],
                            cursor: 'pointer', height: isSmall ? 44 : 'auto', minHeight: isSmall ? 44 : 'auto',
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
                    {states.filter((s) => !s.is_terminal).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
          The diagram builds itself as you configure. Purple animated edges are bot paths. Blue edges are human-only. If a terminal state has no bot path leading to it, the ⚠ warning tells you — that is a human checkpoint. States marked with 🔒 are <em style={{ color: '#eab308', fontStyle: 'normal' }}>approval gates</em> — bots cannot move tickets into them unless the ticket is approved.
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid #18181b', margin: '20px 0' }} />
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7 }}>
          This is how <a href="https://openweave.dev" style={{ color: '#6ee7b7', textDecoration: 'none' }}>OpenWeave</a> handles execution governance. The state machine is workspace-level config — no code, no deploys. Admins draw the lines, bots follow them.
        </p>
      </div>

      {/* Toasts */}
      <div style={{ 
        position: 'fixed', 
        top: isMobile ? 16 : 20, 
        right: isMobile ? 16 : 20, 
        left: isMobile ? 16 : 'auto',
        zIndex: 1000, 
        pointerEvents: 'none' 
      }}>
        {toasts.map((toast) => {
          const colors = {
            error: { bg: '#7f1d1d', border: '#ef4444', icon: '❌' },
            success: { bg: '#14532d', border: '#22c55e', icon: '✅' },
            warning: { bg: '#78350f', border: '#f59e0b', icon: '⚠️' },
            info: { bg: '#1e3a8a', border: '#3b82f6', icon: 'ℹ️' }
          };
          const style = colors[toast.type];
          
          return (
            <div key={toast.id} style={{
              background: `linear-gradient(135deg, ${style.bg}cc 0%, ${style.bg}aa 100%)`,
              backdropFilter: 'blur(12px)',
              border: `1px solid ${style.border}66`,
              borderRadius: isMobile ? '12px' : '10px',
              padding: isMobile ? '16px 20px' : '12px 16px',
              marginBottom: isMobile ? 12 : 8,
              color: '#ffffff',
              fontSize: isMobile ? 15 : 14,
              fontWeight: 500,
              boxShadow: `0 8px 32px ${style.bg}40, 0 4px 16px rgba(0,0,0,0.2)`,
              pointerEvents: 'auto',
              maxWidth: isMobile ? '100%' : 360,
              wordWrap: 'break-word',
              animation: 'slideInToast 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <span style={{ fontSize: isMobile ? '18px' : '16px', flexShrink: 0 }}>{style.icon}</span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideInToast { 
          from { 
            transform: translateX(100%) scale(0.9); 
            opacity: 0; 
          } 
          to { 
            transform: translateX(0) scale(1); 
            opacity: 1; 
          } 
        }
        
        /* Custom scrollbar for webkit browsers */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        /* Focus styles for better accessibility */
        button:focus-visible,
        input:focus-visible,
        select:focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: 2px;
        }
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
