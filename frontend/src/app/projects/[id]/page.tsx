'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api, Project, Ticket } from '@/lib/api';

// Ticket status columns for kanban board
const STATUS_COLUMNS = [
  { status: 'OPEN', title: 'Open', color: 'bg-gray-100' },
  { status: 'IN_PROGRESS', title: 'In Progress', color: 'bg-blue-100' },
  { status: 'BLOCKED', title: 'Blocked', color: 'bg-red-100' },
  { status: 'RESOLVED', title: 'Resolved', color: 'bg-green-100' },
  { status: 'CLOSED', title: 'Closed', color: 'bg-gray-100' },
];

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
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
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'bg-gray-100 text-gray-800';
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/projects')}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to Projects
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {project?.name || 'Loading...'}
                </h1>
                <p className="text-sm text-gray-600">
                  {project?.description || ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : (
          <>
            {/* Mobile Card View (hidden on sm and up) */}
            <div className="sm:hidden">
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                    className="bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900 text-sm">
                        #{ticket.id} {ticket.title}
                      </h3>
                      <div className="flex flex-col items-end space-y-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeClass(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {ticket.description}
                    </p>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span>
                        {ticket.assigned_to_details ? ticket.assigned_to_details.username : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop Kanban View (hidden on mobile) */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-5 gap-4 h-full">
                {STATUS_COLUMNS.map((column) => {
                  const columnTickets = getTicketsByStatus(column.status);
                  
                  return (
                    <div key={column.status} className="flex flex-col">
                      <div className="bg-white p-4 rounded-t-lg border-b">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {column.title}
                        </h3>
                        <p className="text-gray-500 text-xs mt-1">
                          {columnTickets.length} ticket{columnTickets.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      
                      <div className={`${column.color} p-2 rounded-b-lg min-h-96 space-y-2`}>
                        {columnTickets.map((ticket) => (
                          <div
                            key={ticket.id}
                            onClick={() => router.push(`/tickets/${ticket.id}`)}
                            className="bg-white p-3 rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs text-gray-500">#{ticket.id}</span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeClass(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                            </div>
                            
                            <h4 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2">
                              {ticket.title}
                            </h4>
                            
                            <p className="text-gray-600 text-xs mb-3 line-clamp-3">
                              {ticket.description}
                            </p>
                            
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>
                                {ticket.assigned_to_details ? (
                                  <span className="flex items-center">
                                    <div className="w-4 h-4 bg-blue-500 rounded-full mr-1"></div>
                                    {ticket.assigned_to_details.username}
                                  </span>
                                ) : (
                                  'Unassigned'
                                )}
                              </span>
                              <span>
                                {new Date(ticket.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                        
                        {columnTickets.length === 0 && (
                          <div className="text-center py-8 text-gray-500 text-sm">
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