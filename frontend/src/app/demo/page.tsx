'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
/*  State Machine (reused from /state-machine)                         */
/* ------------------------------------------------------------------ */

type ColorName = 'gray' | 'blue' | 'red' | 'purple' | 'amber' | 'green' | 'yellow' | 'indigo' | 'pink' | 'orange';

const COLORS: Record<ColorName, string> = {
  gray: '#9ca3af', blue: '#3b82f6', red: '#ef4444', purple: '#a855f7',
  amber: '#f59e0b', green: '#22c55e', yellow: '#eab308', indigo: '#6366f1',
  pink: '#ec4899', orange: '#f97316',
};

const ACTOR_COLORS: Record<string, string> = {
  BOT: '#a855f7', HUMAN: '#3b82f6', ALL: '#6b7280',
};

interface WState { id: number; key: string; label: string; color: ColorName; is_terminal: boolean; is_default: boolean; is_bot_requires_approval: boolean; pos: number; }
interface Trans { id: number; from: number; to: number; actor: string; }

const STATES: WState[] = [
  { id: 1, key: 'OPEN', label: 'Open', color: 'gray', is_terminal: false, is_default: true, is_bot_requires_approval: false, pos: 0 },
  { id: 2, key: 'IN_SPEC', label: 'In Spec', color: 'blue', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 1 },
  { id: 3, key: 'IN_DEV', label: 'In Dev', color: 'indigo', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 2 },
  { id: 4, key: 'IN_TESTING', label: 'In Testing', color: 'purple', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 3 },
  { id: 5, key: 'REVIEW', label: 'Review', color: 'amber', is_terminal: false, is_default: false, is_bot_requires_approval: false, pos: 4 },
  { id: 6, key: 'COMPLETED', label: 'Completed', color: 'green', is_terminal: true, is_default: false, is_bot_requires_approval: true, pos: 5 },
];

const TRANSITIONS: Trans[] = [
  { id: 1, from: 1, to: 2, actor: 'BOT' },
  { id: 2, from: 2, to: 3, actor: 'BOT' },
  { id: 3, from: 3, to: 4, actor: 'BOT' },
  { id: 4, from: 4, to: 5, actor: 'BOT' },
  { id: 5, from: 5, to: 6, actor: 'HUMAN' },
  { id: 6, from: 5, to: 3, actor: 'BOT' },
];

function buildNodes(states: WState[], transitions: Trans[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));
  states.forEach((s) => g.setNode(String(s.id), { width: 120, height: 40 }));
  transitions.forEach((t) => g.setEdge(String(t.from), String(t.to)));
  dagre.layout(g);
  return states.map((s) => {
    const nd = g.node(String(s.id));
    const color = COLORS[s.color] || '#9ca3af';
    return {
      id: String(s.id),
      position: { x: (nd?.x ?? 0) - 60, y: (nd?.y ?? 0) - 20 },
      data: { label: s.is_bot_requires_approval ? `🔒 ${s.label}` : s.label },
      type: 'default',
      style: {
        background: 'white', border: `2px solid ${color}`,
        borderRadius: s.is_terminal ? '20px' : '8px',
        padding: '6px 12px', fontSize: '12px', fontWeight: 600,
        color: '#1f2937',
        boxShadow: s.is_default ? `0 0 0 3px ${color}44` : '0 1px 4px rgba(0,0,0,0.1)',
        minWidth: '90px', textAlign: 'center' as const,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}

function buildEdges(transitions: Trans[], states: WState[]): Edge[] {
  return transitions.map((t) => {
    const target = states.find((s) => s.id === t.to);
    const isGated = (t.actor === 'BOT' || t.actor === 'ALL') && target?.is_bot_requires_approval;
    const color = isGated ? '#eab308' : ACTOR_COLORS[t.actor];
    return {
      id: `e${t.id}`, source: String(t.from), target: String(t.to),
      animated: t.actor === 'BOT' && !isGated,
      style: { stroke: color, strokeWidth: 2, strokeDasharray: t.actor === 'HUMAN' ? '5,5' : isGated ? '8,4' : 'none' },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      label: isGated ? `${t.actor} 🔒` : t.actor,
      labelStyle: { fontSize: 9, fontWeight: 700, fill: color },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_STATS = [
  { label: 'Active Tickets', value: 12, icon: '🎫', color: '#6366f1' },
  { label: 'Agents Online', value: 3, icon: '🤖', color: '#22c55e' },
  { label: 'Projects', value: 2, icon: '📁', color: '#f59e0b' },
];

const KANBAN_COLS = [
  { title: 'Open', color: '#9ca3af', tickets: [
    { id: 'OW-7', title: 'Add rate limiting to webhook endpoint', tag: 'backend' },
    { id: 'OW-12', title: 'Update onboarding email copy', tag: 'content' },
  ]},
  { title: 'In Spec', color: '#3b82f6', tickets: [
    { id: 'OW-9', title: 'Design multi-tenant billing page', tag: 'design' },
  ]},
  { title: 'In Dev', color: '#6366f1', tickets: [
    { id: 'OW-3', title: 'Implement SSO with SAML provider', tag: 'backend' },
    { id: 'OW-5', title: 'Fix timezone bug in scheduler', tag: 'bug' },
  ]},
  { title: 'In Testing', color: '#a855f7', tickets: [
    { id: 'OW-2', title: 'Migrate user table to new schema', tag: 'database' },
  ]},
  { title: 'Review', color: '#f59e0b', tickets: [
    { id: 'OW-1', title: 'State machine transition validation', tag: 'core' },
  ]},
  { title: 'Completed', color: '#22c55e', tickets: [
    { id: 'OW-4', title: 'Set up CI/CD pipeline', tag: 'devops' },
    { id: 'OW-6', title: 'Add audit log export endpoint', tag: 'backend' },
    { id: 'OW-8', title: 'Write API documentation', tag: 'docs' },
  ]},
];

const APPROVAL_STEPS = [
  { icon: '🤖', label: 'Bot requests to move OW-1 to Completed', detail: 'Agent "deploy-bot" triggered transition', color: '#a855f7' },
  { icon: '⏳', label: 'Waiting for human approval', detail: 'State "Completed" requires human sign-off', color: '#f59e0b' },
  { icon: '✅', label: 'Approved by @wren', detail: 'Transition authorized — ticket moved to Completed', color: '#22c55e' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DemoPage() {
  const nodes = useMemo(() => buildNodes(STATES, TRANSITIONS), []);
  const edges = useMemo(() => buildEdges(TRANSITIONS, STATES), []);

  const [approvalStep, setApprovalStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setApprovalStep((s) => (s + 1) % 4); // 0,1,2 = steps, 3 = pause
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: '#0a0a0a', color: '#e5e7eb', minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Live Preview</p>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: 'white', marginBottom: 12, lineHeight: 1.1 }}>See OpenWeave in Action</h1>
        <p style={{ fontSize: 'clamp(14px, 3vw, 17px)', color: '#9ca3af', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
          Explore what a governed AI workspace looks like — no signup required.
        </p>
      </div>

      {/* Section 1: Dashboard Stats */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 16px' }}>
        <h2 style={{ fontSize: 13, fontFamily: 'monospace', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Dashboard Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {MOCK_STATS.map((s) => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <span style={{ fontSize: 32 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Kanban Board */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 16px' }}>
        <h2 style={{ fontSize: 13, fontFamily: 'monospace', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Ticket Board</h2>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 900 }}>
            {KANBAN_COLS.map((col) => (
              <div key={col.title} style={{
                flex: 1, minWidth: 140, background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>{col.title}</span>
                  <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>{col.tickets.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.tickets.map((t) => (
                    <div key={t.id} style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8, padding: '10px 12px',
                    }}>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#818cf8', marginBottom: 4 }}>{t.id}</div>
                      <div style={{ fontSize: 13, color: '#e5e7eb', lineHeight: 1.4 }}>{t.title}</div>
                      <div style={{ marginTop: 6 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4,
                          background: 'rgba(99,102,241,0.15)', color: '#a5b4fc',
                        }}>{t.tag}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: State Machine Diagram */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 16px' }}>
        <h2 style={{ fontSize: 13, fontFamily: 'monospace', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Workflow State Machine</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Interactive — drag, zoom, and explore the transition graph.</p>
        <div style={{
          height: 340, width: '100%', borderRadius: 12, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        }}>
          <ReactFlow
            nodes={nodes} edges={edges} fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
            nodesDraggable={true} nodesConnectable={false} elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
            minZoom={0.3} maxZoom={2}
          >
            <Background gap={20} size={1} color="#cbd5e1" />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
          <span>🤖 <span style={{ color: '#a855f7' }}>Bot (animated)</span></span>
          <span>👤 <span style={{ color: '#3b82f6' }}>Human (dashed)</span></span>
          <span>🔒 <span style={{ color: '#eab308' }}>Approval gate</span></span>
        </div>
      </div>

      {/* Section 4: Approval Gate */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 16px' }}>
        <h2 style={{ fontSize: 13, fontFamily: 'monospace', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Approval Gate in Action</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Bots request, humans approve. No exceptions.</p>
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '24px 20px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {APPROVAL_STEPS.map((step, i) => {
              const active = approvalStep > i || (approvalStep === 3 && i <= 2);
              const current = approvalStep === i;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px',
                  borderRadius: 10, transition: 'all 0.5s ease',
                  background: current ? `${step.color}11` : active ? 'rgba(255,255,255,0.02)' : 'transparent',
                  border: current ? `1px solid ${step.color}44` : '1px solid transparent',
                  opacity: active || current ? 1 : 0.35,
                  transform: current ? 'scale(1.01)' : 'scale(1)',
                }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{step.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: active || current ? '#e5e7eb' : '#6b7280' }}>{step.label}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{step.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 5: CTA */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 80px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700, color: 'white', marginBottom: 12 }}>Ready to try it?</h2>
        <p style={{ fontSize: 16, color: '#9ca3af', marginBottom: 32, maxWidth: 480, margin: '0 auto 32px' }}>
          Create a workspace, invite your agents, and govern their execution — in minutes.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/login" style={{
            display: 'inline-flex', alignItems: 'center', padding: '14px 32px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
            color: 'white', fontWeight: 600, fontSize: 15, borderRadius: 10,
            textDecoration: 'none', boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
            transition: 'all 0.2s ease',
          }}>Sign Up Free →</a>
          <a href="/state-machine" style={{
            display: 'inline-flex', alignItems: 'center', padding: '14px 32px',
            border: '1px solid rgba(255,255,255,0.15)', color: '#d1d5db',
            fontWeight: 600, fontSize: 15, borderRadius: 10, textDecoration: 'none',
            transition: 'all 0.2s ease',
          }}>Try State Machine Builder</a>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#4b5563' }}>© {new Date().getFullYear()} OpenWeave — Execution Governance for Autonomous Systems</p>
      </div>
    </div>
  );
}
