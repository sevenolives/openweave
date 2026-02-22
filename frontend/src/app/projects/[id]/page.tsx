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
  
  const { isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = parseInt(params.id as string);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }

    const fetchProjectData = async () => {
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

    fetchProjectData();
  }, [isLoggedIn, router, projectId]);

  const getTicketsByStatus = (status: string) => {
    return tickets.filter(ticket => ticket.status === status);
  };

  const getPriorityBadgeClass = (priority: string) => {
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'bg-gray-100 text-gray-700';
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => router.push('/projects')}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {project?.name || 'Loading…'}
                </h1>
                <p className="text-xs text-gray-500 truncate hidden sm:block">
                  {project?.description || ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

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
            {/* Ticket count summary */}
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-900">{tickets.length}</span> ticket{tickets.length !== 1 ? 's' : ''} total
            </div>

            {/* Mobile: Card list view */}
            <div className="md:hidden space-y-3">
              {STATUS_COLUMNS.map((column) => {
                const columnTickets = getTicketsByStatus(column.status);
                if (columnTickets.length === 0) return null;
                return (
                  <div key={column.status}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className={`w-2 h-2 rounded-full ${column.accent}`} />
                      <h3 className="text-sm font-semibold text-gray-700">{column.title}</h3>
                      <span className="text-xs text-gray-400">{columnTickets.length}</span>
                    </div>
                    <div className="space-y-2">
                      {columnTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          onClick={() => router.push(`/tickets/${ticket.id}`)}
                          className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-indigo-300 active:bg-gray-50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="font-medium text-gray-900 text-sm leading-snug">
                              {ticket.title}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${getPriorityBadgeClass(ticket.priority)}`}>
                              {ticket.priority}
                            </span>
                          </div>
                          <p className="text-gray-500 text-xs mb-2 line-clamp-2">{ticket.description}</p>
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>#{ticket.id}</span>
                            <span>{ticket.assigned_to_details ? ticket.assigned_to_details.username : 'Unassigned'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Kanban board */}
            <div className="hidden md:block overflow-x-auto kanban-scroll pb-4">
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
                          <div
                            key={ticket.id}
                            onClick={() => router.push(`/tickets/${ticket.id}`)}
                            className="bg-white rounded-lg border border-gray-100 p-3 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="text-xs text-gray-400">#{ticket.id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getPriorityBadgeClass(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                            </div>
                            <h4 className="font-medium text-gray-900 text-sm mb-1.5 line-clamp-2 group-hover:text-indigo-700 transition-colors">
                              {ticket.title}
                            </h4>
                            <p className="text-gray-500 text-xs mb-3 line-clamp-2">
                              {ticket.description}
                            </p>
                            <div className="flex items-center justify-between text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                {ticket.assigned_to_details ? (
                                  <>
                                    <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                                      <span className="text-[8px] text-white font-bold">
                                        {ticket.assigned_to_details.username[0].toUpperCase()}
                                      </span>
                                    </div>
                                    {ticket.assigned_to_details.username}
                                  </>
                                ) : (
                                  'Unassigned'
                                )}
                              </span>
                              <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                        {columnTickets.length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-xs">
                            No tickets
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
