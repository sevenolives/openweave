'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ThreadHealth = 'flowing' | 'slowing' | 'blocked' | 'completed' | 'idle';
type TicketStatus = 'done' | 'active' | 'queued' | 'blocked';

interface ToolCall {
  id: string;
  name: string;
  durationMs: number;
  status: 'success' | 'error' | 'pending';
  at: number; // 0-1 position along thread
}

interface TicketContribution {
  threadId: string;
  role: string;         // e.g. 'implementing' | 'reviewing' | 'documenting' | 'testing' | 'scheduled'
  status: TicketStatus; // this agent's status on this ticket
}

interface Ticket {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  overallStatus: TicketStatus;   // the ticket's overall status (blocked if any contributor is blocked)
  contributors: TicketContribution[];
}

interface Thread {
  id: string;
  agentName: string;
  agentType: 'claude' | 'gpt' | 'human' | 'bot';
  task: string;
  health: ThreadHealth;
  progress: number;       // 0-1, how far through current task
  startedAt: string;
  tokens: number;
  costUsd: number;
  contextPct: number;
  toolCalls: ToolCall[];
  messages: number;
  lastAction: string;
  yLane: number;
  interactsWith?: string[];
}

interface Intersection {
  threadAId: string;
  threadBId: string;
  atX: number;
  type: 'dependency' | 'conflict' | 'collaboration';
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

// ─── Snapshot types ───────────────────────────────────────────────────────────

interface SnapshotDef {
  label: string;
  shortLabel: string;
  phase: Phase;
  threadOverrides: Record<string, Partial<Thread>>;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

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
    progress: 0.72,
    startedAt: '14 min ago',
    tokens: 48200,
    costUsd: 0.38,
    contextPct: 61,
    messages: 23,
    lastAction: 'Writing unit tests for token rotation logic',
    yLane: 0,
    interactsWith: ['th-3'],
    toolCalls: [
      { id: 'tc-1', name: 'read_file', durationMs: 120, status: 'success', at: 0.1 },
      { id: 'tc-2', name: 'bash', durationMs: 890, status: 'success', at: 0.28 },
      { id: 'tc-3', name: 'edit_file', durationMs: 340, status: 'success', at: 0.45 },
      { id: 'tc-4', name: 'bash', durationMs: 1200, status: 'success', at: 0.6 },
      { id: 'tc-5', name: 'write_file', durationMs: 280, status: 'pending', at: 0.72 },
    ],
  },
  {
    id: 'th-2',
    agentName: 'Iris',
    agentType: 'claude',
    task: 'Analyze Q1 user churn patterns and surface top 3 retention levers',
    health: 'flowing',
    progress: 0.45,
    startedAt: '8 min ago',
    tokens: 31800,
    costUsd: 0.24,
    contextPct: 38,
    messages: 14,
    lastAction: 'Querying cohort data for March drop-off segment',
    yLane: 1,
    toolCalls: [
      { id: 'tc-6', name: 'web_search', durationMs: 2100, status: 'success', at: 0.12 },
      { id: 'tc-7', name: 'bash', durationMs: 450, status: 'success', at: 0.3 },
      { id: 'tc-8', name: 'bash', durationMs: 780, status: 'pending', at: 0.45 },
    ],
  },
  {
    id: 'th-3',
    agentName: 'Sage',
    agentType: 'claude',
    task: 'Update API documentation for v2 endpoints after auth schema change',
    health: 'slowing',
    progress: 0.31,
    startedAt: '22 min ago',
    tokens: 18400,
    costUsd: 0.14,
    contextPct: 22,
    messages: 9,
    lastAction: 'Waiting for Atlas to finalize token schema before continuing',
    yLane: 2,
    interactsWith: ['th-1'],
    toolCalls: [
      { id: 'tc-9',  name: 'read_file', durationMs: 95, status: 'success', at: 0.08 },
      { id: 'tc-10', name: 'web_fetch', durationMs: 1800, status: 'success', at: 0.22 },
      { id: 'tc-11', name: 'edit_file', durationMs: 310, status: 'error', at: 0.31 },
    ],
  },
  {
    id: 'th-4',
    agentName: 'Orion',
    agentType: 'gpt',
    task: 'Generate onboarding email sequence (5 emails, 14-day drip)',
    health: 'completed',
    progress: 1.0,
    startedAt: '41 min ago',
    tokens: 62100,
    costUsd: 0.52,
    contextPct: 0,
    messages: 31,
    lastAction: 'Completed — all 5 emails delivered to content team',
    yLane: 3,
    toolCalls: [
      { id: 'tc-12', name: 'web_search', durationMs: 1200, status: 'success', at: 0.15 },
      { id: 'tc-13', name: 'write_file', durationMs: 890, status: 'success', at: 0.35 },
      { id: 'tc-14', name: 'write_file', durationMs: 720, status: 'success', at: 0.55 },
      { id: 'tc-15', name: 'write_file', durationMs: 680, status: 'success', at: 0.75 },
      { id: 'tc-16', name: 'bash',       durationMs: 340, status: 'success', at: 0.92 },
    ],
  },
  {
    id: 'th-5',
    agentName: 'Lyra',
    agentType: 'claude',
    task: 'Review and triage 47 open GitHub issues — label, close duplicates, draft replies',
    health: 'blocked',
    progress: 0.18,
    startedAt: '5 min ago',
    tokens: 9200,
    costUsd: 0.07,
    contextPct: 11,
    messages: 4,
    lastAction: 'Blocked — missing GitHub API token in environment',
    yLane: 4,
    toolCalls: [
      { id: 'tc-17', name: 'bash', durationMs: 230, status: 'error', at: 0.18 },
    ],
  },
  {
    id: 'th-6',
    agentName: 'Dex',
    agentType: 'bot',
    task: 'Nightly: sync Stripe invoices → internal ledger, flag anomalies',
    health: 'blocked',
    progress: 0.08,
    startedAt: '3 hr ago',
    tokens: 4100,
    costUsd: 0.03,
    contextPct: 5,
    messages: 2,
    lastAction: 'Blocked — Stripe API key revoked, 3 tasks cannot proceed',
    yLane: 5,
    toolCalls: [
      { id: 'tc-dex-1', name: 'bash', durationMs: 410, status: 'error', at: 0.08 },
    ],
  },
  {
    id: 'th-7',
    agentName: 'Nova',
    agentType: 'claude',
    task: 'Migrate legacy PostgreSQL views to Django ORM — zero downtime',
    health: 'flowing',
    progress: 0.58,
    startedAt: '31 min ago',
    tokens: 71400,
    costUsd: 0.61,
    contextPct: 74,
    messages: 28,
    lastAction: 'Running migration tests against staging database',
    yLane: 6,
    toolCalls: [
      { id: 'tc-18', name: 'bash', durationMs: 3200, status: 'success', at: 0.1 },
      { id: 'tc-19', name: 'read_file', durationMs: 180, status: 'success', at: 0.22 },
      { id: 'tc-20', name: 'edit_file', durationMs: 420, status: 'success', at: 0.36 },
      { id: 'tc-21', name: 'bash', durationMs: 5100, status: 'success', at: 0.48 },
      { id: 'tc-22', name: 'bash', durationMs: 2800, status: 'pending', at: 0.58 },
    ],
  },
];

const MOCK_TICKETS: Ticket[] = [
  {
    id: 'OW-116',
    title: 'Refactor auth middleware for compliance',
    priority: 'high',
    overallStatus: 'active',
    contributors: [
      { threadId: 'th-1', role: 'implementing', status: 'active' },
      { threadId: 'th-3', role: 'documenting', status: 'blocked' },
      { threadId: 'th-5', role: 'reviewing', status: 'queued' },
    ],
  },
  {
    id: 'OW-117',
    title: 'Write SDK migration guide for v1→v2',
    priority: 'high',
    overallStatus: 'active',
    contributors: [
      { threadId: 'th-3', role: 'writing', status: 'active' },
      { threadId: 'th-1', role: 'reviewing', status: 'queued' },
    ],
  },
  {
    id: 'OW-103',
    title: 'Q1 churn analysis and retention levers',
    priority: 'high',
    overallStatus: 'active',
    contributors: [
      { threadId: 'th-2', role: 'analyzing', status: 'active' },
      { threadId: 'th-4', role: 'presenting', status: 'queued' },
    ],
  },
  {
    id: 'OW-163',
    title: 'Migrate PostgreSQL views to Django ORM on staging',
    priority: 'high',
    overallStatus: 'active',
    contributors: [
      { threadId: 'th-7', role: 'implementing', status: 'active' },
      { threadId: 'th-1', role: 'reviewing', status: 'queued' },
    ],
  },
  {
    id: 'OW-114',
    title: 'Audit session token storage for GDPR',
    priority: 'high',
    overallStatus: 'done',
    contributors: [
      { threadId: 'th-1', role: 'implementing', status: 'done' },
      { threadId: 'th-5', role: 'reviewing', status: 'done' },
    ],
  },
  {
    id: 'OW-130',
    title: 'Research onboarding email best practices',
    priority: 'medium',
    overallStatus: 'done',
    contributors: [
      { threadId: 'th-4', role: 'researching', status: 'done' },
      { threadId: 'th-2', role: 'reviewing', status: 'done' },
    ],
  },
  {
    id: 'OW-132',
    title: 'Write 14-day drip sequence (5 emails)',
    priority: 'high',
    overallStatus: 'done',
    contributors: [
      { threadId: 'th-4', role: 'writing', status: 'done' },
    ],
  },
  {
    id: 'OW-150',
    title: 'Nightly Stripe → ledger sync',
    priority: 'high',
    overallStatus: 'blocked',
    contributors: [
      { threadId: 'th-6', role: 'running', status: 'blocked' },
    ],
  },
  {
    id: 'OW-151',
    title: 'Reconcile failed charges Apr 14–16',
    priority: 'high',
    overallStatus: 'blocked',
    contributors: [
      { threadId: 'th-6', role: 'running', status: 'blocked' },
      { threadId: 'th-2', role: 'validating', status: 'queued' },
    ],
  },
  {
    id: 'OW-152',
    title: 'Flag revenue anomalies > 2σ and draft alert',
    priority: 'medium',
    overallStatus: 'blocked',
    contributors: [
      { threadId: 'th-6', role: 'running', status: 'blocked' },
    ],
  },
  {
    id: 'OW-140',
    title: 'Triage 47 open GitHub issues',
    priority: 'high',
    overallStatus: 'blocked',
    contributors: [
      { threadId: 'th-5', role: 'triaging', status: 'blocked' },
    ],
  },
  {
    id: 'OW-160',
    title: 'Audit all legacy PostgreSQL views',
    priority: 'high',
    overallStatus: 'done',
    contributors: [
      { threadId: 'th-7', role: 'auditing', status: 'done' },
      { threadId: 'th-1', role: 'reviewing', status: 'done' },
    ],
  },
  {
    id: 'OW-161',
    title: 'Map views to Django ORM equivalents',
    priority: 'high',
    overallStatus: 'done',
    contributors: [
      { threadId: 'th-7', role: 'implementing', status: 'done' },
    ],
  },
];

const MOCK_INTERSECTIONS: Intersection[] = [
  // OW-116: Atlas (th-1) + Sage (th-3) — Atlas implementing, Sage waiting
  { threadAId: 'th-1', threadBId: 'th-3', atX: 0.55, type: 'dependency' },
  // OW-117: Sage (th-3) + Atlas (th-1) — Sage writing, Atlas reviewing after
  { threadAId: 'th-3', threadBId: 'th-1', atX: 0.85, type: 'collaboration' },
  // OW-163: Nova (th-7) + Atlas (th-1) — Nova staging, Atlas reviewing before prod
  { threadAId: 'th-7', threadBId: 'th-1', atX: 0.75, type: 'dependency' },
  // OW-103: Iris (th-2) + Orion (th-4) — Iris analysis feeds Orion's exec summary
  { threadAId: 'th-2', threadBId: 'th-4', atX: 0.7, type: 'collaboration' },
  // OW-151: Dex (th-6) + Iris (th-2) — Iris validates once Dex unblocks
  { threadAId: 'th-6', threadBId: 'th-2', atX: 0.3, type: 'dependency' },
];

function getThreadTickets(threadId: string): Ticket[] {
  return MOCK_TICKETS.filter(t => t.contributors.some(c => c.threadId === threadId));
}

// Past snapshots — each defines phase state + per-thread overrides at that moment
const PAST_SNAPSHOTS: SnapshotDef[] = [
  {
    label: 'Sprint Start',
    shortLabel: 'Apr 7',
    phase: {
      name: 'Q2 Auth Overhaul',
      sprint: 'Sprint 3 of 4',
      goal: 'Complete compliance-grade auth rewrite, migrate all v1 endpoints to v2, and ship onboarding revamp',
      totalTickets: 34,
      doneTickets: 2,
      daysLeft: 14,
      dueDate: 'Apr 21',
    },
    threadOverrides: {
      'th-1': { health: 'flowing', progress: 0.12, lastAction: 'Starting auth middleware audit', tokens: 6200, costUsd: 0.05, contextPct: 8, messages: 3 },
      'th-2': { health: 'idle', progress: 0, lastAction: 'Waiting for data access setup', tokens: 0, costUsd: 0, contextPct: 0, messages: 0 },
      'th-3': { health: 'flowing', progress: 0.08, lastAction: 'Reviewing existing v2 endpoint docs', tokens: 3100, costUsd: 0.02, contextPct: 4, messages: 2 },
      'th-4': { health: 'flowing', progress: 0.25, lastAction: 'Researching email drip best practices', tokens: 14200, costUsd: 0.11, contextPct: 18, messages: 7 },
      'th-5': { health: 'flowing', progress: 0.06, lastAction: 'Beginning GitHub issue triage pass', tokens: 2100, costUsd: 0.02, contextPct: 3, messages: 1 },
      'th-6': { health: 'flowing', progress: 0.85, lastAction: 'Nightly sync completed — 0 anomalies', tokens: 3800, costUsd: 0.03, contextPct: 5, messages: 2 },
      'th-7': { health: 'idle', progress: 0, lastAction: 'Not yet started', tokens: 0, costUsd: 0, contextPct: 0, messages: 0 },
    },
  },
  {
    label: 'Mid-sprint',
    shortLabel: 'Apr 12',
    phase: {
      name: 'Q2 Auth Overhaul',
      sprint: 'Sprint 3 of 4',
      goal: 'Complete compliance-grade auth rewrite, migrate all v1 endpoints to v2, and ship onboarding revamp',
      totalTickets: 34,
      doneTickets: 9,
      daysLeft: 9,
      dueDate: 'Apr 21',
    },
    threadOverrides: {
      'th-1': { health: 'flowing', progress: 0.48, lastAction: 'Implementing JWT rotation — phase 2', tokens: 28400, costUsd: 0.22, contextPct: 36, messages: 14 },
      'th-2': { health: 'flowing', progress: 0.3, lastAction: 'Querying March cohort drop-off', tokens: 18200, costUsd: 0.14, contextPct: 22, messages: 9 },
      'th-3': { health: 'slowing', progress: 0.2, lastAction: 'Waiting on Atlas JWT schema', tokens: 9100, costUsd: 0.07, contextPct: 11, messages: 5 },
      'th-4': { health: 'flowing', progress: 0.7, lastAction: 'Drafting emails 3 and 4 of 5', tokens: 41600, costUsd: 0.34, contextPct: 0, messages: 21 },
      'th-5': { health: 'flowing', progress: 0.12, lastAction: 'Labeled 18 of 47 issues', tokens: 5200, costUsd: 0.04, contextPct: 7, messages: 3 },
      'th-6': { health: 'flowing', progress: 0.4, lastAction: 'Syncing Apr 12 invoices, no anomalies', tokens: 3900, costUsd: 0.03, contextPct: 5, messages: 2 },
      'th-7': { health: 'flowing', progress: 0.28, lastAction: 'Auditing legacy view dependencies', tokens: 22100, costUsd: 0.18, contextPct: 28, messages: 11 },
    },
  },
  {
    label: 'Yesterday',
    shortLabel: 'Apr 17',
    phase: {
      name: 'Q2 Auth Overhaul',
      sprint: 'Sprint 3 of 4',
      goal: 'Complete compliance-grade auth rewrite, migrate all v1 endpoints to v2, and ship onboarding revamp',
      totalTickets: 34,
      doneTickets: 17,
      daysLeft: 5,
      dueDate: 'Apr 21',
    },
    threadOverrides: {
      'th-1': { health: 'flowing', progress: 0.62, lastAction: 'Writing compliance test coverage', tokens: 41800, costUsd: 0.33, contextPct: 53, messages: 20 },
      'th-2': { health: 'flowing', progress: 0.38, lastAction: 'Cross-referencing cohort segments', tokens: 27400, costUsd: 0.21, contextPct: 33, messages: 12 },
      'th-3': { health: 'slowing', progress: 0.25, lastAction: 'Atlas schema still in flux — holding', tokens: 14800, costUsd: 0.11, contextPct: 18, messages: 7 },
      'th-4': { health: 'completed', progress: 1.0, lastAction: 'All 5 emails delivered to content team', tokens: 62100, costUsd: 0.52, contextPct: 0, messages: 31 },
      'th-5': { health: 'blocked', progress: 0.18, lastAction: 'Blocked — GitHub API token missing', tokens: 9200, costUsd: 0.07, contextPct: 11, messages: 4 },
      'th-6': { health: 'slowing', progress: 0.05, lastAction: 'Stripe API returning 401s — investigating', tokens: 3200, costUsd: 0.02, contextPct: 4, messages: 2 },
      'th-7': { health: 'flowing', progress: 0.45, lastAction: 'Migrating accounts_view to Django ORM', tokens: 52100, costUsd: 0.44, contextPct: 58, messages: 21 },
    },
  },
  {
    label: '6h ago',
    shortLabel: '6h ago',
    phase: {
      name: 'Q2 Auth Overhaul',
      sprint: 'Sprint 3 of 4',
      goal: 'Complete compliance-grade auth rewrite, migrate all v1 endpoints to v2, and ship onboarding revamp',
      totalTickets: 34,
      doneTickets: 18,
      daysLeft: 4,
      dueDate: 'Apr 21',
    },
    threadOverrides: {
      'th-1': { health: 'flowing', progress: 0.68, lastAction: 'Finalizing token rotation test suite', tokens: 44900, costUsd: 0.36, contextPct: 57, messages: 21 },
      'th-2': { health: 'flowing', progress: 0.42, lastAction: 'Building retention lever model', tokens: 29600, costUsd: 0.23, contextPct: 36, messages: 13 },
      'th-3': { health: 'slowing', progress: 0.28, lastAction: 'Partially updated — waiting on token schema', tokens: 16200, costUsd: 0.12, contextPct: 20, messages: 8 },
      'th-4': { health: 'completed', progress: 1.0, lastAction: 'All 5 emails delivered to content team', tokens: 62100, costUsd: 0.52, contextPct: 0, messages: 31 },
      'th-5': { health: 'blocked', progress: 0.18, lastAction: 'Blocked — GitHub API token missing', tokens: 9200, costUsd: 0.07, contextPct: 11, messages: 4 },
      'th-6': { health: 'blocked', progress: 0.08, lastAction: 'Blocked — Stripe API key revoked', tokens: 3800, costUsd: 0.03, contextPct: 5, messages: 2 },
      'th-7': { health: 'flowing', progress: 0.52, lastAction: 'Running migration rollback tests', tokens: 64200, costUsd: 0.55, contextPct: 66, messages: 25 },
    },
  },
];

// LIVE_IDX = past snapshots length means "now / live"
const LIVE_IDX = PAST_SNAPSHOTS.length;

function applySnapshot(idx: number): { threads: Thread[]; phase: Phase } {
  if (idx === LIVE_IDX) return { threads: MOCK_THREADS, phase: MOCK_PHASE };
  const snap = PAST_SNAPSHOTS[idx];
  const threads = MOCK_THREADS.map(t => ({
    ...t,
    ...(snap.threadOverrides[t.id] ?? {}),
  }));
  return { threads, phase: snap.phase };
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPaddingLeft(svgWidth: number) {
  if (svgWidth < 480) return 72;
  if (svgWidth < 768) return 110;
  return 180;
}

function getThreadY(lane: number) {
  return PADDING_TOP + lane * LANE_HEIGHT;
}

function getThreadX(progress: number, width: number) {
  const pl = getPaddingLeft(width);
  const usable = width - pl - PADDING_RIGHT;
  return pl + progress * usable;
}

// Generate a slightly wavy bezier path for a thread
function buildThreadPath(thread: Thread, svgWidth: number): string {
  const pl = getPaddingLeft(svgWidth);
  const y = getThreadY(thread.yLane);
  const startX = pl;
  const endX = getThreadX(thread.health === 'idle' ? 0 : thread.progress, svgWidth);

  const waveAmp = 4;
  const waveFreq = thread.yLane % 2 === 0 ? 1 : -1;
  const cp1x = startX + (endX - startX) * 0.33;
  const cp1y = y + waveAmp * waveFreq;
  const cp2x = startX + (endX - startX) * 0.66;
  const cp2y = y - waveAmp * waveFreq;

  return `M ${startX} ${y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${y}`;
}

// Build ghost path (the remaining distance to go)
function buildGhostPath(thread: Thread, svgWidth: number): string {
  if (thread.health === 'completed' || thread.health === 'idle') return '';
  const y = getThreadY(thread.yLane);
  const startX = getThreadX(thread.progress, svgWidth);
  const endX = svgWidth - PADDING_RIGHT;
  const waveAmp = 3;
  const wf = thread.yLane % 2 === 0 ? -1 : 1;
  const cp1x = startX + (endX - startX) * 0.4;
  const cp1y = y + waveAmp * wf;
  const cp2x = startX + (endX - startX) * 0.7;
  const cp2y = y - waveAmp * wf;
  return `M ${startX} ${y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${y}`;
}

function formatCost(usd: number) {
  return usd === 0 ? '$0.00' : `$${usd.toFixed(2)}`;
}
function formatTokens(t: number) {
  if (t === 0) return '0';
  if (t >= 1000) return `${(t / 1000).toFixed(1)}k`;
  return t.toString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: ThreadHealth }) {
  const c = HEALTH_COLORS[health];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.badge}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${health === 'flowing' || health === 'slowing' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: c.stroke }}
      />
      {c.label}
    </span>
  );
}

function AgentAvatar({ thread, size = 28 }: { thread: Thread; size?: number }) {
  const color = AGENT_TYPE_COLORS[thread.agentType];
  const initials = thread.agentName.slice(0, 2).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color + '33',
        border: `1.5px solid ${color}`,
        fontSize: size * 0.36,
        color,
      }}
    >
      {initials}
    </div>
  );
}

function ToolCallDot({ tc, color }: { tc: ToolCall; color: string }) {
  const statusColor = tc.status === 'success' ? '#22c55e' : tc.status === 'error' ? '#ef4444' : '#f59e0b';
  return (
    <g>
      <circle r={5} fill={color + '22'} stroke={statusColor} strokeWidth={1.5} />
      <circle r={2} fill={statusColor} />
    </g>
  );
}

// Thread detail panel shown when a thread is selected
function ThreadDetailPanel({ thread, onClose, onWhisper }: {
  thread: Thread;
  onClose: () => void;
  onWhisper: (thread: Thread) => void;
}) {
  const hc = HEALTH_COLORS[thread.health];
  const color = AGENT_TYPE_COLORS[thread.agentType];

  const timeline = [...thread.toolCalls].sort((a, b) => a.at - b.at);

  return (
    <div
      className="fixed z-50 flex flex-col
        bottom-0 left-0 right-0 max-h-[80dvh] rounded-t-2xl
        sm:bottom-auto sm:right-0 sm:top-0 sm:left-auto sm:w-[420px] sm:max-h-full sm:h-full sm:rounded-none"
      style={{
        background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%)',
        borderTop: '1px solid #222233',
        borderLeft: '1px solid #222233',
        boxShadow: '-20px 0 60px #00000080',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-[#222233]">
        <div className="flex items-center gap-3">
          <AgentAvatar thread={thread} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-base">{thread.agentName}</span>
              <HealthBadge health={thread.health} />
            </div>
            <div className="text-gray-500 text-xs mt-0.5 capitalize">{thread.agentType} agent · started {thread.startedAt}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors mt-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Active task */}
      <div className="px-6 py-3 border-b border-[#1a1a2e]">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Active Task</div>
        <p className="text-gray-200 text-sm leading-relaxed">{thread.task}</p>
        <div className="mt-2 text-xs text-gray-400 italic">{thread.lastAction}</div>
      </div>

      {/* Ticket queue */}
      <div className="px-6 py-3 border-b border-[#1a1a2e]">
        {(() => {
          const agentTickets = getThreadTickets(thread.id);
          const done = agentTickets.filter(t => t.contributors.find(c => c.threadId === thread.id)?.status === 'done').length;
          const total = agentTickets.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const TICKET_COLORS: Record<TicketStatus, { dot: string; text: string; label: string }> = {
            done:    { dot: '#22c55e', text: 'text-gray-600 line-through', label: 'Done' },
            active:  { dot: hc.stroke, text: 'text-gray-200 font-medium', label: 'Active' },
            queued:  { dot: '#374151', text: 'text-gray-500', label: 'Queued' },
            blocked: { dot: '#ef4444', text: 'text-red-400', label: 'Blocked' },
          };
          return (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  Shared Work <span className="text-gray-400 normal-case ml-1">{done}/{total} done</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: hc.stroke }}>{pct}%</span>
              </div>
              <div className="h-1 bg-[#1a1a2e] rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: hc.stroke }} />
              </div>
              {/* Multi-blocked callout */}
              {(() => {
                const blockedTickets = agentTickets.filter(t => t.contributors.find(c => c.threadId === thread.id)?.status === 'blocked');
                if (blockedTickets.length > 1) {
                  return (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/20">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" className="shrink-0">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="text-xs text-red-400 font-medium">{blockedTickets.length} tickets blocked — needs attention</span>
                    </div>
                  );
                }
                return null;
              })()}
              <div className="space-y-1.5">
                {agentTickets.map(ticket => {
                  const myContrib = ticket.contributors.find(c => c.threadId === thread.id)!;
                  const others = ticket.contributors.filter(c => c.threadId !== thread.id);
                  const tc = TICKET_COLORS[myContrib.status];
                  return (
                    <div key={ticket.id} className="mb-3">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: tc.dot }} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs ${tc.text} leading-snug`}>{ticket.title}</span>
                          <div className="text-xs mt-0.5" style={{ color: color + 'aa' }}>
                            {myContrib.role}
                          </div>
                        </div>
                        <span className="text-xs text-gray-700 font-mono shrink-0">{ticket.id}</span>
                      </div>
                      {others.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 ml-3.5">
                          {others.map(o => {
                            const oThread = MOCK_THREADS.find(t => t.id === o.threadId);
                            const oColor = AGENT_TYPE_COLORS[oThread?.agentType ?? 'bot'];
                            const oDot = o.status === 'done' ? '#22c55e' : o.status === 'blocked' ? '#ef4444' : o.status === 'active' ? oColor : '#374151';
                            return (
                              <span key={o.threadId} className="text-xs px-1.5 py-0.5 rounded border" style={{ borderColor: oDot + '40', color: oDot, backgroundColor: oDot + '10' }}>
                                {oThread?.agentName} · {o.role}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-px bg-[#1a1a2e] border-b border-[#1a1a2e]">
        {[
          { label: 'Tokens', value: formatTokens(thread.tokens) },
          { label: 'Cost', value: formatCost(thread.costUsd) },
          { label: 'Context', value: `${thread.contextPct}%` },
        ].map(m => (
          <div key={m.label} className="bg-[#0a0a0f] px-4 py-3 text-center">
            <div className="text-white font-semibold text-sm">{m.value}</div>
            <div className="text-gray-600 text-xs mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="px-6 py-4 border-b border-[#1a1a2e]">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Progress</span>
          <span>{Math.round(thread.progress * 100)}%</span>
        </div>
        <div className="h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${thread.progress * 100}%`, backgroundColor: hc.stroke }}
          />
        </div>
      </div>

      {/* Tool call timeline */}
      <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Tool Calls ({thread.toolCalls.length})
        </div>
        <div className="space-y-2">
          {timeline.map((tc) => {
            const dot = tc.status === 'success' ? '#22c55e' : tc.status === 'error' ? '#ef4444' : '#f59e0b';
            const bg  = tc.status === 'success' ? 'bg-green-500/5' : tc.status === 'error' ? 'bg-red-500/5' : 'bg-amber-500/5';
            const label = tc.status === 'success' ? 'success' : tc.status === 'error' ? 'failed' : 'running';
            return (
              <div key={tc.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${bg} border border-[#1a1a2e]`}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />
                <div className="flex-1 min-w-0">
                  <div className="text-gray-300 text-xs font-mono">{tc.name}</div>
                  <div className="text-gray-600 text-xs">{tc.durationMs}ms · {label}</div>
                </div>
                <div className="text-gray-600 text-xs">{Math.round(tc.at * 100)}%</div>
              </div>
            );
          })}
          {thread.toolCalls.length === 0 && (
            <div className="text-gray-600 text-sm text-center py-4">No tool calls yet</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 pt-4 border-t border-[#222233] flex gap-3">
        <button
          onClick={() => onWhisper(thread)}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: color + '18',
            border: `1px solid ${color}40`,
            color,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Whisper
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/30 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Take the Wheel
        </button>
      </div>
    </div>
  );
}

// Whisper modal
function WhisperModal({ thread, onClose, onSend }: {
  thread: Thread;
  onClose: () => void;
  onSend: (msg: string) => void;
}) {
  const [msg, setMsg] = useState('');
  const color = AGENT_TYPE_COLORS[thread.agentType];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-[calc(100vw-2rem)] sm:w-[480px] rounded-2xl p-6 z-10"
        style={{ background: '#0f0f1a', border: '1px solid #222233', boxShadow: '0 30px 80px #00000090' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <AgentAvatar thread={thread} size={32} />
          <div>
            <div className="text-white font-semibold text-sm">Whisper to {thread.agentName}</div>
            <div className="text-gray-500 text-xs">Inject context without taking control</div>
          </div>
        </div>
        <textarea
          className="w-full rounded-xl bg-[#1a1a2e] border border-[#222233] text-gray-200 text-sm p-3 resize-none focus:outline-none focus:border-indigo-500/50 placeholder-gray-600"
          rows={4}
          placeholder="e.g. The client changed the session timeout to 30 min. Factor this into the token rotation logic."
          value={msg}
          onChange={e => setMsg(e.target.value)}
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl text-sm text-gray-400 border border-[#222233] hover:border-gray-500 transition-all">
            Cancel
          </button>
          <button
            onClick={() => { if (msg.trim()) { onSend(msg); onClose(); } }}
            disabled={!msg.trim()}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: color + '22', border: `1px solid ${color}50`, color }}
          >
            Send Whisper
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Time Scrubber ────────────────────────────────────────────────────────────

function TimeScrubber({ idx, onChange }: { idx: number; onChange: (i: number) => void }) {
  const isLive = idx === LIVE_IDX;
  const ticks = [...PAST_SNAPSHOTS.map((s, i) => ({ label: s.shortLabel, full: s.label, i })), { label: 'Now', full: 'Live', i: LIVE_IDX }];

  return (
    <div className="border-t border-[#1a1a2e] bg-[#06060c] px-4 sm:px-6 py-2 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-700 uppercase tracking-wider shrink-0 hidden sm:block">Timeline</span>

        {/* Tick row */}
        <div className="flex items-center gap-1 flex-1 relative">
          {/* Connecting line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#1a1a2e]" />

          {ticks.map(tick => {
            const active = tick.i === idx;
            const isPast = tick.i < idx || (tick.i === LIVE_IDX && !isLive);
            return (
              <button
                key={tick.i}
                onClick={() => onChange(tick.i)}
                className="relative flex flex-col items-center gap-1 flex-1 group"
                title={tick.full}
              >
                {/* Dot */}
                <div
                  className={`w-2.5 h-2.5 rounded-full border z-10 transition-all duration-150 ${
                    active
                      ? tick.i === LIVE_IDX
                        ? 'bg-green-500 border-green-500 scale-110'
                        : 'bg-amber-400 border-amber-400 scale-110'
                      : 'bg-[#06060c] border-[#333355] group-hover:border-gray-500'
                  }`}
                />
                {/* Label */}
                <span
                  className={`text-[10px] leading-none transition-colors duration-150 ${
                    active
                      ? tick.i === LIVE_IDX ? 'text-green-400 font-semibold' : 'text-amber-400 font-semibold'
                      : 'text-gray-700 group-hover:text-gray-500'
                  }`}
                >
                  {tick.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* "→ Live" pill when in past */}
        {!isLive && (
          <button
            onClick={() => onChange(LIVE_IDX)}
            className="shrink-0 flex items-center gap-1 text-xs text-green-400 border border-green-500/30 bg-green-500/8 rounded-full px-2.5 py-1 hover:bg-green-500/15 transition-all"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Loom Canvas ─────────────────────────────────────────────────────────

function LoomCanvas({
  threads,
  intersections,
  selectedId,
  onSelectThread,
  hoveredId,
  onHoverThread,
}: {
  threads: Thread[];
  intersections: Intersection[];
  selectedId: string | null;
  onSelectThread: (id: string) => void;
  hoveredId: string | null;
  onHoverThread: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 1200, height: 700 });
  const animFrame = useRef<number>(0);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const svgHeight = PADDING_TOP * 2 + threads.length * LANE_HEIGHT;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-auto">
      <svg
        ref={svgRef}
        width={dims.width}
        height={svgHeight}
        style={{ cursor: 'default' }}
      >
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
          <filter id="glow-intersection" x="-100%" y="-400%" width="300%" height="900%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Time grid lines */}
        {[0.25, 0.5, 0.75].map(t => {
          const pl = getPaddingLeft(dims.width);
          const x = pl + t * (dims.width - pl - PADDING_RIGHT);
          return (
            <g key={t}>
              <line
                x1={x} y1={PADDING_TOP - 20}
                x2={x} y2={svgHeight - 20}
                stroke="#1a1a2e"
                strokeWidth={1}
                strokeDasharray="4,6"
              />
              <text x={x} y={PADDING_TOP - 26} textAnchor="middle" fill="#333355" fontSize={10} fontFamily="Inter, sans-serif">
                {t === 0.25 ? '−45m' : t === 0.5 ? '−30m' : '−15m'}
              </text>
            </g>
          );
        })}
        {/* Now line */}
        <line
          x1={dims.width - PADDING_RIGHT} y1={PADDING_TOP - 20}
          x2={dims.width - PADDING_RIGHT} y2={svgHeight - 20}
          stroke="#222244"
          strokeWidth={1}
        />
        <text x={dims.width - PADDING_RIGHT} y={PADDING_TOP - 26} textAnchor="middle" fill="#444466" fontSize={10} fontFamily="Inter, sans-serif">
          now
        </text>

        {/* Intersection markers */}
        {intersections.map((ix, i) => {
          const pl = getPaddingLeft(dims.width);
          const tA = threads.find(t => t.id === ix.threadAId);
          const tB = threads.find(t => t.id === ix.threadBId);
          if (!tA || !tB) return null;
          const x = pl + ix.atX * (dims.width - pl - PADDING_RIGHT);
          const yA = getThreadY(tA.yLane);
          const yB = getThreadY(tB.yLane);
          const cx = x;
          const cy = (yA + yB) / 2;
          const color = ix.type === 'conflict' ? '#ef4444' : ix.type === 'collaboration' ? '#22c55e' : '#f59e0b';
          return (
            <g key={i}>
              <line x1={cx} y1={yA} x2={cx} y2={yB} stroke={color} strokeWidth={1} strokeDasharray="3,4" opacity={0.4} />
              <circle cx={cx} cy={yA} r={4} fill={color + '33'} stroke={color} strokeWidth={1.5} filter="url(#glow-intersection)" />
              <circle cx={cx} cy={yB} r={4} fill={color + '33'} stroke={color} strokeWidth={1.5} />
              {dims.width >= 480 && (
                <text x={cx + 8} y={cy} fill={color} fontSize={9} fontFamily="Inter, sans-serif" opacity={0.7} dominantBaseline="middle">
                  {ix.type === 'dependency' ? 'waits for' : ix.type}
                </text>
              )}
            </g>
          );
        })}

        {/* Threads */}
        {threads.map(thread => {
          const pl = getPaddingLeft(dims.width);
          const hc = HEALTH_COLORS[thread.health];
          const isSelected = selectedId === thread.id;
          const isHovered = hoveredId === thread.id;
          const isDimmed = (selectedId || hoveredId) && !isSelected && !isHovered;
          const opacity = isDimmed ? 0.2 : 1;
          const strokeWidth = isSelected || isHovered ? 2.5 : 1.8;

          const activePath = buildThreadPath(thread, dims.width);
          const ghostPath = buildGhostPath(thread, dims.width);
          const y = getThreadY(thread.yLane);
          const tipX = getThreadX(thread.health === 'idle' ? 0 : thread.progress, dims.width);
          const isSmall = dims.width < 480;

          return (
            <g key={thread.id} style={{ opacity, transition: 'opacity 0.2s ease' }}>
              {/* Ghost (future) path */}
              {ghostPath && (
                <path
                  d={ghostPath}
                  fill="none"
                  stroke={hc.stroke}
                  strokeWidth={1}
                  strokeDasharray="4,8"
                  opacity={0.12}
                />
              )}

              {/* Active thread path - glow layer */}
              {thread.health !== 'idle' && (
                <path
                  d={activePath}
                  fill="none"
                  stroke={hc.stroke}
                  strokeWidth={strokeWidth + 4}
                  opacity={isSelected || isHovered ? 0.18 : 0.08}
                  strokeLinecap="round"
                />
              )}

              {/* Active thread path - main */}
              <path
                d={activePath}
                fill="none"
                stroke={thread.health === 'idle' ? '#1e1e30' : hc.stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={thread.health === 'idle' ? '2,6' : undefined}
                style={{
                  filter: isSelected || isHovered ? `url(#glow-${thread.id})` : undefined,
                  cursor: 'pointer',
                  transition: 'stroke-width 0.15s ease',
                }}
                onClick={() => onSelectThread(thread.id)}
                onMouseEnter={() => onHoverThread(thread.id)}
                onMouseLeave={() => onHoverThread(null)}
              />

              {/* Invisible wider hit area */}
              <path
                d={activePath}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectThread(thread.id)}
                onMouseEnter={() => onHoverThread(thread.id)}
                onMouseLeave={() => onHoverThread(null)}
              />

              {/* Tool call dots */}
              {thread.toolCalls.map(tc => {
                const tcX = pl + tc.at * (dims.width - pl - PADDING_RIGHT);
                return (
                  <g key={tc.id} transform={`translate(${tcX}, ${y})`}>
                    <ToolCallDot tc={tc} color={hc.stroke} />
                  </g>
                );
              })}

              {/* Animated tip dot for active threads */}
              {(thread.health === 'flowing' || thread.health === 'slowing' || thread.health === 'blocked') && (
                <g transform={`translate(${tipX}, ${y})`}>
                  <circle r={6} fill={hc.stroke} opacity={0.15}>
                    <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle r={4} fill={hc.stroke} opacity={0.9} />
                  <circle r={2} fill="white" opacity={0.8} />
                </g>
              )}

              {/* Completed checkmark */}
              {thread.health === 'completed' && (
                <g transform={`translate(${dims.width - PADDING_RIGHT}, ${y})`}>
                  <circle r={7} fill="#6366f133" stroke="#6366f1" strokeWidth={1.5} />
                  <path d="M -3 0 L -1 2 L 3.5 -2" stroke="#6366f1" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}

              {/* Lane label (left) */}
              {(() => {
                const agentTickets = getThreadTickets(thread.id);
                const done = agentTickets.filter(t => t.contributors.find(c => c.threadId === thread.id)?.status === 'done').length;
                const total = agentTickets.length;
                return (
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectThread(thread.id)}
                    onMouseEnter={() => onHoverThread(thread.id)}
                    onMouseLeave={() => onHoverThread(null)}
                  >
                    <rect
                      x={2}
                      y={y - 16}
                      width={pl - 8}
                      height={32}
                      rx={6}
                      fill={isSelected || isHovered ? '#1a1a2e' : 'transparent'}
                      style={{ transition: 'fill 0.15s ease' }}
                    />
                    <text
                      x={pl - 10}
                      y={y - 5}
                      textAnchor="end"
                      fill={isSelected || isHovered ? '#e5e7eb' : '#6b7280'}
                      fontSize={isSmall ? 9 : 11}
                      fontWeight={isSelected || isHovered ? '600' : '400'}
                      fontFamily="Inter, sans-serif"
                      style={{ transition: 'fill 0.15s ease' }}
                    >
                      {isSmall ? thread.agentName.slice(0, 4) : thread.agentName}
                    </text>
                    {!isSmall && (
                      <text
                        x={pl - 10}
                        y={y + 8}
                        textAnchor="end"
                        fill={isSelected || isHovered ? '#9ca3af' : '#374151'}
                        fontSize={9}
                        fontFamily="Inter, sans-serif"
                        style={{ transition: 'fill 0.15s ease' }}
                      >
                        {done}/{total}
                      </text>
                    )}
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Phase Goal Bar ───────────────────────────────────────────────────────────

function PhaseGoalBar({ phase, threads }: { phase: Phase; threads: Thread[] }) {
  const pct = Math.round((phase.doneTickets / phase.totalTickets) * 100);
  const remaining = phase.totalTickets - phase.doneTickets;
  const blockedCount = threads.filter(t => t.health === 'blocked').length;
  const isAtRisk = blockedCount > 0 && phase.daysLeft <= 5;

  return (
    <div
      className="px-4 sm:px-6 py-2.5 border-b shrink-0"
      style={{ borderColor: isAtRisk ? '#7c2d1233' : '#1a1a2e', background: isAtRisk ? '#7c2d1208' : 'transparent' }}
    >
      <div className="flex items-center gap-3 sm:gap-6 flex-wrap sm:flex-nowrap">
        {/* Phase name + sprint */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          <span className="text-white text-xs font-semibold truncate">{phase.name}</span>
          <span className="text-gray-600 text-xs hidden sm:inline">·</span>
          <span className="text-gray-600 text-xs hidden sm:inline">{phase.sprint}</span>
        </div>

        {/* Progress bar + pct */}
        <div className="flex items-center gap-2 flex-1 min-w-[120px]">
          <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: isAtRisk
                  ? 'linear-gradient(90deg, #6366f1, #f59e0b)'
                  : 'linear-gradient(90deg, #6366f1, #22c55e)',
              }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-300 shrink-0">{pct}%</span>
        </div>

        {/* Ticket counts */}
        <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
          <span><span className="text-green-400 font-medium">{phase.doneTickets}</span> done</span>
          <span className="text-gray-700">·</span>
          <span><span className="text-gray-300 font-medium">{remaining}</span> left</span>
          {blockedCount > 0 && (
            <>
              <span className="text-gray-700">·</span>
              <span className="text-red-400 font-medium">{blockedCount} blocked</span>
            </>
          )}
        </div>

        {/* Deadline */}
        <div
          className={`flex items-center gap-1.5 text-xs shrink-0 ${isAtRisk ? 'text-amber-400' : 'text-gray-600'}`}
        >
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

// ─── System Health Bar ────────────────────────────────────────────────────────

function SystemHealthBar({ threads }: { threads: Thread[] }) {
  const total = threads.length;
  const counts = {
    flowing:   threads.filter(t => t.health === 'flowing').length,
    slowing:   threads.filter(t => t.health === 'slowing').length,
    blocked:   threads.filter(t => t.health === 'blocked').length,
    completed: threads.filter(t => t.health === 'completed').length,
    idle:      threads.filter(t => t.health === 'idle').length,
  };
  const totalCost   = threads.reduce((s, t) => s + t.costUsd, 0);
  const totalTokens = threads.reduce((s, t) => s + t.tokens, 0);
  const active      = threads.filter(t => t.health === 'flowing' || t.health === 'slowing').length;

  return (
    <div className="flex items-center gap-3 sm:gap-6 px-4 sm:px-6 py-2 sm:py-3 border-b border-[#1a1a2e] bg-[#0a0a0f]/80 backdrop-blur-sm">
      {/* Health breakdown */}
      <div className="flex items-center gap-1 flex-1 flex-wrap">
        {(Object.entries(counts) as [ThreadHealth, number][]).map(([health, count]) => {
          if (count === 0) return null;
          const hc = HEALTH_COLORS[health];
          return (
            <div key={health} className="flex items-center gap-1 mr-2 sm:mr-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${health === 'flowing' ? 'animate-pulse' : ''}`} style={{ backgroundColor: hc.stroke }} />
              <span className="text-xs text-gray-500">{count} <span className="hidden sm:inline">{hc.label.toLowerCase()}</span></span>
            </div>
          );
        })}
      </div>

      {/* Metrics — hidden on very small screens */}
      <div className="hidden sm:flex items-center gap-4 sm:gap-6 text-xs text-gray-500">
        <div><span className="text-gray-300 font-medium">{active}</span> active</div>
        <div><span className="text-gray-300 font-medium">{formatTokens(totalTokens)}</span> tokens</div>
        <div><span className="text-gray-300 font-medium">{formatCost(totalCost)}</span> cost</div>
      </div>

      {/* Mini health bar */}
      <div className="w-16 sm:w-32 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden flex shrink-0">
        {(Object.entries(counts) as [ThreadHealth, number][]).map(([health, count]) => {
          if (count === 0) return null;
          return (
            <div
              key={health}
              style={{ width: `${(count / total) * 100}%`, backgroundColor: HEALTH_COLORS[health].stroke }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── River (upcoming scheduled tasks) ────────────────────────────────────────

function TheRiver() {
  const upcoming = [
    { name: 'Dex', task: 'Sync Stripe invoices', time: '02:00 UTC', hours: 6.3 },
    { name: 'Nova', task: 'Deploy migration to prod', time: '18:00 UTC', hours: 0.5 },
    { name: 'Iris', task: 'Weekly churn report', time: 'Mon 09:00', hours: 63 },
  ];
  return (
    <div className="border-t border-[#1a1a2e] bg-[#06060c] px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="text-xs text-gray-600 uppercase tracking-wider shrink-0">River ↠</div>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {upcoming.map((u, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="w-1 h-1 rounded-full bg-[#333355]" />
              <span className="text-xs text-gray-600">in {u.hours < 1 ? `${Math.round(u.hours * 60)}m` : `${u.hours.toFixed(0)}h`}</span>
              <span className="text-xs text-gray-500 font-medium">{u.name}</span>
              <span className="text-xs text-gray-700">·</span>
              <span className="text-xs text-gray-600">{u.task}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoomPage() {
  const [snapshotIdx, setSnapshotIdx] = useState<number>(LIVE_IDX);
  const isLive = snapshotIdx === LIVE_IDX;
  const { threads, phase } = applySnapshot(snapshotIdx);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [whisperThread, setWhisperThread] = useState<Thread | null>(null);
  const [whispers, setWhispers] = useState<{ threadId: string; msg: string; at: Date }[]>([]);

  const selectedThread = selectedId ? threads.find(t => t.id === selectedId) ?? null : null;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleWhisper = useCallback((thread: Thread) => {
    setWhisperThread(thread);
  }, []);

  const handleSendWhisper = useCallback((msg: string) => {
    if (!whisperThread) return;
    setWhispers(prev => [...prev, { threadId: whisperThread.id, msg, at: new Date() }]);
  }, [whisperThread]);

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100dvh',
        background: 'var(--background)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#1a1a2e] shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <path d="M2 12 Q6 6 12 12 Q18 18 22 12" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M2 8 Q6 4 12 8 Q18 12 22 8" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M2 16 Q6 12 12 16 Q18 20 22 16" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.4" />
          </svg>
          <span className="text-white font-semibold text-sm tracking-tight">Loom</span>
          <span className="text-gray-700 text-xs hidden sm:inline">·</span>
          <span className="text-gray-600 text-xs hidden sm:inline">Agent Activity</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {whispers.length > 0 && (
            <div className="text-xs text-indigo-400 border border-indigo-500/20 bg-indigo-500/10 rounded-full px-2 sm:px-3 py-1">
              {whispers.length} whisper{whispers.length !== 1 ? 's' : ''}
            </div>
          )}
          {isLive ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="hidden sm:inline">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-500 border border-amber-500/20 bg-amber-500/8 rounded-full px-2 py-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" />
              </svg>
              <span>{PAST_SNAPSHOTS[snapshotIdx]?.shortLabel}</span>
            </div>
          )}
          <div className="text-xs text-gray-700 border border-[#222233] rounded-lg px-2 sm:px-3 py-1.5 hidden sm:block">
            OpenWeave · demo-workspace
          </div>
        </div>
      </div>

      {/* Phase goal bar */}
      <PhaseGoalBar phase={phase} threads={threads} />

      {/* System health bar */}
      <SystemHealthBar threads={threads} />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-2 border-b border-[#111118] shrink-0 overflow-x-auto">
        <span className="text-xs text-gray-700 uppercase tracking-wider shrink-0">Key</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
          <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#22c55e" strokeWidth="2" /></svg>
          Thread
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
          <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#374151" strokeWidth="1.5" strokeDasharray="3,4" /></svg>
          <span className="hidden sm:inline">Future path</span>
          <span className="sm:hidden">Future</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#22c55e22" stroke="#22c55e" strokeWidth="1.5" /></svg>
          Tool call
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
          <svg width="10" height="10">
            <circle cx="5" cy="5" r="3" fill="#22c55e" opacity="0.9" />
            <circle cx="5" cy="5" r="1.5" fill="white" opacity="0.8" />
          </svg>
          Position
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
          <svg width="20" height="10">
            <line x1="0" y1="5" x2="20" y2="5" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,4" opacity="0.5" />
            <circle cx="0" cy="5" r="3" fill="#f59e0b22" stroke="#f59e0b" strokeWidth="1" />
            <circle cx="20" cy="5" r="3" fill="#f59e0b22" stroke="#f59e0b" strokeWidth="1" />
          </svg>
          Dependency
        </div>
        <div className="ml-auto text-xs text-gray-700 hidden md:block shrink-0">Tap a thread to inspect</div>
      </div>

      {/* Main canvas */}
      <div className="flex-1 overflow-hidden relative" style={!isLive ? { opacity: 0.85 } : undefined}>
        {/* Past-mode amber top border */}
        {!isLive && (
          <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: 'linear-gradient(90deg, transparent, #f59e0b66, transparent)' }} />
        )}
        <LoomCanvas
          threads={threads}
          intersections={MOCK_INTERSECTIONS}
          selectedId={selectedId}
          onSelectThread={handleSelect}
          hoveredId={hoveredId}
          onHoverThread={setHoveredId}
        />

        {/* No selection hint */}
        {!selectedId && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-700 pointer-events-none">
            ↑ Click a thread to zoom in
          </div>
        )}
      </div>

      {/* Time Scrubber */}
      <TimeScrubber idx={snapshotIdx} onChange={setSnapshotIdx} />

      {/* The River */}
      <TheRiver />

      {/* Thread detail panel */}
      {selectedThread && (
        <ThreadDetailPanel
          thread={selectedThread}
          onClose={() => setSelectedId(null)}
          onWhisper={handleWhisper}
        />
      )}

      {/* Whisper modal */}
      {whisperThread && (
        <WhisperModal
          thread={whisperThread}
          onClose={() => setWhisperThread(null)}
          onSend={handleSendWhisper}
        />
      )}
    </div>
  );
}
