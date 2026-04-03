'use client';

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';

import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass, selectClass } from '@/components/FormField';
import { api, Ticket, Project, User, WorkspaceMember, ApiError, PaginatedResponse, StatusDefinition, Phase } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
// Auth handled by (private) layout

const PAGE_SIZE = 10;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-900/50 text-green-300', MEDIUM: 'bg-yellow-900/50 text-yellow-300',
  HIGH: 'bg-orange-900/50 text-orange-300', CRITICAL: 'bg-red-900/50 text-red-300',
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

export default function TicketsPageWrapper() {
  return (
    <Suspense fallback={<Layout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div></div></Layout>}>
      <TicketsPage />
    </Suspense>
  );
}

function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = parseInt(new URLSearchParams(window.location.search).get('page') || '', 10);
      return p > 0 ? p : 1;
    }
    return 1;
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('search') || '';
    return '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('search') || '';
    return '';
  });

  // Debounce search input
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
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newTicketType, setNewTicketType] = useState('BUG');
  const [newProject, setNewProject] = useState<string>('');
  const [newAssigned, setNewAssigned] = useState<string>('');
  const [newApproved, setNewApproved] = useState(false);
  const [wsUsers, setWsUsers] = useState<User[]>([]);
  const [createProjectAgents, setCreateProjectAgents] = useState<User[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);
  const [projectAgentsMap, setProjectAgentsMap] = useState<Record<string, User[]>>({});
  const hasUserSelectedProject = useRef(!!filterProjectInit);
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);

  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  // Auth gated by (private) layout — component only mounts when logged in

  // Filters are initialized from URL via useState initializers above

  // Sync filters to URL so navigating back preserves context
  useEffect(() => {
    const basePath = `/private/${workspaceSlug}/tickets`;
    const params = new URLSearchParams();
    if (filterProject) params.set('project', String(filterProject));
    if (filterStatus) params.set('status', filterStatus);
    if (filterPriority) params.set('priority', filterPriority);
    if (filterAssigned) params.set('assigned_to', filterAssigned);
    if (filterPhase) params.set('phase', filterPhase);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (page > 1) params.set('page', String(page));
    const url = params.toString() ? `${basePath}?${params.toString()}` : basePath;
    window.history.replaceState(null, '', url);
  }, [filterProject, filterStatus, filterPriority, filterAssigned, filterApproved, filterPhase, debouncedSearch, page, workspaceSlug]);

  // Load status definitions
  useEffect(() => {
    if (currentWorkspace) {
      api.getStatusDefinitions(currentWorkspace.slug).then(setStatuses).catch((err: any) => {
        toast(err?.detail || err?.message || 'Failed to load status definitions', 'error');
      });
    }
  }, [currentWorkspace?.slug]);

  // Load all phases for the workspace (for filter + badges)
  useEffect(() => {
    if (!currentWorkspace || projects.length === 0) return;
    Promise.all(projects.map(p => api.getPhases(p.slug).catch(() => [] as Phase[])))
      .then(results => setAllPhases(results.flat()));
  }, [currentWorkspace?.slug, projects.length]);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    const wsParams: Record<string, string> = { workspace: currentWorkspace.slug };
    const ticketParams: Record<string, string> = { ...wsParams, page: String(page) };
    if (filterProject) ticketParams.project = String(filterProject);
    if (filterStatus) ticketParams.status = filterStatus;
    if (filterPriority) ticketParams.priority = filterPriority;
    if (filterAssigned) ticketParams.assigned_to = filterAssigned;
    if (filterPhase) ticketParams.phase = filterPhase;
    if (debouncedSearch) ticketParams.search = debouncedSearch;
    const membersPromise: Promise<User[]> = api.getUsers({ workspace: currentWorkspace.slug });
    Promise.all([api.getTicketsPaginated(ticketParams), api.getProjects(wsParams), membersPromise])
      .then(([resp, p, u]) => {
        setTickets(resp.results || []); setTotalCount(resp.count || 0); setProjects(p); setWsUsers(u);
      })
      .catch((e: any) => toast(e?.message || 'Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, [currentWorkspace?.slug, page, filterProject, filterStatus, filterPriority, filterAssigned, filterApproved, filterPhase, debouncedSearch]);

  // Fetch project agents for all visible projects (for inline assign dropdown)
  useEffect(() => {
    const projectSlugs = [...new Set(tickets.map(t => t.project))];
    projectSlugs.forEach(slug => {
      if (!projectAgentsMap[slug]) {
        api.getProjectAgents(slug).then(agents => {
          setProjectAgentsMap(prev => ({ ...prev, [slug]: agents }));
        }).catch(() => { /* best-effort background fetch */ });
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

  // Group tickets by project (all filtering is backend-driven)
  const grouped = useMemo(() => {
    const groups: Record<string, { project: Project | null; tickets: Ticket[] }> = {};
    for (const t of tickets) {
      const pslug = t.project;
      if (!groups[pslug]) {
        groups[pslug] = { project: projects.find(p => p.slug === pslug) || null, tickets: [] };
      }
      groups[pslug].tickets.push(t);
    }
    return Object.values(groups).sort((a, b) => (a.project?.name || '').localeCompare(b.project?.name || ''));
  }, [tickets, projects]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const loadData = () => {
    if (!currentWorkspace) return;
    const wsParams: Record<string, string> = { workspace: currentWorkspace.slug };
    const ticketParams: Record<string, string> = { ...wsParams, page: String(page) };
    if (filterProject) ticketParams.project = filterProject;
    if (filterStatus) ticketParams.status = filterStatus;
    if (filterPriority) ticketParams.priority = filterPriority;
    if (filterAssigned) ticketParams.assigned_to = filterAssigned;
    if (filterPhase) ticketParams.phase = filterPhase;
    if (debouncedSearch) ticketParams.search = debouncedSearch;
    Promise.all([api.getTicketsPaginated(ticketParams), api.getProjects(wsParams)])
      .then(([resp, p]) => { setTickets(resp.results || []); setTotalCount(resp.count || 0); setProjects(p); })
      .catch((e: any) => toast(e?.message || 'Failed to load data', 'error'));
  };

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
      loadData();
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to create ticket', 'error');
    }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteTicket(deleteTarget.ticket_slug);
      toast('Ticket deleted');
      setDeleteTarget(null);
      loadData();
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
              {totalCount} ticket{totalCount !== 1 ? 's' : ''} across {grouped.length} project{grouped.length !== 1 ? 's' : ''}
              {hasFilters && <span className="text-indigo-500"> (filtered)</span>}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Ticket
          </button>
        </div>

        {/* List View */}

        {/* Filters */}
        <div className="space-y-3 mb-6">
          <input
            type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-3 border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full bg-[#1a1a2e] text-white placeholder-gray-500"
            placeholder="Search tickets..."
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
            <select value={filterProject} onChange={e => { hasUserSelectedProject.current = true; setFilterProject(e.target.value); setPage(1); }} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All projects</option>
              {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
            <select value={filterAssigned} onChange={e => { setFilterAssigned(e.target.value); setPage(1); }} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All users</option>
              {wsUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
            </select>
            <select value={filterPhase} onChange={e => { setFilterPhase(e.target.value); setPage(1); }} className="px-4 py-3 min-h-[44px] border border-[#222233] rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-[#1a1a2e] text-white">
              <option value="">All phases</option>
              {allPhases.map(p => (
                <option key={p.id} value={p.id}>
                  {p.status === 'ACTIVE' ? '🟢' : p.status === 'COMPLETED' ? '✅' : '⬜'} {p.name}
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

        {loading ? (
          <div className="space-y-4">
            {[1,2].map(i => <div key={i} className="bg-[#111118] rounded-xl border border-[#222233] p-6 animate-pulse"><div className="h-5 bg-[#252540] rounded w-40 mb-4"></div><div className="h-12 bg-[#252540] rounded mb-2"></div><div className="h-12 bg-[#252540] rounded"></div></div>)}
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
          <div className="space-y-6">
            {grouped.map(({ project, tickets: groupTickets }) => (
              <div key={project?.id || 0} className="bg-[#111118] rounded-xl border border-[#222233] overflow-hidden">
                {/* Project header */}
                <div
                  className="px-5 py-3 bg-[#0a0a0f] border-b border-[#222233] flex items-center justify-between cursor-pointer hover:bg-[#1a1a2e] transition-colors"
                  onClick={() => project && router.push(`/private/${workspaceSlug}/projects/${project.slug}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">{project?.name || 'Unknown Project'}</h2>
                      <p className="text-xs text-gray-500">{groupTickets.length} ticket{groupTickets.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
                
                {/* Tickets list */}
                <div className="divide-y divide-[#222233]">
                  {groupTickets.map(ticket => (
                    <div key={ticket.ticket_slug} onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug}`)} className="px-4 py-3 hover:bg-[#1a1a2e] cursor-pointer">
                      {/* Title row with delete */}
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white leading-snug">
                            <span className="text-[11px] text-gray-400 font-mono mr-1">{ticket.ticket_slug}</span>
                            {ticket.title}
                          </p>
                          {ticket.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(ticket); }}
                          className="inline-flex items-center justify-center w-8 h-8 min-w-[44px] min-h-[44px] rounded-lg text-red-400 hover:text-red-400 hover:bg-red-900/200/10 transition-colors flex-shrink-0 -mr-2 -mt-1"
                          title="Delete ticket"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
                            ticket.phase_details.status === 'ACTIVE' ? 'bg-emerald-900/50 text-emerald-300' :
                            ticket.phase_details.status === 'COMPLETED' ? 'bg-blue-900/50 text-blue-300' :
                            'bg-gray-800/50 text-gray-300'
                          }`}>
                            {ticket.phase_details.status === 'ACTIVE' ? '🟢' : ticket.phase_details.status === 'COMPLETED' ? '✅' : '⬜'} {ticket.phase_details.name}
                          </span>
                        )}
                      </div>
                      {/* Assignee + Status row */}
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
                        <span className="text-[10px] text-gray-400 hidden sm:inline">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <div className="flex items-center justify-between mt-6 px-1">
            <p className="text-sm text-gray-400">Page {page} of {totalPages} · {totalCount} ticket{totalCount !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 text-sm font-medium border border-[#222233] rounded-lg hover:bg-[#1a1a2e] text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 text-sm font-medium border border-[#222233] rounded-lg hover:bg-[#1a1a2e] text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
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

        {/* Mobile FAB */}
        <button onClick={() => setShowCreate(true)} className="sm:hidden fixed bottom-20 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-40">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
    </Layout>
  );
}
