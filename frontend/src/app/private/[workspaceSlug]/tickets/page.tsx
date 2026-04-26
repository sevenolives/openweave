'use client';

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass, selectClass } from '@/components/FormField';
import { api, Ticket, Project, User, WorkspaceMember, ApiError, PaginatedResponse, StatusDefinition, Phase } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
// Auth handled by (private) layout

const PAGE_SIZE = 25;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-900/50 text-green-300', MEDIUM: 'bg-yellow-900/50 text-yellow-300',
  HIGH: 'bg-orange-900/50 text-orange-300', CRITICAL: 'bg-red-900/50 text-red-300',
};

const PRIORITY_BAR: Record<string, string> = {
  LOW: 'bg-green-500/40', MEDIUM: 'bg-yellow-500/40', HIGH: 'bg-orange-500/60', CRITICAL: 'bg-red-500/80',
};

const COLOR_ACCENTS: Record<string, { accent: string; bg: string; badge: string }> = {
  gray:   { accent: 'bg-gray-400',   bg: 'bg-gray-900/30',   badge: 'bg-gray-800/50 text-gray-300' },
  blue:   { accent: 'bg-blue-500',   bg: 'bg-blue-900/30',   badge: 'bg-blue-900/50 text-blue-300' },
  red:    { accent: 'bg-red-500',    bg: 'bg-red-900/30',    badge: 'bg-red-900/50 text-red-300' },
  purple: { accent: 'bg-purple-500', bg: 'bg-purple-900/30', badge: 'bg-purple-900/50 text-purple-300' },
  amber:  { accent: 'bg-amber-500',  bg: 'bg-amber-900/30',  badge: 'bg-amber-900/50 text-amber-300' },
  green:  { accent: 'bg-green-500',  bg: 'bg-green-900/30',  badge: 'bg-green-900/50 text-green-300' },
  yellow: { accent: 'bg-yellow-500', bg: 'bg-yellow-900/30', badge: 'bg-yellow-900/50 text-yellow-300' },
  indigo: { accent: 'bg-indigo-500', bg: 'bg-indigo-900/30', badge: 'bg-indigo-900/50 text-indigo-300' },
  pink:   { accent: 'bg-pink-500',   bg: 'bg-pink-900/30',   badge: 'bg-pink-900/50 text-pink-300' },
  orange: { accent: 'bg-orange-500', bg: 'bg-orange-900/30', badge: 'bg-orange-900/50 text-orange-300' },
};
const fallbackColor = { accent: 'bg-gray-400', bg: 'bg-gray-900/30', badge: 'bg-gray-800/50 text-gray-300' };
function colorFor(c: string) { return COLOR_ACCENTS[c] || fallbackColor; }

function statusBadge(statuses: StatusDefinition[], key: string): string {
  const sd = statuses.find(s => s.key === key);
  return sd ? colorFor(sd.color).badge : fallbackColor.badge;
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ticketDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - ticketDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function TicketsPageWrapper() {
  return (
    <Suspense fallback={<Layout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div></div></Layout>}>
      <TicketsPage />
    </Suspense>
  );
}

function TicketsPage() {
  // Core data state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const nextPageRef = useRef(2);
  const isFetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('search') || '';
    return '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('search') || '';
    return '';
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const [filterStatus, setFilterStatus] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('status') || '';
    return '';
  });
  const [filterPriority, setFilterPriority] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('priority') || '';
    return '';
  });
  const [filterProjectInit] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('project');
      if (p) return p;
    }
    return '';
  });
  const [filterProject, setFilterProject] = useState<string>(filterProjectInit);
  const [filterAssigned, setFilterAssigned] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('assigned_to') || '';
    return '';
  });
  const [filterApproved, setFilterApproved] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('approved') || '';
    return '';
  });
  const [filterPhase, setFilterPhase] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('phase') || '';
    return '';
  });
  const [allPhases, setAllPhases] = useState<Phase[]>([]);
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [wsUsers, setWsUsers] = useState<User[]>([]);
  const [projectAgentsMap, setProjectAgentsMap] = useState<Record<string, User[]>>({});

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newTicketType, setNewTicketType] = useState('BUG');
  const [newProject, setNewProject] = useState<string>('');
  const [newAssigned, setNewAssigned] = useState<string>('');
  const [newApproved, setNewApproved] = useState(false);
  const [createProjectAgents, setCreateProjectAgents] = useState<User[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);

  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  // Sync filters to URL (no page number — scroll position is ephemeral)
  useEffect(() => {
    const basePath = `/private/${workspaceSlug}/tickets`;
    const params = new URLSearchParams();
    if (filterProject) params.set('project', String(filterProject));
    if (filterStatus) params.set('status', filterStatus);
    if (filterPriority) params.set('priority', filterPriority);
    if (filterAssigned) params.set('assigned_to', filterAssigned);
    if (filterPhase) params.set('phase', filterPhase);
    if (debouncedSearch) params.set('search', debouncedSearch);
    const url = params.toString() ? `${basePath}?${params.toString()}` : basePath;
    window.history.replaceState(null, '', url);
  }, [filterProject, filterStatus, filterPriority, filterAssigned, filterApproved, filterPhase, debouncedSearch, workspaceSlug]);

  // Load status definitions
  useEffect(() => {
    if (currentWorkspace) {
      api.getStatusDefinitions(currentWorkspace.slug).then(setStatuses).catch((err: any) => {
        toast(err?.detail || err?.message || 'Failed to load status definitions', 'error');
      });
    }
  }, [currentWorkspace?.slug]);

  // Load all phases for the workspace
  useEffect(() => {
    if (!currentWorkspace || projects.length === 0) return;
    Promise.all(projects.map(p => api.getPhases(p.slug).catch(() => [] as Phase[])))
      .then(results => setAllPhases(results.flat()));
  }, [currentWorkspace?.slug, projects.length]);

  // Main fetch — fires when filters change, resets accumulated list
  useEffect(() => {
    if (!currentWorkspace) return;
    let cancelled = false;
    setTickets([]);
    setHasMore(false);
    setInitialLoading(true);
    nextPageRef.current = 2;
    isFetchingRef.current = false;

    const params: Record<string, string> = { workspace: currentWorkspace.slug, page: '1', page_size: String(PAGE_SIZE), ordering: '-created_at' };
    if (filterProject) params.project = filterProject;
    if (filterStatus) params.status = filterStatus;
    if (filterPriority) params.priority = filterPriority;
    if (filterAssigned) params.assigned_to = filterAssigned;
    if (filterPhase) params.phase = filterPhase;
    if (debouncedSearch) params.search = debouncedSearch;

    Promise.all([
      api.getTicketsPaginated(params),
      api.getProjects({ workspace: currentWorkspace.slug }),
      api.getUsers({ workspace: currentWorkspace.slug }),
    ]).then(([resp, p, u]) => {
      if (cancelled) return;
      setTickets(resp.results || []);
      setTotalCount(resp.count || 0);
      setHasMore(resp.next !== null);
      setProjects(p);
      setWsUsers(u);
    }).catch((e: any) => {
      if (!cancelled) toast(e?.message || 'Failed to load data', 'error');
    }).finally(() => {
      if (!cancelled) setInitialLoading(false);
    });

    return () => { cancelled = true; };
  }, [currentWorkspace?.slug, filterProject, filterStatus, filterPriority, filterAssigned, filterPhase, debouncedSearch, reloadKey]);

  // Fetch next page and append
  const fetchMore = useCallback(async () => {
    if (!currentWorkspace || !hasMore || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setFetchingMore(true);

    const params: Record<string, string> = {
      workspace: currentWorkspace.slug,
      page: String(nextPageRef.current),
      page_size: String(PAGE_SIZE),
      ordering: '-created_at',
    };
    if (filterProject) params.project = filterProject;
    if (filterStatus) params.status = filterStatus;
    if (filterPriority) params.priority = filterPriority;
    if (filterAssigned) params.assigned_to = filterAssigned;
    if (filterPhase) params.phase = filterPhase;
    if (debouncedSearch) params.search = debouncedSearch;

    try {
      const resp = await api.getTicketsPaginated(params);
      setTickets(prev => [...prev, ...(resp.results || [])]);
      setTotalCount(resp.count || 0);
      setHasMore(resp.next !== null);
      nextPageRef.current += 1;
    } catch (e: any) {
      toast(e?.message || 'Failed to load more', 'error');
    } finally {
      isFetchingRef.current = false;
      setFetchingMore(false);
    }
  }, [currentWorkspace?.slug, hasMore, filterProject, filterStatus, filterPriority, filterAssigned, filterPhase, debouncedSearch]);

  // IntersectionObserver — triggers fetchMore when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchMore(); },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMore]);

  // Scroll-to-top button visibility
  useEffect(() => {
    const handle = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  // Fetch project agents for visible tickets (for inline assign dropdown)
  useEffect(() => {
    const slugs = [...new Set(tickets.map(t => t.project))];
    slugs.forEach(slug => {
      if (!projectAgentsMap[slug]) {
        api.getProjectAgents(slug).then(agents => {
          setProjectAgentsMap(prev => ({ ...prev, [slug]: agents }));
        }).catch(() => {});
      }
    });
  }, [tickets]);

  // Fetch project agents when create modal project selection changes
  useEffect(() => {
    if (newProject) {
      api.getProjectAgents(newProject).then(setCreateProjectAgents).catch((err: any) => {
        toast(err?.detail || err?.message || 'Failed to load project agents', 'error');
        setCreateProjectAgents([]);
      });
    } else {
      setCreateProjectAgents([]);
    }
  }, [newProject]);

  // Build timeline: flat chronological list with date separators
  const timelineItems = useMemo(() => {
    type Item = { type: 'sep'; label: string } | { type: 'ticket'; ticket: Ticket };
    const items: Item[] = [];
    let lastLabel = '';
    for (const t of tickets) {
      const label = getDateLabel(t.created_at);
      if (label !== lastLabel) {
        items.push({ type: 'sep', label });
        lastLabel = label;
      }
      items.push({ type: 'ticket', ticket: t });
    }
    return items;
  }, [tickets]);

  const resetAndReload = useCallback(() => setReloadKey(k => k + 1), []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (!newTitle.trim() || !newProject) return;
    setCreating(true);
    try {
      await api.createTicket({
        project: newProject, title: newTitle, description: newDesc,
        priority: newPriority as any, ticket_type: newTicketType as any,
        ...(newAssigned ? { assigned_to: parseInt(newAssigned) } : {}),
      });
      toast('Ticket created');
      setShowCreate(false);
      setNewTitle(''); setNewDesc(''); setNewPriority('MEDIUM'); setNewTicketType('BUG'); setNewProject(''); setNewAssigned(''); setNewApproved(false);
      setFieldErrors({});
      resetAndReload();
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to create ticket', 'error');
    } finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteTicket(deleteTarget.ticket_slug);
      toast('Ticket deleted');
      setDeleteTarget(null);
      resetAndReload();
    } catch (e: any) { toast(e?.message || 'Failed to delete ticket', 'error'); }
  };

  const hasFilters = search || filterStatus || filterPriority || filterProject || filterAssigned || filterApproved || filterPhase;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">All Tickets</h1>
            <p className="text-sm text-gray-400 mt-1">
              {initialLoading
                ? <span className="animate-pulse">Loading…</span>
                : <>Showing {tickets.length} of {totalCount} ticket{totalCount !== 1 ? 's' : ''}</>
              }
              {hasFilters && <span className="text-indigo-500"> · filtered</span>}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Ticket
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-6">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-3 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full bg-[#1a1a2e] text-white placeholder-gray-500"
            placeholder="Search tickets…"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All statuses</option>
              {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select value={filterProject} onChange={e => {
              const val = e.target.value;
              const params = new URLSearchParams(window.location.search);
              if (val) params.set('project', val); else params.delete('project');
              window.location.href = `/private/${workspaceSlug}/tickets?${params.toString()}`;
            }} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All projects</option>
              {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
            <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All users</option>
              {wsUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
            </select>
            <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All phases</option>
              {allPhases.map(p => (
                <option key={p.id} value={p.id}>
                  {p.status === 'ACTIVE' ? '🟢' : '⬜'} {p.name}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterProject(''); setFilterAssigned(''); setFilterApproved(''); setFilterPhase(''); }} className="px-4 py-3 text-sm text-gray-500 hover:text-gray-300 min-h-[44px] rounded-xl hover:bg-[#1a1a2e] transition-colors">
              Clear filters
            </button>
          )}
        </div>

        {/* Timeline */}
        {initialLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-[#111118] rounded-xl border border-[#222233] p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-0.5 self-stretch bg-[#252540] rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[#252540] rounded w-20" />
                    <div className="h-4 bg-[#252540] rounded w-64" />
                    <div className="h-3 bg-[#252540] rounded w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-[#252540] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{hasFilters ? 'No matching tickets' : 'No tickets yet'}</h3>
            <p className="text-sm text-gray-400 mb-4">{hasFilters ? 'Try adjusting your filters.' : 'Create tickets from within a project.'}</p>
            {!hasFilters && (
              <button onClick={() => router.push(`/private/${workspaceSlug}/projects`)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                Go to Projects
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {timelineItems.map((item, idx) => {
              if (item.type === 'sep') {
                return (
                  <div key={`sep-${item.label}-${idx}`} className="pt-5 pb-1 px-1 flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest whitespace-nowrap">{item.label}</span>
                    <div className="flex-1 h-px bg-[#1e1e2e]" />
                  </div>
                );
              }

              const ticket = item.ticket;
              const project = projects.find(p => p.slug === ticket.project);

              return (
                <div
                  key={ticket.ticket_slug}
                  onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug}`)}
                  className="flex items-stretch gap-0 bg-[#111118] border border-[#222233] rounded-xl hover:border-[#333355] cursor-pointer transition-colors overflow-hidden"
                >
                  {/* Priority accent bar */}
                  <div className={`w-[3px] flex-shrink-0 ${PRIORITY_BAR[ticket.priority] || 'bg-gray-700'}`} />

                  <div className="flex-1 min-w-0 px-4 py-3">
                    {/* Top: project + slug */}
                    <div className="flex items-center gap-2 mb-1">
                      {project && (
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-900/30 text-indigo-400 cursor-pointer hover:bg-indigo-900/50"
                          onClick={e => { e.stopPropagation(); router.push(`/private/${workspaceSlug}/projects/${project.slug}`); }}
                        >
                          {project.name}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-gray-600">{ticket.ticket_slug}</span>
                      <span className="text-[10px] text-gray-600 ml-auto">
                        {new Date(ticket.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-medium text-white leading-snug">{ticket.title}</p>
                    {ticket.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                    )}

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge(statuses, ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                        {ticket.ticket_type === 'BUG' ? '🐛 Bug' : '✨ Feature'}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                      {ticket.phase_details && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          ticket.phase_details.status === 'ACTIVE' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-gray-800/50 text-gray-300'
                        }`}>
                          {ticket.phase_details.status === 'ACTIVE' ? '🟢' : '⬜'} {ticket.phase_details.name}
                        </span>
                      )}
                    </div>

                    {/* Assignee + status dropdowns */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                      <select
                        value={ticket.assigned_to?.toString() || ''}
                        onChange={async (e) => {
                          const val = e.target.value;
                          try {
                            const updated = await api.updateTicket(ticket.ticket_slug, { assigned_to: val ? parseInt(val) : null });
                            setTickets(prev => prev.map(t => t.ticket_slug === ticket.ticket_slug ? updated : t));
                            toast('Assignment updated');
                          } catch (err: any) { toast(err?.message || 'Failed to assign', 'error'); }
                        }}
                        className="text-xs sm:text-[11px] border border-[#222233] rounded px-2 py-1 sm:px-1.5 sm:py-0.5 bg-[#1a1a2e] text-gray-300 focus:ring-1 focus:ring-indigo-500 min-h-[36px] sm:min-h-[24px]"
                      >
                        <option value="">Unassigned</option>
                        {(projectAgentsMap[ticket.project] || wsUsers).map(a => (
                          <option key={a.id} value={String(a.id)}>{a.name || a.username}</option>
                        ))}
                      </select>
                      <select
                        value={ticket.status}
                        onChange={async (e) => {
                          try {
                            const updated = await api.updateTicket(ticket.ticket_slug, { status: e.target.value as Ticket['status'] });
                            setTickets(prev => prev.map(t => t.ticket_slug === ticket.ticket_slug ? updated : t));
                            toast('Status updated');
                          } catch (err: any) { toast(err?.message || 'Failed', 'error'); }
                        }}
                        className="text-xs sm:text-[11px] border border-[#222233] rounded px-2 py-1 sm:px-1.5 sm:py-0.5 bg-[#1a1a2e] text-gray-300 focus:ring-1 focus:ring-indigo-500 min-h-[36px] sm:min-h-[24px]"
                      >
                        {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="flex items-start pt-3 pr-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setDeleteTarget(ticket)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                      title="Delete ticket"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {/* Fetching more spinner */}
        {fetchingMore && (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
          </div>
        )}

        {/* End of history */}
        {!hasMore && !initialLoading && tickets.length > 0 && (
          <p className="text-center text-xs text-gray-700 py-6 tracking-wide">— beginning of history —</p>
        )}

        {/* Create Ticket Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-[#111118] w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl p-6 border border-[#222233]" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">New Ticket</h2>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <FormField label="Project" error={fieldErrors.project} required>
                  <select value={newProject} onChange={e => setNewProject(e.target.value)} className={selectClass(fieldErrors.project)} required>
                    <option value="">Select a project</option>
                    {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Title" error={fieldErrors.title} required>
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className={inputClass(fieldErrors.title)} placeholder="Ticket title" autoFocus />
                </FormField>
                <FormField label="Description" error={fieldErrors.description}>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className={`${inputClass(fieldErrors.description)} resize-none`} rows={3} placeholder="Describe the issue" />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Type" error={fieldErrors.ticket_type}>
                    <select value={newTicketType} onChange={e => setNewTicketType(e.target.value)} className={selectClass(fieldErrors.ticket_type)}>
                      <option value="BUG">🐛 Bug</option><option value="FEATURE">✨ Feature</option>
                    </select>
                  </FormField>
                  <FormField label="Priority" error={fieldErrors.priority}>
                    <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className={selectClass(fieldErrors.priority)}>
                      <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                    </select>
                  </FormField>
                </div>
                <FormField label="Assign To" error={fieldErrors.assigned_to}>
                  <select value={newAssigned} onChange={e => setNewAssigned(e.target.value)} className={selectClass(fieldErrors.assigned_to)}>
                    <option value="">Unassigned</option>
                    {createProjectAgents.map(u => <option key={u.id} value={String(u.id)}>{u.username} ({u.user_type})</option>)}
                  </select>
                </FormField>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newApproved} onChange={e => setNewApproved(e.target.checked)} className="w-5 h-5 rounded border-[#222233] text-indigo-400 bg-[#1a1a2e] focus:ring-indigo-500" />
                  <span className="text-sm text-gray-300">Pre-approve this ticket</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-3 border border-[#222233] rounded-xl text-sm font-medium text-gray-300 hover:bg-[#1a1a2e]">Cancel</button>
                  <button type="submit" disabled={creating || !newTitle.trim() || !newProject} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed">{creating ? 'Creating…' : 'Create Ticket'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Ticket"
          message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />

        {/* Scroll to top */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-6 w-10 h-10 bg-[#111118] border border-[#222233] text-gray-400 rounded-full shadow-lg flex items-center justify-center hover:text-white hover:border-indigo-500 transition-all z-40"
            title="Back to top"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </button>
        )}

        {/* Mobile FAB */}
        <button onClick={() => setShowCreate(true)} className="sm:hidden fixed bottom-20 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-40">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
    </Layout>
  );
}
