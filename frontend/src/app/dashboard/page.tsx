'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { api, Ticket, Project } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    const wsParams: Record<string, string> = currentWorkspace ? { workspace: String(currentWorkspace.id) } : {};
    Promise.all([api.getTickets(wsParams), api.getProjects(wsParams)])
      .then(([t, p]) => { setTickets(t); setProjects(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id]);

  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'OPEN').length;
  const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const today = new Date().toDateString();
  const resolvedToday = tickets.filter(t => t.resolved_at && new Date(t.resolved_at).toDateString() === today).length;
  const myTickets = tickets.filter(t => t.assigned_to === user?.id);
  const recentTickets = [...tickets].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8);

  const stats = [
    { label: 'Total Tickets', value: totalTickets, color: 'bg-indigo-50 text-indigo-700', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Open', value: openTickets, color: 'bg-yellow-50 text-yellow-700', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'In Progress', value: inProgress, color: 'bg-blue-50 text-blue-700', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'Resolved Today', value: resolvedToday, color: 'bg-green-50 text-green-700', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  const priorityColors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
  };

  const statusColors: Record<string, string> = {
    OPEN: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    BLOCKED: 'bg-red-100 text-red-700',
    RESOLVED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-200 text-gray-600',
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Welcome */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {user?.name || user?.username} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here&apos;s what&apos;s happening with your tickets today.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {stats.map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-500">{stat.label}</span>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button
                onClick={() => router.push('/tickets')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Ticket
              </button>
              <button
                onClick={() => router.push('/projects')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* My Tickets */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">My Tickets</h2>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">{myTickets.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {myTickets.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No tickets assigned to you</div>
                  ) : (
                    myTickets.slice(0, 5).map(ticket => (
                      <button
                        key={ticket.id}
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                          <p className="text-xs text-gray-500">{ticket.project_name}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${priorityColors[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Recent Activity</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {recentTickets.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No recent activity</div>
                  ) : (
                    recentTickets.map(ticket => (
                      <button
                        key={ticket.id}
                        onClick={() => router.push(`/tickets/${ticket.id}`)}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">#{ticket.id} {ticket.title}</p>
                          <p className="text-xs text-gray-400">{new Date(ticket.updated_at).toLocaleString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[ticket.status]}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
