'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// ─── Types ───────────────────────────────────────────────────────────
interface StatusDef {
  id: number;
  key: string;
  label: string;
  color: string;
  is_terminal: boolean;
  is_default: boolean;
  position: number;
}

interface TransitionDef {
  id: number;
  from_status: number;
  to_status: number;
  actor_type: 'BOT' | 'HUMAN' | 'ALL';
}

// ─── Constants ───────────────────────────────────────────────────────
const COLOR_HEX: Record<string, string> = {
  gray: '#9ca3af', blue: '#3b82f6', red: '#ef4444', purple: '#a855f7',
  amber: '#f59e0b', green: '#22c55e', yellow: '#eab308', indigo: '#6366f1',
  pink: '#ec4899', orange: '#f97316',
};

const ACTOR_COLORS: Record<string, string> = {
  BOT: '#a855f7',
  HUMAN: '#3b82f6',
  ALL: '#9ca3af',
};

const PALETTE = Object.keys(COLOR_HEX);

const DEFAULT_STATUSES: StatusDef[] = [
  { id: 1, key: 'open',        label: 'Open',        color: 'blue',   is_terminal: false, is_default: true,  position: 0 },
  { id: 2, key: 'in_progress', label: 'In Progress', color: 'amber',  is_terminal: false, is_default: false, position: 1 },
  { id: 3, key: 'blocked',     label: 'Blocked',     color: 'red',    is_terminal: false, is_default: false, position: 2 },
  { id: 4, key: 'in_testing',  label: 'In Testing',  color: 'orange', is_terminal: false, is_default: false, position: 3 },
  { id: 5, key: 'review',      label: 'Review',      color: 'indigo', is_terminal: false, is_default: false, position: 4 },
  { id: 6, key: 'completed',   label: 'Completed',   color: 'green',  is_terminal: true,  is_default: false, position: 5 },
  { id: 7, key: 'cancelled',   label: 'Cancelled',   color: 'gray',   is_terminal: true,  is_default: false, position: 6 },
];

const DEFAULT_TRANSITIONS: TransitionDef[] = [
  { id: 1,  from_status: 1, to_status: 2, actor_type: 'BOT' },
  { id: 2,  from_status: 2, to_status: 3, actor_type: 'ALL' },
  { id: 3,  from_status: 2, to_status: 4, actor_type: 'BOT' },
  { id: 4,  from_status: 3, to_status: 2, actor_type: 'HUMAN' },
  { id: 5,  from_status: 4, to_status: 5, actor_type: 'BOT' },
  { id: 6,  from_status: 5, to_status: 6, actor_type: 'HUMAN' },
  { id: 7,  from_status: 5, to_status: 2, actor_type: 'HUMAN' },
  { id: 8,  from_status: 1, to_status: 7, actor_type: 'ALL' },
  { id: 9,  from_status: 2, to_status: 7, actor_type: 'ALL' },
  { id: 10, from_status: 3, to_status: 7, actor_type: 'ALL' },
];

let _nextStatusId = 100;
let _nextTransitionId = 100;

// ─── Layout helper ──────────────────────────────────────────────────
function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 140 });
  nodes.forEach((n) => g.setNode(n.id, { width: 160, height: 60 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 80, y: pos.y - 30 } };
  });
}

// ─── Diagram component (self-contained, no stale state) ─────────────
function Diagram({ statuses, transitions }: { statuses: StatusDef[]; transitions: TransitionDef[] }) {
  const { nodes, edges } = useMemo(() => {
    const rawNodes: Node[] = statuses.map((s) => ({
      id: String(s.id),
      data: {
        label: (
          <div className="flex items-center gap-1.5 px-1">
            {s.is_default && <span className="text-amber-500 text-xs">⭐</span>}
            <span className="font-medium text-sm truncate">{s.label}</span>
          </div>
        ),
      },
      position: { x: 0, y: 0 },
      style: {
        background: 'white',
        border: `${s.is_terminal ? '4px double' : '2px solid'} ${COLOR_HEX[s.color] || '#9ca3af'}`,
        borderRadius: s.is_terminal ? '16px' : '8px',
        padding: '8px 12px',
        minWidth: '120px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      },
    }));

    const rawEdges: Edge[] = transitions.map((t) => ({
      id: `e-${t.id}`,
      source: String(t.from_status),
      target: String(t.to_status),
      animated: t.actor_type === 'BOT',
      style: { stroke: ACTOR_COLORS[t.actor_type] || '#9ca3af', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: ACTOR_COLORS[t.actor_type] || '#9ca3af' },
      label: t.actor_type,
      labelStyle: { fontSize: 10, fill: ACTOR_COLORS[t.actor_type] || '#9ca3af', fontWeight: 600 },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
    }));

    return { nodes: layoutGraph(rawNodes, rawEdges), edges: rawEdges };
  }, [statuses, transitions]);

  if (statuses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Add statuses to see the workflow diagram
      </div>
    );
  }

  return (
    <ReactFlow
      key={`${statuses.length}-${transitions.length}`}
      nodes={nodes}
      edges={edges}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

// ─── Main page ──────────────────────────────────────────────────────
export default function StateMachinePage() {
  const [statuses, setStatuses] = useState<StatusDef[]>(DEFAULT_STATUSES);
  const [transitions, setTransitions] = useState<TransitionDef[]>(DEFAULT_TRANSITIONS);
  const [activeTab, setActiveTab] = useState<'states' | 'transitions'>('states');

  // ── New state form
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [newTerminal, setNewTerminal] = useState(false);

  // ── New transition form
  const [newFrom, setNewFrom] = useState<number>(0);
  const [newTo, setNewTo] = useState<number>(0);
  const [newActor, setNewActor] = useState<'BOT' | 'HUMAN' | 'ALL'>('BOT');

  const addStatus = useCallback(() => {
    if (!newLabel.trim()) return;
    const key = newLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const id = _nextStatusId++;
    setStatuses((prev) => [
      ...prev,
      { id, key, label: newLabel.trim(), color: newColor, is_terminal: newTerminal, is_default: false, position: prev.length },
    ]);
    setNewLabel('');
    setNewTerminal(false);
  }, [newLabel, newColor, newTerminal]);

  const removeStatus = useCallback((id: number) => {
    setStatuses((prev) => prev.filter((s) => s.id !== id));
    setTransitions((prev) => prev.filter((t) => t.from_status !== id && t.to_status !== id));
  }, []);

  const toggleDefault = useCallback((id: number) => {
    setStatuses((prev) => prev.map((s) => ({ ...s, is_default: s.id === id })));
  }, []);

  const addTransition = useCallback(() => {
    if (!newFrom || !newTo || newFrom === newTo) return;
    const id = _nextTransitionId++;
    setTransitions((prev) => [...prev, { id, from_status: newFrom, to_status: newTo, actor_type: newActor }]);
  }, [newFrom, newTo, newActor]);

  const removeTransition = useCallback((id: number) => {
    setTransitions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const statusMap = useMemo(() => Object.fromEntries(statuses.map((s) => [s.id, s])), [statuses]);

  const resetDefaults = useCallback(() => {
    setStatuses(DEFAULT_STATUSES);
    setTransitions(DEFAULT_TRANSITIONS);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">OW</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">OpenWeave</span>
          </div>
          <a
            href="https://openweave.dev"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            ← Back to OpenWeave
          </a>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            State Machine Builder
          </h1>
          <p className="mt-3 text-gray-500 text-base sm:text-lg leading-relaxed">
            Design your workflow visually. Define states, configure transitions, and control who — bot or human — can move tickets through your pipeline.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Diagram */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700">Live Workflow Diagram</h2>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block bg-purple-500 rounded" /> Bot</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block bg-blue-500 rounded" /> Human</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block bg-gray-400 rounded" /> All</span>
              <span className="hidden sm:flex items-center gap-1.5 ml-2 border-l border-gray-300 pl-3">⭐ Default &nbsp; <span className="border-2 border-double border-gray-400 rounded-xl px-1.5 text-[10px]">Terminal</span></span>
            </div>
          </div>
          <div className="h-[400px] sm:h-[450px]">
            <Diagram statuses={statuses} transitions={transitions} />
          </div>
        </div>

        {/* Config panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mobile tabs */}
          <div className="lg:hidden col-span-full flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setActiveTab('states')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'states' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'bg-white text-gray-500'}`}
            >
              States ({statuses.length})
            </button>
            <button
              onClick={() => setActiveTab('transitions')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === 'transitions' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'bg-white text-gray-500'}`}
            >
              Transitions ({transitions.length})
            </button>
          </div>

          {/* States panel */}
          <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${activeTab !== 'states' ? 'hidden lg:block' : ''}`}>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">States</h2>
              <button onClick={resetDefaults} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Reset defaults</button>
            </div>
            <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto">
              {statuses.map((s) => (
                <div key={s.id} className="flex items-center gap-2 group px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_HEX[s.color] || '#9ca3af' }} />
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{s.label}</span>
                  {s.is_default && <span className="text-amber-500 text-xs">⭐ default</span>}
                  {s.is_terminal && <span className="text-[10px] text-gray-400 border border-gray-300 rounded-full px-1.5">terminal</span>}
                  {!s.is_default && (
                    <button onClick={() => toggleDefault(s.id)} className="text-[10px] text-gray-300 hover:text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Set as default">⭐</button>
                  )}
                  <button onClick={() => removeStatus(s.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm" title="Remove">✕</button>
                </div>
              ))}
            </div>
            {/* Add state form */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="New state label..."
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addStatus()}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <select
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                >
                  {PALETTE.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                  <input type="checkbox" checked={newTerminal} onChange={(e) => setNewTerminal(e.target.checked)} className="rounded" />
                  Terminal
                </label>
                <button
                  onClick={addStatus}
                  disabled={!newLabel.trim()}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Transitions panel */}
          <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${activeTab !== 'transitions' ? 'hidden lg:block' : ''}`}>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-sm font-semibold text-gray-700">Transitions</h2>
            </div>
            <div className="p-4 space-y-2 max-h-[360px] overflow-y-auto">
              {transitions.map((t) => (
                <div key={t.id} className="flex items-center gap-2 group px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-800 flex-1 truncate">
                    <span className="font-medium">{statusMap[t.from_status]?.label || '?'}</span>
                    <span className="text-gray-400 mx-1.5">→</span>
                    <span className="font-medium">{statusMap[t.to_status]?.label || '?'}</span>
                  </span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ color: ACTOR_COLORS[t.actor_type], backgroundColor: `${ACTOR_COLORS[t.actor_type]}15` }}
                  >
                    {t.actor_type}
                  </span>
                  <button onClick={() => removeTransition(t.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm" title="Remove">✕</button>
                </div>
              ))}
              {transitions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No transitions yet</p>
              )}
            </div>
            {/* Add transition form */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30">
              <div className="flex gap-2 items-end">
                <select
                  value={newFrom}
                  onChange={(e) => setNewFrom(Number(e.target.value))}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                >
                  <option value={0}>From...</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <span className="text-gray-400 py-2">→</span>
                <select
                  value={newTo}
                  onChange={(e) => setNewTo(Number(e.target.value))}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                >
                  <option value={0}>To...</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <select
                  value={newActor}
                  onChange={(e) => setNewActor(e.target.value as 'BOT' | 'HUMAN' | 'ALL')}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                >
                  <option value="BOT">Bot</option>
                  <option value="HUMAN">Human</option>
                  <option value="ALL">All</option>
                </select>
                <button
                  onClick={addTransition}
                  disabled={!newFrom || !newTo || newFrom === newTo}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm mb-4">
            This is a demo. In OpenWeave, state machines are enforced in real-time with full audit trails.
          </p>
          <a
            href="https://openweave.dev"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium text-sm hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
          >
            Get started with OpenWeave →
          </a>
        </div>
      </div>
    </div>
  );
}
