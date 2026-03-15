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
import PublicNav from '@/components/PublicNav';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ColorName =
  | 'gray' | 'blue' | 'red' | 'purple' | 'amber'
  | 'green' | 'yellow' | 'indigo' | 'pink' | 'orange' | 'cyan';

interface WorkflowState {
  id: number;
  key: string;
  label: string;
  color: ColorName;
  is_default: boolean;
  pos: number;
  allowed_from: number[];
  allowed_users: number[];
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
  pink: '#ec4899', orange: '#f97316', cyan: '#06b6d4',
};

const DEFAULT_STATES: WorkflowState[] = [
  { id: 1, key: 'OPEN', label: 'Open', color: 'gray', is_default: true, pos: 0, allowed_from: [], allowed_users: [] },
  { id: 2, key: 'IN_SPEC', label: 'In Spec', color: 'blue', is_default: false, pos: 1, allowed_from: [1], allowed_users: [] },
  { id: 3, key: 'IN_DEV', label: 'In Dev', color: 'cyan', is_default: false, pos: 2, allowed_from: [2], allowed_users: [] },
  { id: 4, key: 'BLOCKED', label: 'Blocked', color: 'red', is_default: false, pos: 3, allowed_from: [], allowed_users: [] },
  { id: 5, key: 'IN_TESTING', label: 'In Testing', color: 'purple', is_default: false, pos: 4, allowed_from: [3], allowed_users: [] },
  { id: 6, key: 'REVIEW', label: 'Review', color: 'amber', is_default: false, pos: 5, allowed_from: [5], allowed_users: [] },
  { id: 7, key: 'COMPLETED', label: 'Completed', color: 'green', is_default: false, pos: 6, allowed_from: [6], allowed_users: [] },
  { id: 8, key: 'CANCELLED', label: 'Cancelled', color: 'gray', is_default: false, pos: 7, allowed_from: [], allowed_users: [] },
];

/* ------------------------------------------------------------------ */
/*  Dagre layout                                                       */
/* ------------------------------------------------------------------ */

function buildNodes(states: WorkflowState[]): Node[] {
  // Build edges for layout calculation
  const edges: { from: number; to: number }[] = [];
  states.forEach(state => {
    if (state.allowed_from.length === 0) {
      // If no restrictions, can come from any state
      states.forEach(fromState => {
        if (fromState.id !== state.id) {
          edges.push({ from: fromState.id, to: state.id });
        }
      });
    } else {
      // Only from specified states
      state.allowed_from.forEach(fromId => {
        edges.push({ from: fromId, to: state.id });
      });
    }
  });

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });
  g.setDefaultEdgeLabel(() => ({}));
  states.forEach((s) => g.setNode(String(s.id), { width: 140, height: 40 }));
  edges.forEach((e) => g.setEdge(String(e.from), String(e.to)));
  dagre.layout(g);

  return states.map((s) => {
    const nd = g.node(String(s.id));
    const color = COLORS[s.color] || '#9ca3af';
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
}

function buildEdges(states: WorkflowState[]): Edge[] {
  const edges: Edge[] = [];
  let edgeId = 1;

  states.forEach(state => {
    const hasUserRestrictions = state.allowed_users.length > 0;
    
    if (state.allowed_from.length === 0) {
      // No restrictions - can come from any state
      states.forEach(fromState => {
        if (fromState.id !== state.id) {
          edges.push({
            id: `e${edgeId++}`,
            source: String(fromState.id),
            target: String(state.id),
            animated: false,
            style: {
              stroke: hasUserRestrictions ? '#f59e0b' : '#6b7280',
              strokeWidth: 2,
              strokeDasharray: hasUserRestrictions ? '5,5' : 'none',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: hasUserRestrictions ? '#f59e0b' : '#6b7280',
              width: 14,
              height: 14,
            },
          });
        }
      });
    } else {
      // Only from specified states
      state.allowed_from.forEach(fromId => {
        edges.push({
          id: `e${edgeId++}`,
          source: String(fromId),
          target: String(state.id),
          animated: false,
          style: {
            stroke: hasUserRestrictions ? '#f59e0b' : '#6b7280',
            strokeWidth: 2,
            strokeDasharray: hasUserRestrictions ? '5,5' : 'none',
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: hasUserRestrictions ? '#f59e0b' : '#6b7280',
            width: 14,
            height: 14,
          },
        });
      });
    }
  });

  return edges;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type TabKey = 'diagram' | 'states';

export default function StateMachinePage() {
  const [states, setStates] = useState<WorkflowState[]>(DEFAULT_STATES);
  const [tab, setTab] = useState<TabKey>('diagram');
  const [nextStateId, setNextStateId] = useState(9);

  // Form fields
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState<ColorName>('blue');

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
  }, [states]);

  const nodes = useMemo(() => buildNodes(states), [states]);
  const edges = useMemo(() => buildEdges(states), [states]);

  /* Toast helper */
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

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
    setStates((p) => [...p, { 
      id: nextStateId, 
      key, 
      label: trimmed, 
      color: newColor, 
      is_default: isFirst, 
      pos: p.length,
      allowed_from: [],
      allowed_users: []
    }]);
    setNextStateId((n) => n + 1);
    setNewLabel('');
    showToast(`Added state "${trimmed}"${isFirst ? ' as default' : ''}`, 'success');
  };

  const removeState = (id: number) => {
    const st = states.find((s) => s.id === id);
    setStates((p) => {
      const next = p.filter((s) => s.id !== id).map(s => ({
        ...s,
        // Remove references to deleted state from allowed_from arrays
        allowed_from: s.allowed_from.filter(fromId => fromId !== id)
      }));
      if (st?.is_default && next.length > 0 && !next.some((s) => s.is_default)) {
        next[0] = { ...next[0], is_default: true };
      }
      return next;
    });
    showToast(`Removed "${st?.label}"`, 'warning');
  };

  const toggleAllowedFrom = (stateId: number, fromStateId: number) => {
    setStates(prev => prev.map(state => {
      if (state.id === stateId) {
        const currentAllowed = state.allowed_from;
        const isCurrentlyAllowed = currentAllowed.includes(fromStateId);
        
        return {
          ...state,
          allowed_from: isCurrentlyAllowed 
            ? currentAllowed.filter(id => id !== fromStateId)
            : [...currentAllowed, fromStateId]
        };
      }
      return state;
    }));
  };

  const exportConfig = useCallback(() => {
    const config = {
      states: states.map((s) => ({ 
        key: s.key, 
        label: s.label, 
        color: s.color, 
        is_default: s.is_default,
        allowed_from: s.allowed_from.map(id => states.find(st => st.id === id)?.key).filter(Boolean),
        allowed_users: s.allowed_users
      })),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'state-machine-config.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration exported', 'success');
  }, [states, showToast]);

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string);
        if (!config.states) { showToast('Invalid config format', 'error'); return; }
        const idMap: Record<string, number> = {};
        const newStates: WorkflowState[] = config.states.map((s: any, i: number) => {
          const nid = 100 + i;
          idMap[s.key] = nid;
          return { 
            id: nid, 
            key: s.key, 
            label: s.label, 
            color: s.color || 'blue', 
            is_default: !!s.is_default, 
            pos: i,
            allowed_from: [],
            allowed_users: s.allowed_users || []
          };
        });
        
        // Second pass to resolve allowed_from references
        newStates.forEach((state, i) => {
          const configState = config.states[i];
          if (configState.allowed_from) {
            state.allowed_from = configState.allowed_from
              .map((key: string) => idMap[key])
              .filter((id: number) => id !== undefined);
          }
        });
        
        setStates(newStates);
        setNextStateId(100 + newStates.length);
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
        case 'Enter':
          e.preventDefault();
          if (tab === 'states') addState();
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, newLabel, exportConfig]);

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

  const toggleBtnStyle = (isActive: boolean): React.CSSProperties => ({
    padding: isMobile ? '12px 16px' : '8px 12px',
    fontSize: isMobile ? '14px' : '12px',
    fontWeight: 600,
    background: isActive ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : 'rgba(39,39,42,0.8)',
    color: isActive ? 'white' : '#9ca3af',
    border: isActive ? 'none' : '1px solid #3f3f46',
    borderRadius: isMobile ? '10px' : '8px',
    cursor: 'pointer',
    minHeight: isMobile ? '40px' : '32px',
    transition: 'all 0.2s ease',
    userSelect: 'none',
  });

  /* ---- Render ---- */
  return (
    <div style={{ background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <PublicNav />

      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isSmall ? '24px 16px 16px' : '40px 24px 24px' }}>
        <h1 style={{ fontSize: 'clamp(24px, 5vw, 28px)', fontWeight: 700, color: 'white', marginBottom: 8 }}>Design Your Workflow</h1>
        <p style={{ fontSize: 'clamp(14px, 3vw, 15px)', color: '#9ca3af', lineHeight: 1.6 }}>
          Every team works differently. Define your states, configure the gates, and see your workflow take shape.
        </p>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isSmall ? '0 8px 24px' : '0 16px 40px' }}>
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #27272a', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', background: '#18181b' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #27272a', background: 'linear-gradient(135deg, #111 0%, #0f0f0f 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
            <button onClick={() => setTab('diagram')} style={tabStyle('diagram')}>⬡ Diagram</button>
            <button onClick={() => setTab('states')} style={tabStyle('states')}>● States</button>
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
                  <span>⭐ <span style={{ color: '#fbbf24' }}>Default state</span></span>
                  <span>--- <span style={{ color: '#f59e0b' }}>Restricted access</span></span>
                  <span>→ <span style={{ color: '#6b7280' }}>Gate transition</span></span>
                </div>
              </div>
            </div>
          )}

          {/* States tab */}
          {tab === 'states' && (
            <div style={{ padding: isSmall ? 12 : 16 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: isSmall ? 16 : 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>Workflow States & Gates</h3>
                <p style={{ fontSize: isSmall ? 14 : 13, color: '#9ca3af', lineHeight: 1.5 }}>
                  Define the statuses your tickets can be in and configure which states can transition to each one.
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
                    alignItems: 'flex-start',
                    gap: isMobile ? 12 : isSmall ? 10 : 12,
                    padding: isMobile ? '20px' : isSmall ? '16px' : '14px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease',
                  }}>
                    {/* State header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minWidth: 0 }}>
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
                      <div style={{ 
                        display: 'flex', 
                        gap: isMobile ? 10 : 8, 
                        alignItems: 'center', 
                        flexWrap: 'wrap'
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
                        <button onClick={() => removeState(s.id)} style={removeBtnStyle}>✕</button>
                      </div>
                    </div>

                    {/* Allowed from section */}
                    <div style={{ width: '100%' }}>
                      <h4 style={{ fontSize: isMobile ? 14 : 12, fontWeight: 600, color: '#d1d5db', marginBottom: 8 }}>
                        Allowed from states {s.allowed_from.length === 0 && <span style={{ color: '#6b7280', fontWeight: 400 }}>(any state)</span>}
                      </h4>
                      <div style={{ 
                        display: 'flex', 
                        gap: isMobile ? 8 : 6, 
                        flexWrap: 'wrap',
                        alignItems: 'center'
                      }}>
                        {states.filter(st => st.id !== s.id).map(fromState => {
                          const isAllowed = s.allowed_from.includes(fromState.id);
                          return (
                            <button
                              key={fromState.id}
                              onClick={() => toggleAllowedFrom(s.id, fromState.id)}
                              style={toggleBtnStyle(isAllowed)}
                            >
                              {fromState.label}
                            </button>
                          );
                        })}
                        {states.length <= 1 && (
                          <span style={{ fontSize: isMobile ? 14 : 12, color: '#6b7280', fontStyle: 'italic' }}>
                            Add more states to configure gates
                          </span>
                        )}
                      </div>
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
                  <button onClick={addState} disabled={!newLabel.trim()} style={{ ...btnStyle, opacity: !newLabel.trim() ? 0.5 : 1, cursor: !newLabel.trim() ? 'not-allowed' : 'pointer', width: isSmall ? '100%' : 'auto' }}>
                    + Add State
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
              <span><kbd style={kbdStyle}>Ctrl/⌘</kbd> + <kbd style={kbdStyle}>1-2</kbd> Switch tabs</span>
              <span><kbd style={kbdStyle}>Ctrl/⌘</kbd> + <kbd style={kbdStyle}>E</kbd> Export</span>
              <span><kbd style={kbdStyle}>Ctrl/⌘</kbd> + <kbd style={kbdStyle}>↵</kbd> Add state</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: isSmall ? '24px 16px' : '32px 24px', borderTop: '1px solid #18181b' }}>
        <h2 style={{ fontSize: 'clamp(16px, 4vw, 18px)', fontWeight: 600, color: 'white', marginBottom: 12 }}>How It Works</h2>
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 8 }}>
          <strong style={{ color: '#d1d5db' }}>States</strong> are the statuses your tickets can be in. One state is the <em style={{ color: '#6ee7b7', fontStyle: 'normal' }}>default</em> — where new tickets start.
        </p>
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 8 }}>
          <strong style={{ color: '#d1d5db' }}>Gates</strong> control which states can transition to each state. If "Allowed from" is empty, tickets can move from any state. Otherwise, only specified states can transition in.
        </p>
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 8 }}>
          <strong style={{ color: '#d1d5db' }}>Access control</strong> can be added later with user restrictions — dashed amber edges indicate states with limited access.
        </p>
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7, marginBottom: 8 }}>
          The diagram builds itself as you configure. Gray edges show normal transitions. Dashed amber edges show restricted access.
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid #18181b', margin: '20px 0' }} />
        <p style={{ fontSize: 'clamp(13px, 3vw, 14px)', color: '#9ca3af', lineHeight: 1.7 }}>
          This is how <a href="https://openweave.dev" style={{ color: '#6ee7b7', textDecoration: 'none' }}>OpenWeave</a> handles execution governance. The state machine is workspace-level config — no code, no deploys. Admins design the gates, teams follow them.
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