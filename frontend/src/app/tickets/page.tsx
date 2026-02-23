'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { api, Ticket, Project, ApiError, PaginatedResponse } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

const PAGE_SIZE = 20;

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  IN_TESTING: 'bg-purple-100 text-purple-700', BLOCKED: 'bg-red-100 text-red-700', RESOLVED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-200 text-gray-600',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newTicketType, setNewTicketType] = useState('BUG');
  const [newProject, setNewProject] = useState<number | ''>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);

  const router = useRouter();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    setLoading(true);
    const wsParams: Record<string, string> = currentWorkspace ? { workspace: String(currentWorkspace.id) } : {};
    const ticketParams = { ...wsParams, page: String(page) };
    Promise.all([api.getTicketsPaginated(ticketParams), api.getProjects(wsParams)])
      .then(([resp, p]) => { setTickets(resp.results || []); setTotalCount(resp.count || 0); setProjects(p); })
      .catch((e: any) => toast(e?.message || 'Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id, page]);

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tickets, search, filterStatus, filterPriority]);

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
    const wsParams: Record<string, string> = currentWorkspace ? { workspace: String(currentWorkspace.id) } : {};
    const ticketParams = { ...wsParams, page: String(page) };
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
      await api.createTicket({ project: newProject as number, title: newTitle, description: newDesc, priority: newPriority as any, ticket_type: newTicketType as any });
      toast('Ticket created');
      setShowCreate(false);
      setNewTitle(''); setNewDesc(''); setNewPriority('MEDIUM'); setNewTicketType('BUG'); setNewProject('');
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

  const hasFilters = search || filterStatus || filterPriority;

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
          <button onClick={() => setShowCreate(true)} className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Ticket
          </button>
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
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_TESTING">In Testing</option>
            <option value="BLOCKED">Blocked</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); }} className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700">
              Clear filters
            </button>
          )}
        </div>

        {/* Content grouped by project */}
        {loading ? (
          <div className="space-y-4">
            {[1,2].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"><div className="h-5 bg-gray-200 rounded w-40 mb-4"></div><div className="h-12 bg-gray-100 rounded mb-2"></div><div className="h-12 bg-gray-100 rounded"></div></div>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{hasFilters ? 'No matching tickets' : 'No tickets yet'}</h3>
            <p className="text-sm text-gray-500 mb-4">{hasFilters ? 'Try adjusting your filters.' : 'Create tickets from within a project.'}</p>
            {!hasFilters && (
              <button onClick={() => router.push('/projects')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
                Go to Projects
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ project, tickets: groupTickets }) => (
              <div key={project?.id || 0} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Project header */}
                <div
                  className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => project && router.push(`/projects/${project.id}`)}
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
                
                {/* Tickets table */}
                <table className="w-full">
                  <tbody className="divide-y divide-gray-100">
                    {groupTickets.map(ticket => (
                      <tr key={ticket.id} onClick={() => router.push(`/tickets/${ticket.id}`)} className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 font-mono w-8">#{ticket.id}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                              {ticket.assigned_to_details && (
                                <p className="text-xs text-gray-500 mt-0.5">→ {ticket.assigned_to_details.username}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[ticket.status]}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {ticket.ticket_type === 'BUG' ? '🐛 Bug' : '✨ Feature'}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ticket.approved_status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {ticket.approved_status === 'APPROVED' ? '✓ Approved' : 'Unapproved'}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[ticket.priority]}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span className="text-xs text-gray-400 mr-2">{new Date(ticket.created_at).toLocaleDateString()}</span>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTarget(ticket); }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete ticket"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
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
        <button onClick={() => setShowCreate(true)} className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-40">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
    </Layout>
  );
}
