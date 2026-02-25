'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';

import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { api, Ticket, Project, User, WorkspaceMember, ApiError, PaginatedResponse, StatusDefinition } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
// Auth handled by (private) layout

const PAGE_SIZE = 10;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};

const COLOR_ACCENTS: Record<string, { accent: string; bg: string; badge: string }> = {
  gray:   { accent: 'bg-gray-400',   bg: 'bg-gray-50',   badge: 'bg-gray-100 text-gray-700' },
  blue:   { accent: 'bg-blue-500',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700' },
  red:    { accent: 'bg-red-500',    bg: 'bg-red-50',    badge: 'bg-red-100 text-red-700' },
  purple: { accent: 'bg-purple-500', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
  amber:  { accent: 'bg-amber-500',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700' },
  green:  { accent: 'bg-green-500',  bg: 'bg-green-50',  badge: 'bg-green-100 text-green-700' },
  yellow: { accent: 'bg-yellow-500', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700' },
  indigo: { accent: 'bg-indigo-500', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
  pink:   { accent: 'bg-pink-500',   bg: 'bg-pink-50',   badge: 'bg-pink-100 text-pink-700' },
  orange: { accent: 'bg-orange-500', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
};
const fallbackColor = { accent: 'bg-gray-400', bg: 'bg-gray-50', badge: 'bg-gray-100 text-gray-700' };
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
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => {
    if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('status') || '';
    return '';
  });
  const [filterPriority, setFilterPriority] = useState('');
  const [filterProjectInit] = useState<number | ''>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('project');
      if (p) return Number(p);
    }
    return '';
  });
  const [filterProject, setFilterProject] = useState<number | ''>(filterProjectInit);
  const [filterAssigned, setFilterAssigned] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newTicketType, setNewTicketType] = useState('BUG');
  const [newProject, setNewProject] = useState<number | ''>('');
  const [newAssigned, setNewAssigned] = useState<string>('');
  const [newApproved, setNewApproved] = useState(false);
  const [wsUsers, setWsUsers] = useState<User[]>([]);
  const [createProjectAgents, setCreateProjectAgents] = useState<User[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);
  const [projectAgentsMap, setProjectAgentsMap] = useState<Record<number, User[]>>({});
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const hasUserSelectedProject = useRef(!!filterProjectInit);
  const [kanbanTickets, setKanbanTickets] = useState<Ticket[]>([]);
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);

  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  // Auth gated by (private) layout — component only mounts when logged in

  // Initialize filters from URL params (runs once)
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) setFilterStatus(statusParam);
    const projectParam = searchParams.get('project');
    if (projectParam) setFilterProject(Number(projectParam));
    const priorityParam = searchParams.get('priority');
    if (priorityParam) setFilterPriority(priorityParam);
    const assignedParam = searchParams.get('assigned_to');
    if (assignedParam) setFilterAssigned(assignedParam);
  }, []);

  // Sync filters to URL so navigating back preserves context
  useEffect(() => {
    const basePath = `/private/${workspaceSlug}/tickets`;
    const params = new URLSearchParams();
    if (filterProject) params.set('project', String(filterProject));
    if (filterStatus) params.set('status', filterStatus);
    if (filterPriority) params.set('priority', filterPriority);
    if (filterAssigned) params.set('assigned_to', filterAssigned);
    const url = params.toString() ? `${basePath}?${params.toString()}` : basePath;
    window.history.replaceState(null, '', url);
  }, [filterProject, filterStatus, filterPriority, filterAssigned, workspaceSlug]);

  // Load status definitions
  useEffect(() => {
    if (currentWorkspace) {
      api.getStatusDefinitions(currentWorkspace.id).then(setStatuses).catch(() => {});
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    const wsParams: Record<string, string> = { workspace: String(currentWorkspace.id) };
    const ticketParams: Record<string, string> = { ...wsParams, page: String(page) };
    if (filterProject) ticketParams.project = String(filterProject);
    if (filterAssigned) ticketParams.assigned_to = filterAssigned;
    const membersPromise: Promise<User[]> = currentWorkspace
      ? api.getUsers({ workspace: String(currentWorkspace.id) })
      : Promise.resolve([]);
    Promise.all([api.getTicketsPaginated(ticketParams), api.getProjects(wsParams), membersPromise])
      .then(([resp, p, u]) => {
        setTickets(resp.results || []); setTotalCount(resp.count || 0); setProjects(p); setWsUsers(u);
        // Default is "All projects" — no auto-select
      })
      .catch((e: any) => toast(e?.message || 'Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id, page, filterProject, filterAssigned]);

  // Fetch project agents for all visible projects (for inline assign dropdown)
  useEffect(() => {
    const projectIds = [...new Set(tickets.map(t => t.project))];
    projectIds.forEach(pid => {
      if (!projectAgentsMap[pid]) {
        api.getProjectAgents(pid).then(agents => {
          setProjectAgentsMap(prev => ({ ...prev, [pid]: agents }));
        }).catch(() => {});
      }
    });
  }, [tickets]);

  // Fetch all tickets for kanban view when project is selected
  useEffect(() => {
    if (!filterProject || viewMode !== 'kanban') return;
    const kanbanParams: Record<string, string> = { project: String(filterProject), page_size: '100' };
    if (currentWorkspace) kanbanParams.workspace = String(currentWorkspace.id);
    api.getTickets(kanbanParams).then(setKanbanTickets).catch(() => {});
  }, [filterProject, viewMode]);

  // Fetch project agents when create modal project selection changes
  useEffect(() => {
    if (newProject) {
      api.getProjectAgents(newProject as number).then(setCreateProjectAgents).catch(() => setCreateProjectAgents([]));
    } else {
      setCreateProjectAgents([]);
    }
  }, [newProject]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterProject && t.project !== filterProject) return false;
      return true;
    });
  }, [tickets, search, filterStatus, filterPriority, filterProject]);

  // Group tickets by project
  const grouped = useMemo(() => {
    const groups: Record<number, { project: Project | null; tickets: Ticket[] }> = {};
    for (const t of filtered) {
      const pid = t.project;
      if (!groups[pid]) {
        groups[pid] = { project: projects.find(p => p.id === pid) || null, tickets: [] };
      }
      groups[pid].tickets.push(t);
    }
    return Object.values(groups).sort((a, b) => (a.project?.name || '').localeCompare(b.project?.name || ''));
  }, [filtered, projects]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const loadData = () => {
    if (!currentWorkspace) return;
    const wsParams: Record<string, string> = { workspace: String(currentWorkspace.id) };
    const ticketParams: Record<string, string> = { ...wsParams, page: String(page) };
    if (filterProject) ticketParams.project = String(filterProject);
    if (filterAssigned) ticketParams.assigned_to = filterAssigned;
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
        project: newProject as number, title: newTitle, description: newDesc,
        priority: newPriority as any, ticket_type: newTicketType as any,
        approved_status: newApproved ? 'APPROVED' : 'UNAPPROVED' as any,
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
      await api.deleteTicket(deleteTarget.id);
      toast('Ticket deleted');
      setDeleteTarget(null);
      loadData();
    } catch (e: any) { toast(e?.message || 'Failed to delete ticket', 'error'); }
  };

  const hasFilters = search || filterStatus || filterPriority || filterProject || filterAssigned;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Tickets</h1>
            <p className="text-sm text-gray-500 mt-1">
              {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} across {grouped.length} project{grouped.length !== 1 ? 's' : ''}
              {hasFilters && <span className="text-indigo-500"> (filtered)</span>}
            </p>
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Ticket
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
          <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>List</button>
          <button onClick={() => setViewMode('kanban')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Kanban</button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full sm:w-64"
            placeholder="Search tickets..."
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">All statuses</option>
            {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select value={filterProject} onChange={e => { hasUserSelectedProject.current = true; setFilterProject(Number(e.target.value) || ''); setPage(1); }} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterAssigned} onChange={e => { setFilterAssigned(e.target.value); setPage(1); }} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">All users</option>
            {wsUsers.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterProject(''); setFilterAssigned(''); }} className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700">
              Clear filters
            </button>
          )}
        </div>

        {/* Kanban View */}
        {viewMode === 'kanban' && !loading && (
          <div className="overflow-x-auto pb-4">
            <div className="inline-flex gap-4 min-w-full">
              {statuses.map(col => {
                const colTickets = kanbanTickets.filter(t => t.status === col.key);
                const c = colorFor(col.color);
                return (
                  <div key={col.key} className="flex flex-col w-64 lg:w-72 flex-shrink-0">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-t-xl border border-b-0 border-gray-200">
                      <div className={`w-2 h-2 rounded-full ${c.accent}`} />
                      <h3 className="font-semibold text-gray-700 text-sm">{col.label}</h3>
                      <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{colTickets.length}</span>
                    </div>
                    <div className={`${c.bg} border border-gray-200 rounded-b-xl p-2 min-h-[20rem] space-y-2 flex-1`}>
                      {colTickets.map(ticket => (
                        <div key={ticket.id} className="bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md hover:border-indigo-200 transition-all group">
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="text-xs text-gray-400">{ticket.ticket_slug || `#${ticket.id}`}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                          </div>
                          <h4 onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug || ticket.id}`)} className="font-medium text-gray-900 text-sm mb-1.5 line-clamp-2 cursor-pointer hover:text-indigo-700 transition-colors">{ticket.title}</h4>
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{ticket.assigned_to_details?.username || 'Unassigned'}</span>
                            <select
                              value={ticket.status}
                              onClick={e => e.stopPropagation()}
                              onChange={async (e) => {
                                try {
                                  await api.updateTicket(ticket.id, { status: e.target.value as Ticket['status'] });
                                  setKanbanTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: e.target.value as Ticket['status'] } : t));
                                  toast('Status updated');
                                } catch (err: any) { toast(err?.message || 'Failed', 'error'); }
                              }}
                              className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white"
                            >
                              {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                      {colTickets.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">No tickets</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && loading ? (
          <div className="space-y-4">
            {[1,2].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"><div className="h-5 bg-gray-200 rounded w-40 mb-4"></div><div className="h-12 bg-gray-100 rounded mb-2"></div><div className="h-12 bg-gray-100 rounded"></div></div>)}
          </div>
        ) : viewMode === 'list' && filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{hasFilters ? 'No matching tickets' : 'No tickets yet'}</h3>
            <p className="text-sm text-gray-500 mb-4">{hasFilters ? 'Try adjusting your filters.' : 'Create tickets from within a project.'}</p>
            {!hasFilters && (
              <button onClick={() => router.push(`/private/${workspaceSlug}/projects`)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                Go to Projects
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-6">
            {grouped.map(({ project, tickets: groupTickets }) => (
              <div key={project?.id || 0} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Project header */}
                <div
                  className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => project && router.push(`/private/${workspaceSlug}/projects/${project.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">{project?.name || 'Unknown Project'}</h2>
                      <p className="text-xs text-gray-500">{groupTickets.length} ticket{groupTickets.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
                
                {/* Tickets list */}
                <div className="divide-y divide-gray-100">
                  {groupTickets.map(ticket => (
                    <div key={ticket.id} onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug || ticket.id}`)} className="px-4 py-3 hover:bg-gray-50 cursor-pointer">
                      {/* Title row with delete */}
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 leading-snug">
                            <span className="text-[11px] text-gray-400 font-mono mr-1">{ticket.ticket_slug || `#${ticket.id}`}</span>
                            {ticket.title}
                          </p>
                          {ticket.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteTarget(ticket); }}
                          className="inline-flex items-center justify-center w-8 h-8 min-w-[44px] min-h-[44px] rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0 -mr-2 -mt-1"
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
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {ticket.ticket_type === 'BUG' ? '🐛 Bug' : '✨ Feature'}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const newStatus = ticket.approved_status === 'APPROVED' ? 'UNAPPROVED' : 'APPROVED';
                            try {
                              const updated = await api.updateTicket(ticket.id, { approved_status: newStatus } as any);
                              setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
                              toast(`Ticket ${newStatus.toLowerCase()}`);
                            } catch (err: any) { toast(err?.message || 'Failed to update', 'error'); }
                          }}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-all ${ticket.approved_status === 'APPROVED' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
                        >
                          {ticket.approved_status === 'APPROVED' ? '✓ Approved' : 'Approve'}
                        </button>
                      </div>
                      {/* Assignee row */}
                      <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
                        <select
                          value={ticket.assigned_to?.toString() || ''}
                          onChange={async (e) => {
                            const val = e.target.value;
                            try {
                              const updated = await api.updateTicket(ticket.id, { assigned_to: val ? parseInt(val) : null });
                              setTickets(prev => prev.map(t => t.id === ticket.id ? updated : t));
                              toast('Assignment updated');
                            } catch (err: any) { toast(err?.message || 'Failed to assign', 'error'); }
                          }}
                          className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Unassigned</option>
                          {(projectAgentsMap[ticket.project] || []).map(a => (
                            <option key={a.id} value={String(a.id)}>{a.username}</option>
                          ))}
                        </select>
                        <span className="text-[10px] text-gray-400 hidden sm:inline">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Pagination (list view only) */}
        {viewMode === 'list' && !loading && (
          <div className="flex items-center justify-between mt-6 px-1">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {totalCount} ticket{totalCount !== 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}

        {/* Create Ticket Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">New Ticket</h2>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <FormField label="Project" error={fieldErrors.project} required>
                  <select value={newProject} onChange={e => setNewProject(Number(e.target.value) || '')} className={`${inputClass(fieldErrors.project)} bg-white`} required>
                    <option value="">Select a project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                    <select value={newTicketType} onChange={e => setNewTicketType(e.target.value)} className={`${inputClass(fieldErrors.ticket_type)} bg-white`}>
                      <option value="BUG">🐛 Bug</option><option value="FEATURE">✨ Feature</option>
                    </select>
                  </FormField>
                  <FormField label="Priority" error={fieldErrors.priority}>
                    <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className={`${inputClass(fieldErrors.priority)} bg-white`}>
                      <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                    </select>
                  </FormField>
                </div>
                <FormField label="Assign To" error={fieldErrors.assigned_to}>
                  <select value={newAssigned} onChange={e => setNewAssigned(e.target.value)} className={`${inputClass(fieldErrors.assigned_to)} bg-white`}>
                    <option value="">Unassigned</option>
                    {createProjectAgents.map(u => <option key={u.id} value={String(u.id)}>{u.username} ({u.user_type})</option>)}
                  </select>
                </FormField>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={newApproved} onChange={e => setNewApproved(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">Pre-approve this ticket</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating || !newTitle.trim() || !newProject} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{creating ? 'Creating…' : 'Create Ticket'}</button>
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
