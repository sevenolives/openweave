'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api, Project, Ticket } from '@/lib/api';

const STATUS_COLUMNS = [
  { status: 'OPEN', title: 'Open', color: 'bg-gray-50', accent: 'bg-gray-400' },
  { status: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-50', accent: 'bg-blue-500' },
  { status: 'BLOCKED', title: 'Blocked', color: 'bg-red-50', accent: 'bg-red-500' },
  { status: 'RESOLVED', title: 'Resolved', color: 'bg-green-50', accent: 'bg-green-500' },
  { status: 'CLOSED', title: 'Closed', color: 'bg-gray-50', accent: 'bg-gray-400' },
];

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export default function ProjectPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [isCreating, setIsCreating] = useState(false);

  const { isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = parseInt(params.id as string);

  const fetchData = async () => {
    try {
      const [projectData, ticketsData] = await Promise.all([
        api.getProject(projectId),
        api.getProjectTickets(projectId),
      ]);
      setProject(projectData);
      setTickets(ticketsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) { router.push('/login'); return; }
    fetchData();
  }, [isLoggedIn, router, projectId]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      await api.createTicket({ project: projectId, title: newTitle.trim(), description: newDesc.trim(), priority: newPriority as Ticket['priority'] });
      setNewTitle(''); setNewDesc(''); setNewPriority('MEDIUM'); setShowNewTicket(false);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally { setIsCreating(false); }
  };

  const getTicketsByStatus = (status: string) => tickets.filter(t => t.status === status);
  const getPriorityBadgeClass = (priority: string) => PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'bg-gray-100 text-gray-700';

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => router.push('/projects')}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {project?.name || 'Loading…'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Desktop New Ticket button */}
              <button
                onClick={() => setShowNewTicket(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Ticket
              </button>
              <button
                onClick={() => logout()}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 min-h-[44px]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowNewTicket(false)}>
          <div className="bg-white w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Ticket title" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" rows={3} placeholder="Describe the issue" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewTicket(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]">Cancel</button>
                <button type="submit" disabled={isCreating || !newTitle.trim()} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-h-[44px]">
                  {isCreating ? 'Creating…' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-900">{tickets.length}</span> ticket{tickets.length !== 1 ? 's' : ''} total
            </div>

            {/* Mobile: Stacked columns */}
            <div className="md:hidden space-y-6">
              {STATUS_COLUMNS.map((column) => {
                const columnTickets = getTicketsByStatus(column.status);
                return (
                  <div key={column.status}>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${column.accent}`} />
                      <h3 className="text-sm font-bold text-gray-800">{column.title}</h3>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{columnTickets.length}</span>
                    </div>
                    {columnTickets.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-xs bg-white rounded-xl border border-gray-200">No tickets</div>
                    ) : (
                      <div className="space-y-2">
                        {columnTickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            onClick={() => router.push(`/tickets/${ticket.id}`)}
                            className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 transition-all min-h-[44px]"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h4 className="font-medium text-gray-900 text-sm leading-snug">{ticket.title}</h4>
                              <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${getPriorityBadgeClass(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                            </div>
                            <p className="text-gray-500 text-xs mb-2 line-clamp-2">{ticket.description}</p>
                            <div className="flex items-center justify-between text-xs text-gray-400">
                              <span>#{ticket.id}</span>
                              <span>{ticket.assigned_to_details ? ticket.assigned_to_details.username : 'Unassigned'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop: Kanban board */}
            <div className="hidden md:block overflow-x-auto pb-4">
              <div className="inline-flex gap-4 min-w-full">
                {STATUS_COLUMNS.map((column) => {
                  const columnTickets = getTicketsByStatus(column.status);
                  return (
                    <div key={column.status} className="flex flex-col w-64 lg:w-72 flex-shrink-0">
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-t-xl border border-b-0 border-gray-200">
                        <div className={`w-2 h-2 rounded-full ${column.accent}`} />
                        <h3 className="font-semibold text-gray-700 text-sm">{column.title}</h3>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{columnTickets.length}</span>
                      </div>
                      <div className={`${column.color} border border-gray-200 rounded-b-xl p-2 min-h-[24rem] space-y-2 flex-1`}>
                        {columnTickets.map((ticket) => (
                          <div key={ticket.id} onClick={() => router.push(`/tickets/${ticket.id}`)}
                            className="bg-white rounded-lg border border-gray-100 p-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="text-xs text-gray-400">#{ticket.id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getPriorityBadgeClass(ticket.priority)}`}>{ticket.priority}</span>
                            </div>
                            <h4 className="font-medium text-gray-900 text-sm mb-1.5 line-clamp-2 group-hover:text-indigo-700 transition-colors">{ticket.title}</h4>
                            <p className="text-gray-500 text-xs mb-3 line-clamp-2">{ticket.description}</p>
                            <div className="flex items-center justify-between text-xs text-gray-400">
                              <span>{ticket.assigned_to_details ? ticket.assigned_to_details.username : 'Unassigned'}</span>
                              <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                        {columnTickets.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">No tickets</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowNewTicket(true)}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-40"
        aria-label="New Ticket"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
