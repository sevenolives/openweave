'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

type ThreadHealth = 'flowing' | 'slowing' | 'blocked' | 'completed' | 'idle';
type TicketStatus = 'done' | 'active' | 'queued' | 'blocked';

interface ToolCall {
  id: string;
  name: string;
  durationMs: number;
  status: 'success' | 'error' | 'pending';
  startedAtMs: number; // Unix ms
}

interface TicketContribution {
  threadId: string;
  role: string;
  status: TicketStatus;
}

interface Ticket {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  overallStatus: TicketStatus;
  contributors: TicketContribution[];
}

interface Thread {
  id: string;
  agentName: string;
  agentType: 'claude' | 'gpt' | 'human' | 'bot';
  task: string;
  health: ThreadHealth;
  startedAtMs: number;
  endedAtMs?: number;
  tokens: number;
  costUsd: number;
  contextPct: number;
  toolCalls: ToolCall[];
  messages: number;
  lastAction: string;
  yLane: number;
  interactsWith?: string[];
}

interface Phase {
  name: string;
  sprint: string;
  goal: string;
  totalTickets: number;
  doneTickets: number;
  daysLeft: number;
  dueDate: string;
}

const NOW = Date.now();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

const MOCK_PHASE: Phase = {
  name: 'Q2 Auth Overhaul',
  sprint: 'Sprint 3 of 4',
  goal: 'Complete compliance-grade auth rewrite, migrate all v1 endpoints to v2, and ship onboarding revamp',
  totalTickets: 34,
  doneTickets: 19,
  daysLeft: 4,
  dueDate: 'Apr 21',
};

const MOCK_THREADS: Thread[] = [
  {
    id: 'th-1',
    agentName: 'Atlas',
    agentType: 'claude',
    task: 'Refactor authentication middleware to meet compliance requirements',
    health: 'flowing',
    startedAtMs: NOW - 14 * MIN,
    tokens: 48200,
    costUsd: 0.38,
    contextPct: 61,
    messages: 23,
    lastAction: 'Writing unit tests for token rotation logic',
    yLane: 0,
    interactsWith: ['th-3'],
    toolCalls: [
      { id: 'tc-1', name: 'read_file', durationMs: 120, status: 'success', startedAtMs: NOW - 13.8 * MIN },
      { id: 'tc-2', name: 'bash', durationMs: 890, status: 'success', startedAtMs: NOW - 9.5 * MIN },
      { id: 'tc-3', name: 'edit_file', durationMs: 340, status: 'success', startedAtMs: NOW - 8 * MIN },
      { id: 'tc-4', name: 'bash', durationMs: 1200, status: 'success', startedAtMs: NOW - 5 * MIN },
      { id: 'tc-5', name: 'write_file', durationMs: 280, status: 'pending', startedAtMs: NOW - 2 * MIN },
    ],
  },
  {
    id: 'th-2',
    agentName: 'Iris',
    agentType: 'claude',
    task: 'Analyze Q1 user churn patterns and surface top 3 retention levers',
    health: 'flowing',
    startedAtMs: NOW - 8 * MIN,
    tokens: 31800,
    costUsd: 0.24,
    contextPct: 38,
    messages: 14,
    lastAction: 'Querying cohort data for March drop-off segment',
    yLane: 1,
    toolCalls: [
      { id: 'tc-6', name: 'web_search', durationMs: 2100, status: 'success', startedAtMs: NOW - 7 * MIN },
      { id: 'tc-7', name: 'bash', durationMs: 450, status: 'success', startedAtMs: NOW - 5 * MIN },
      { id: 'tc-8', name: 'bash', durationMs: 780, status: 'pending', startedAtMs: NOW - 3 * MIN },
    ],
  },
  {
    id: 'th-3',
    agentName: 'Sage',
    agentType: 'claude',
    task: 'Update API documentation for v2 endpoints after auth schema change',
    health: 'slowing',
    startedAtMs: NOW - 22 * MIN,
    tokens: 18400,
    costUsd: 0.14,
    contextPct: 22,
    messages: 9,
    lastAction: 'Waiting for Atlas to finalize token schema before continuing',
    yLane: 2,
    interactsWith: ['th-1'],
    toolCalls: [
      { id: 'tc-9', name: 'read_file', durationMs: 95, status: 'success', startedAtMs: NOW - 20 * MIN },
      { id: 'tc-10', name: 'web_fetch', durationMs: 1800, status: 'success', startedAtMs: NOW - 18 * MIN },
      { id: 'tc-11', name: 'edit_file', durationMs: 310, status: 'error', startedAtMs: NOW - 14 * MIN },
    ],
  },
  {
    id: 'th-4',
    agentName: 'Orion',
    agentType: 'gpt',
    task: 'Generate onboarding email sequence (5 emails, 14-day drip)',
    health: 'completed',
    startedAtMs: NOW - 41 * MIN,
    endedAtMs: NOW - 2 * MIN,
    tokens: 62100,
    costUsd: 0.52,
    contextPct: 0,
    messages: 31,
    lastAction: 'Completed — all 5 emails delivered to content team',
    yLane: 3,
    toolCalls: [
      { id: 'tc-12', name: 'web_search', durationMs: 1200, status: 'success', startedAtMs: NOW - 38 * MIN },
      { id: 'tc-13', name: 'write_file', durationMs: 890, status: 'success', startedAtMs: NOW - 30 * MIN },
      { id: 'tc-14', name: 'write_file', durationMs: 720, status: 'success', startedAtMs: NOW - 22 * MIN },
      { id: 'tc-15', name: 'write_file', durationMs: 680, status: 'success', startedAtMs: NOW - 15 * MIN },
      { id: 'tc-16', name: 'bash', durationMs: 340, status: 'success', startedAtMs: NOW - 5 * MIN },
    ],
  },
  {
    id: 'th-5',
    agentName: 'Lyra',
    agentType: 'claude',
    task: 'Review and triage 47 open GitHub issues — label, close duplicates, draft replies',
    health: 'blocked',
    startedAtMs: NOW - 5 * MIN,
    tokens: 9200,
    costUsd: 0.07,
    contextPct: 11,
    messages: 4,
    lastAction: 'Blocked — missing GitHub API token in environment',
    yLane: 4,
    toolCalls: [
      { id: 'tc-17', name: 'bash', durationMs: 230, status: 'error', startedAtMs: NOW - 4 * MIN },
    ],
  },
  {
    id: 'th-6',
    agentName: 'Dex',
    agentType: 'bot',
    task: 'Nightly: sync Stripe invoices → internal ledger, flag anomalies',
    health: 'blocked',
    startedAtMs: NOW - 3 * HOUR,
    tokens: 4100,
    costUsd: 0.03,
    contextPct: 5,
    messages: 2,
    lastAction: 'Blocked — Stripe API key revoked, 3 tasks cannot proceed',
    yLane: 5,
    toolCalls: [
      { id: 'tc-dex-1', name: 'bash', durationMs: 410, status: 'error', startedAtMs: NOW - 2.95 * HOUR },
    ],
  },
  {
    id: 'th-7',
    agentName: 'Nova',
    agentType: 'claude',
    task: 'Migrate legacy PostgreSQL views to Django ORM — zero downtime',
    health: 'flowing',
    startedAtMs: NOW - 31 * MIN,
    tokens: 71400,
    costUsd: 0.61,
    contextPct: 74,
    messages: 28,
    lastAction: 'Running migration tests against staging database',
    yLane: 6,
    toolCalls: [
      { id: 'tc-18', name: 'bash', durationMs: 3200, status: 'success', startedAtMs: NOW - 28 * MIN },
      { id: 'tc-19', name: 'read_file', durationMs: 180, status: 'success', startedAtMs: NOW - 23 * MIN },
      { id: 'tc-20', name: 'edit_file', durationMs: 420, status: 'success', startedAtMs: NOW - 19 * MIN },
      { id: 'tc-21', name: 'bash', durationMs: 5100, status: 'success', startedAtMs: NOW - 13 * MIN },
      { id: 'tc-22', name: 'bash', durationMs: 2800, status: 'pending', startedAtMs: NOW - 7 * MIN },
    ],
  },
];

const MOCK_TICKETS: Ticket[] = [
  { id: 'OW-116', title: 'Refactor auth middleware for compliance', priority: 'high', overallStatus: 'active', contributors: [{ threadId: 'th-1', role: 'implementing', status: 'active' }, { threadId: 'th-3', role: 'documenting', status: 'blocked' }, { threadId: 'th-5', role: 'reviewing', status: 'queued' }] },
  { id: 'OW-117', title: 'Write SDK migration guide for v1→v2', priority: 'high', overallStatus: 'active', contributors: [{ threadId: 'th-3', role: 'writing', status: 'active' }, { threadId: 'th-1', role: 'reviewing', status: 'queued' }] },
  { id: 'OW-103', title: 'Q1 churn analysis and retention levers', priority: 'high', overallStatus: 'active', contributors: [{ threadId: 'th-2', role: 'analyzing', status: 'active' }, { threadId: 'th-4', role: 'presenting', status: 'queued' }] },
  { id: 'OW-163', title: 'Migrate PostgreSQL views to Django ORM on staging', priority: 'high', overallStatus: 'active', contributors: [{ threadId: 'th-7', role: 'implementing', status: 'active' }, { threadId: 'th-1', role: 'reviewing', status: 'queued' }] },
  { id: 'OW-114', title: 'Audit session token storage for GDPR', priority: 'high', overallStatus: 'done', contributors: [{ threadId: 'th-1', role: 'implementing', status: 'done' }, { threadId: 'th-5', role: 'reviewing', status: 'done' }] },
  { id: 'OW-130', title: 'Research onboarding email best practices', priority: 'medium', overallStatus: 'done', contributors: [{ threadId: 'th-4', role: 'researching', status: 'done' }, { threadId: 'th-2', role: 'reviewing', status: 'done' }] },
  { id: 'OW-132', title: 'Write 14-day drip sequence (5 emails)', priority: 'high', overallStatus: 'done', contributors: [{ threadId: 'th-4', role: 'writing', status: 'done' }] },
  { id: 'OW-150', title: 'Nightly Stripe → ledger sync', priority: 'high', overallStatus: 'blocked', contributors: [{ threadId: 'th-6', role: 'running', status: 'blocked' }] },
  { id: 'OW-151', title: 'Reconcile failed charges Apr 14–16', priority: 'high', overallStatus: 'blocked', contributors: [{ threadId: 'th-6', role: 'running', status: 'blocked' }, { threadId: 'th-2', role: 'validating', status: 'queued' }] },
  { id: 'OW-152', title: 'Flag revenue anomalies > 2σ and draft alert', priority: 'medium', overallStatus: 'blocked', contributors: [{ threadId: 'th-6', role: 'running', status: 'blocked' }] },
  { id: 'OW-140', title: 'Triage 47 open GitHub issues', priority: 'high', overallStatus: 'blocked', contributors: [{ threadId: 'th-5', role: 'triaging', status: 'blocked' }] },
  { id: 'OW-160', title: 'Audit all legacy PostgreSQL views', priority: 'high', overallStatus: 'done', contributors: [{ threadId: 'th-7', role: 'auditing', status: 'done' }, { threadId: 'th-1', role: 'reviewing', status: 'done' }] },
  { id: 'OW-161', title: 'Map views to Django ORM equivalents', priority: 'high', overallStatus: 'done', contributors: [{ threadId: 'th-7', role: 'implementing', status: 'done' }] },
];

const HEALTH_COLORS: Record<ThreadHealth, { stroke: string; glow: string; badge: string; label: string }> = {
  flowing:   { stroke: '#22c55e', glow: '#22c55e40', badge: 'bg-green-500/20 text-green-400 border-green-500/30',  label: 'Flowing' },
  slowing:   { stroke: '#f59e0b', glow: '#f59e0b40', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',  label: 'Slowing' },
  blocked:   { stroke: '#ef4444', glow: '#ef444440', badge: 'bg-red-500/20 text-red-400 border-red-500/30',        label: 'Blocked' },
  completed: { stroke: '#6366f1', glow: '#6366f140', badge: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', label: 'Done' },
  idle:      { stroke: '#374151', glow: '#37415140', badge: 'bg-gray-700/40 text-gray-500 border-gray-600/30',     label: 'Idle' },
};

const AGENT_TYPE_COLORS: Record<string, string> = {
  claude: '#6366f1',
  gpt:    '#10b981',
  human:  '#f59e0b',
  bot:    '#64748b',
};

const LANE_HEIGHT = 80;
const PADDING_TOP = 60;
const PADDING_RIGHT = 40;

function getPaddingLeft(svgWidth: number) {
  if (svgWidth < 480) return 72;
  if (svgWidth < 768) return 110;
  return 180;
}

function formatTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatMinsAgo(ms: number) {
  const diff = NOW - ms;
  const mins = Math.round(diff / MIN);
  return mins === 0 ? 'now' : `${mins}m ago`;
}

function getThreadY(lane: number) {
  return PADDING_TOP + lane * LANE_HEIGHT;
}

function buildThreadPath(thread: Thread, startX: number, endX: number, y: number): string {
  const waveAmp = 4;
  const wf = thread.yLane % 2 === 0 ? 1 : -1;
  const cp1x = startX + (endX - startX) * 0.33;
  const cp1y = y + waveAmp * wf;
  const cp2x = startX + (endX - startX) * 0.66;
  const cp2y = y - waveAmp * wf;
  return `M ${startX} ${y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${y}`;
}

function HealthBadge({ health }: { health: ThreadHealth }) {
  const c = HEALTH_COLORS[health];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${health === 'flowing' || health === 'slowing' ? 'animate-pulse' : ''}`} style={{ backgroundColor: c.stroke }} />
      {c.label}
    </span>
  );
}

function AgentAvatar({ thread, size = 28 }: { thread: Thread; size?: number }) {
  const color = AGENT_TYPE_COLORS[thread.agentType];
  const initials = thread.agentName.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center justify-center rounded-full text-white font-bold shrink-0" style={{ width: size, height: size, backgroundColor: color + '33', border: `1.5px solid ${color}`, fontSize: size * 0.36, color }}>
      {initials}
    </div>
  );
}

function ThreadDetailPanel({ thread, onClose }: { thread: Thread; onClose: () => void }) {
  const hc = HEALTH_COLORS[thread.health];
  const color = AGENT_TYPE_COLORS[thread.agentType];
  const timeline = [...thread.toolCalls].sort((a, b) => a.startedAtMs - b.startedAtMs);
  const agentTickets = MOCK_TICKETS.filter(t => t.contributors.some(c => c.threadId === thread.id));
  const done = agentTickets.filter(t => t.contributors.find(c => c.threadId === thread.id)?.status === 'done').length;
  const total = agentTickets.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="fixed z-50 flex flex-col bottom-0 left-0 right-0 max-h-[80dvh] rounded-t-2xl sm:bottom-auto sm:right-0 sm:top-0 sm:left-auto sm:w-[420px] sm:max-h-full sm:h-full sm:rounded-none" style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%)', borderTop: '1px solid #222233', borderLeft: '1px solid #222233', boxShadow: '-20px 0 60px #00000080' }}>
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#222233]">
        <div className="flex items-center gap-3">
          <AgentAvatar thread={thread} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-base">{thread.agentName}</span>
              <HealthBadge health={thread.health} />
            </div>
            <div className="text-gray-500 text-xs mt-0.5">{thread.agentType} agent · started {formatMinsAgo(thread.startedAtMs)}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-6 py-3 border-b border-[#1a1a2e]">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Active Task</div>
        <p className="text-gray-200 text-sm leading-relaxed">{thread.task}</p>
        <div className="mt-2 text-xs text-gray-400 italic">{thread.lastAction}</div>
      </div>
      <div className="px-6 py-3 border-b border-[#1a1a2e]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Shared Work <span className="text-gray-400 normal-case ml-1">{done}/{total} done</span></div>
          <span className="text-xs font-semibold" style={{ color: hc.stroke }}>{pct}%</span>
        </div>
        <div className="h-1 bg-[#1a1a2e] rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: hc.stroke }} />
        </div>
        <div className="space-y-1.5">
          {agentTickets.map(ticket => {
            const myContrib = ticket.contributors.find(c => c.threadId === thread.id)!;
            return (
              <div key={ticket.id} className="mb-3">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: myContrib.status === 'done' ? '#22c55e' : hc.stroke }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-200 leading-snug">{ticket.title}</span>
                    <div className="text-xs mt-0.5" style={{ color: color + 'aa' }}>{myContrib.role}</div>
                  </div>
                  <span className="text-xs text-gray-700 font-mono shrink-0">{ticket.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-[#1a1a2e] border-b border-[#1a1a2e]">
        {[{ label: 'Tokens', value: thread.tokens >= 1000 ? `${(thread.tokens / 1000).toFixed(1)}k` : thread.tokens }, { label: 'Cost', value: `$${thread.costUsd.toFixed(2)}` }, { label: 'Context', value: `${thread.contextPct}%` }].map(m => (
          <div key={m.label} className="bg-[#0a0a0f] px-4 py-3 text-center">
            <div className="text-white font-semibold text-sm">{m.value}</div>
            <div className="text-gray-600 text-xs mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Tool Calls ({thread.toolCalls.length})</div>
        <div className="space-y-2">
          {timeline.map((tc) => {
            const dot = tc.status === 'success' ? '#22c55e' : tc.status === 'error' ? '#ef4444' : '#f59e0b';
            const bg = tc.status === 'success' ? 'bg-green-500/5' : tc.status === 'error' ? 'bg-red-500/5' : 'bg-amber-500/5';
            const label = tc.status === 'success' ? 'success' : tc.status === 'error' ? 'failed' : 'running';
            return (
              <div key={tc.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${bg} border border-[#1a1a2e]`}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 text-xs font-mono">{tc.name}</div>
                  <div className="text-gray-600 text-xs">{tc.durationMs}ms · {label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LoomCanvas({ threads, selectedId, onSelectThread, hoveredId, onHoverThread, viewStartMs, viewDurationMs }: { threads: Thread[]; selectedId: string | null; onSelectThread: (id: string) => void; hoveredId: string | null; onHoverThread: (id: string | null) => void; viewStartMs: number; viewDurationMs: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 700 });

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDims({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const pl = getPaddingLeft(dims.width);
  const usableWidth = dims.width - pl - PADDING_RIGHT;
  const tsToX = (ts: number) => pl + ((ts - viewStartMs) / viewDurationMs) * usableWidth;
  const svgHeight = PADDING_TOP * 2 + threads.length * LANE_HEIGHT;
  const viewEndMs = viewStartMs + viewDurationMs;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-auto">
      <svg width={dims.width} height={svgHeight} style={{ cursor: 'default' }}>
        <defs>
          {threads.map(t => {
            const hc = HEALTH_COLORS[t.health];
            return (
              <filter key={`glow-${t.id}`} id={`glow-${t.id}`} x="-50%" y="-400%" width="200%" height="900%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            );
          })}
        </defs>

        {/* Time grid */}
        {(() => {
          const tickIntervalMs = viewDurationMs <= 90 * MIN ? 10 * MIN : viewDurationMs <= 6 * HOUR ? 1 * HOUR : 4 * HOUR;
          const ticks: number[] = [];
          let t = Math.ceil(viewStartMs / tickIntervalMs) * tickIntervalMs;
          while (t <= viewEndMs) {
            ticks.push(t);
            t += tickIntervalMs;
          }
          return (
            <>
              {ticks.map(tick => {
                const x = tsToX(tick);
                return (
                  <g key={tick}>
                    <line x1={x} y1={PADDING_TOP - 20} x2={x} y2={svgHeight - 20} stroke="#1a1a2e" strokeWidth={1} strokeDasharray="4,6" />
                    <text x={x} y={PADDING_TOP - 26} textAnchor="middle" fill="#666688" fontSize={10} fontFamily="Inter, sans-serif">
                      {formatTime(tick)}
                    </text>
                  </g>
                );
              })}
              <line x1={tsToX(NOW)} y1={PADDING_TOP - 20} x2={tsToX(NOW)} y2={svgHeight - 20} stroke="#22c55e" strokeWidth={1.5} />
              <text x={tsToX(NOW)} y={PADDING_TOP - 26} textAnchor="middle" fill="#22c55e" fontSize={10} fontFamily="Inter, sans-serif" fontWeight="bold">
                now
              </text>
            </>
          );
        })()}

        {/* Threads */}
        {threads.map(thread => {
          const startX = Math.max(pl, tsToX(thread.startedAtMs));
          const endX = Math.min(dims.width - PADDING_RIGHT, tsToX(thread.endedAtMs || NOW));
          if (endX <= pl || startX >= dims.width - PADDING_RIGHT) return null;

          const hc = HEALTH_COLORS[thread.health];
          const isSelected = selectedId === thread.id;
          const isHovered = hoveredId === thread.id;
          const isDimmed = (selectedId || hoveredId) && !isSelected && !isHovered;
          const opacity = isDimmed ? 0.2 : 1;
          const y = getThreadY(thread.yLane);
          const strokeWidth = isSelected || isHovered ? 2.5 : 1.8;
          const path = buildThreadPath(thread, startX, endX, y);

          return (
            <g key={thread.id} style={{ opacity, transition: 'opacity 0.2s ease' }}>
              <path d={path} fill="none" stroke={hc.stroke} strokeWidth={strokeWidth + 4} opacity={isSelected || isHovered ? 0.18 : 0.08} strokeLinecap="round" />
              <path d={path} fill="none" stroke={hc.stroke} strokeWidth={strokeWidth} strokeLinecap="round" style={{ filter: isSelected || isHovered ? `url(#glow-${thread.id})` : undefined, cursor: 'pointer', transition: 'stroke-width 0.15s ease' }} onClick={() => onSelectThread(thread.id)} onMouseEnter={() => onHoverThread(thread.id)} onMouseLeave={() => onHoverThread(null)} />
              <path d={path} fill="none" stroke="transparent" strokeWidth={20} style={{ cursor: 'pointer' }} onClick={() => onSelectThread(thread.id)} onMouseEnter={() => onHoverThread(thread.id)} onMouseLeave={() => onHoverThread(null)} />

              {/* Tool call dots */}
              {thread.toolCalls.filter(tc => tc.startedAtMs >= viewStartMs && tc.startedAtMs <= viewEndMs).map(tc => {
                const tcX = tsToX(tc.startedAtMs);
                const tcStatus = tc.status === 'success' ? '#22c55e' : tc.status === 'error' ? '#ef4444' : '#f59e0b';
                return (
                  <g key={tc.id} transform={`translate(${tcX}, ${y})`}>
                    <circle r={5} fill={hc.stroke + '22'} stroke={tcStatus} strokeWidth={1.5} />
                    <circle r={2} fill={tcStatus} />
                  </g>
                );
              })}

              {/* Status indicator at end */}
              {thread.health === 'completed' ? (
                <g transform={`translate(${endX}, ${y})`}>
                  <circle r={7} fill="#6366f133" stroke="#6366f1" strokeWidth={1.5} />
                  <path d="M -3 0 L -1 2 L 3.5 -2" stroke="#6366f1" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              ) : (
                <g transform={`translate(${endX}, ${y})`}>
                  <circle r={6} fill={hc.stroke} opacity={0.15}>
                    <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle r={4} fill={hc.stroke} opacity={0.9} />
                  <circle r={2} fill="white" opacity={0.8} />
                </g>
              )}

              {/* Lane label */}
              {(() => {
                const tickets = MOCK_TICKETS.filter(t => t.contributors.some(c => c.threadId === thread.id));
                const done = tickets.filter(t => t.contributors.find(c => c.threadId === thread.id)?.status === 'done').length;
                const total = tickets.length;
                return (
                  <g style={{ cursor: 'pointer' }} onClick={() => onSelectThread(thread.id)} onMouseEnter={() => onHoverThread(thread.id)} onMouseLeave={() => onHoverThread(null)}>
                    <rect x={2} y={y - 16} width={pl - 8} height={32} rx={6} fill={isSelected || isHovered ? '#1a1a2e' : 'transparent'} style={{ transition: 'fill 0.15s ease' }} />
                    <text x={pl - 10} y={y - 5} textAnchor="end" fill={isSelected || isHovered ? '#e5e7eb' : '#6b7280'} fontSize={11} fontWeight={isSelected || isHovered ? '600' : '400'} fontFamily="Inter, sans-serif" style={{ transition: 'fill 0.15s ease' }}>
                      {thread.agentName}
                    </text>
                    <text x={pl - 10} y={y + 8} textAnchor="end" fill={isSelected || isHovered ? '#9ca3af' : '#374151'} fontSize={9} fontFamily="Inter, sans-serif" style={{ transition: 'fill 0.15s ease' }}>
                      {done}/{total}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
      {!selectedId && <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-700 pointer-events-none">↑ Click a thread to zoom in</div>}
    </div>
  );
}

function PhaseGoalBar({ phase, threads }: { phase: Phase; threads: Thread[] }) {
  const pct = Math.round((phase.doneTickets / phase.totalTickets) * 100);
  const remaining = phase.totalTickets - phase.doneTickets;
  const blockedCount = threads.filter(t => t.health === 'blocked').length;
  const isAtRisk = blockedCount > 0 && phase.daysLeft <= 5;
  return (
    <div className="px-4 sm:px-6 py-2.5 border-b shrink-0" style={{ borderColor: isAtRisk ? '#7c2d1233' : '#1a1a2e', background: isAtRisk ? '#7c2d1208' : 'transparent' }}>
      <div className="flex items-center gap-3 sm:gap-6 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          <span className="text-white text-xs font-semibold truncate">{phase.name}</span>
          <span className="text-gray-600 text-xs hidden sm:inline">·</span>
          <span className="text-gray-600 text-xs hidden sm:inline">{phase.sprint}</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
          <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: isAtRisk ? 'linear-gradient(90deg, #6366f1, #f59e0b)' : 'linear-gradient(90deg, #6366f1, #22c55e)' }} />
          </div>
          <span className="text-xs font-semibold text-gray-300 shrink-0">{pct}%</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
          <span><span className="text-green-400 font-medium">{phase.doneTickets}</span> done</span>
          <span className="text-gray-700">·</span>
          <span><span className="text-gray-300 font-medium">{remaining}</span> left</span>
          {blockedCount > 0 && <>
            <span className="text-gray-700">·</span>
            <span className="text-red-400 font-medium">{blockedCount} blocked</span>
          </>}
        </div>
        <div className={`flex items-center gap-1.5 text-xs shrink-0 ${isAtRisk ? 'text-amber-400' : 'text-gray-600'}`}>
          {isAtRisk && <span>⚠</span>}
          <span>Due {phase.dueDate}</span>
          <span className="text-gray-700">·</span>
          <span className={`font-medium ${phase.daysLeft <= 2 ? 'text-red-400' : isAtRisk ? 'text-amber-400' : 'text-gray-400'}`}>
            {phase.daysLeft}d left
          </span>
        </div>
      </div>
    </div>
  );
}

function SystemHealthBar({ threads }: { threads: Thread[] }) {
  const total = threads.length;
  const counts = { flowing: threads.filter(t => t.health === 'flowing').length, slowing: threads.filter(t => t.health === 'slowing').length, blocked: threads.filter(t => t.health === 'blocked').length, completed: threads.filter(t => t.health === 'completed').length, idle: threads.filter(t => t.health === 'idle').length };
  const totalCost = threads.reduce((s, t) => s + t.costUsd, 0);
  const totalTokens = threads.reduce((s, t) => s + t.tokens, 0);
  const active = threads.filter(t => t.health === 'flowing' || t.health === 'slowing').length;
  return (
    <div className="flex items-center gap-3 sm:gap-6 px-4 sm:px-6 py-2 sm:py-3 border-b border-[#1a1a2e] bg-[#0a0a0f]/80 backdrop-blur-sm">
      <div className="flex items-center gap-1 flex-1 flex-wrap">
        {Object.entries(counts).map(([health, count]) => {
          if (count === 0) return null;
          const hc = HEALTH_COLORS[health as ThreadHealth];
          return (
            <div key={health} className="flex items-center gap-1 mr-2 sm:mr-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${health === 'flowing' ? 'animate-pulse' : ''}`} style={{ backgroundColor: hc.stroke }} />
              <span className="text-xs text-gray-500">{count} <span className="hidden sm:inline">{hc.label.toLowerCase()}</span></span>
            </div>
          );
        })}
      </div>
      <div className="hidden sm:flex items-center gap-4 sm:gap-6 text-xs text-gray-500">
        <div><span className="text-gray-300 font-medium">{active}</span> active</div>
        <div><span className="text-gray-300 font-medium">{totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}</span> tokens</div>
        <div><span className="text-gray-300 font-medium">${totalCost.toFixed(2)}</span> cost</div>
      </div>
      <div className="w-16 sm:w-32 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden flex shrink-0">
        {Object.entries(counts).map(([health, count]) => {
          if (count === 0) return null;
          return <div key={health} style={{ width: `${(count / total) * 100}%`, backgroundColor: HEALTH_COLORS[health as ThreadHealth].stroke }} />;
        })}
      </div>
    </div>
  );
}

export default function LoomPage() {
  const [viewDurationMs, setViewDurationMs] = useState(90 * MIN);
  const [viewEndMs, setViewEndMs] = useState(NOW);
  const viewStartMs = viewEndMs - viewDurationMs;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const selectedThread = selectedId ? MOCK_THREADS.find(t => t.id === selectedId) ?? null : null;

  const handleZoom = (durationMs: number) => {
    setViewEndMs(NOW);
    setViewDurationMs(durationMs);
  };

  const handlePan = (direction: 'left' | 'right') => {
    const shift = viewDurationMs * 0.2;
    if (direction === 'left') {
      setViewEndMs(prev => prev - shift);
    } else {
      setViewEndMs(prev => Math.min(NOW, prev + shift));
    }
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--background)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#1a1a2e] shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M2 12 Q6 6 12 12 Q18 18 22 12" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M2 8 Q6 4 12 8 Q18 12 22 8" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M2 16 Q6 12 12 16 Q18 20 22 16" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
          </svg>
          <span className="text-white font-semibold text-sm tracking-tight">Loom v2</span>
          <span className="text-gray-700 text-xs hidden sm:inline">·</span>
          <span className="text-gray-600 text-xs hidden sm:inline">Agent Activity River</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="hidden sm:inline">Live</span>
          </div>
          <div className="text-xs text-gray-700 border border-[#222233] rounded-lg px-2 sm:px-3 py-1.5 hidden sm:block">
            OpenWeave · demo-workspace
          </div>
        </div>
      </div>

      <PhaseGoalBar phase={MOCK_PHASE} threads={MOCK_THREADS} />
      <SystemHealthBar threads={MOCK_THREADS} />

      <div className="flex items-center gap-2 px-4 sm:px-6 py-2 border-b border-[#1a1a2e] shrink-0 bg-[#06060c]">
        <span className="text-xs text-gray-700 uppercase tracking-wider shrink-0">Zoom</span>
        <div className="flex gap-1">
          {[
            { label: '1h', ms: 1 * HOUR },
            { label: '6h', ms: 6 * HOUR },
            { label: '24h', ms: 24 * HOUR },
          ].map(z => (
            <button
              key={z.label}
              onClick={() => handleZoom(z.ms)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewDurationMs === z.ms
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-700 uppercase tracking-wider shrink-0 ml-4">Pan</span>
        <div className="flex gap-1">
          <button onClick={() => handlePan('left')} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 border border-[#333355] rounded">← Earlier</button>
          <button onClick={() => handlePan('right')} disabled={viewEndMs >= NOW} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 border border-[#333355] rounded disabled:opacity-40">Later →</button>
        </div>
        {viewEndMs < NOW && (
          <button onClick={() => setViewEndMs(NOW)} className="ml-auto px-2 py-1 text-xs text-green-400 border border-green-500/30 bg-green-500/10 rounded hover:bg-green-500/20">
            ↓ Jump to now
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <LoomCanvas threads={MOCK_THREADS} selectedId={selectedId} onSelectThread={id => setSelectedId(prev => prev === id ? null : id)} hoveredId={hoveredId} onHoverThread={setHoveredId} viewStartMs={viewStartMs} viewDurationMs={viewDurationMs} />
      </div>

      {selectedThread && <ThreadDetailPanel thread={selectedThread} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
