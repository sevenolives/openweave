'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { api, DashboardStats, Ticket } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    api.getDashboard({ workspace: String(currentWorkspace.id) })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id]);

  const stats = data ? [
    { label: 'Total Tickets', value: data.total_tickets, color: 'bg-indigo-50 text-indigo-700', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', link: '/tickets' },
    { label: 'Open', value: data.open, color: 'bg-yellow-50 text-yellow-700', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', link: '/tickets?status=OPEN' },
    { label: 'In Progress', value: data.in_progress, color: 'bg-blue-50 text-blue-700', icon: 'M13 10V3L4 14h7v7l9-11h-7z', link: '/tickets?status=IN_PROGRESS' },
    { label: 'Blocked', value: data.blocked, color: 'bg-red-50 text-red-700', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', link: '/tickets?status=BLOCKED' },
    { label: 'In Testing', value: data.in_testing, color: 'bg-purple-50 text-purple-700', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', link: '/tickets?status=IN_TESTING' },
    { label: 'Review', value: data.review, color: 'bg-amber-50 text-amber-700', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', link: '/tickets?status=REVIEW' },
    { label: 'Completed Today', value: data.completed_today, color: 'bg-green-50 text-green-700', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', link: '/tickets?status=COMPLETED' },
  ] : [];

  const priorityColors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
  };
  const statusColors: Record<string, string> = {
    OPEN: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
    BLOCKED: 'bg-red-100 text-red-700', IN_TESTING: 'bg-purple-100 text-purple-700',
    REVIEW: 'bg-amber-100 text-amber-700', COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-200 text-gray-600',
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {user?.name || user?.username} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here&apos;s what&apos;s happening with your tickets today.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {stats.map(stat => (
                <div key={stat.label} onClick={() => stat.link && router.push(stat.link)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
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
              <button onClick={() => router.push('/tickets')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                New Ticket
              </button>
              <button onClick={() => router.push('/projects')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                New Project
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* My Tickets */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">My Tickets</h2>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-medium">{data.my_tickets}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.my_assigned.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No tickets assigned to you</div>
                  ) : (
                    data.my_assigned.map((ticket: Ticket) => (
                      <button key={ticket.id} onClick={() => router.push(`/tickets/${ticket.ticket_slug || ticket.id}`)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ticket.ticket_slug || `#${ticket.id}`} {ticket.title}</p>
                          <p className="text-xs text-gray-500">{ticket.project_name}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
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
                  {data.recent_tickets.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No recent activity</div>
                  ) : (
                    data.recent_tickets.map((ticket: Ticket) => (
                      <button key={ticket.id} onClick={() => router.push(`/tickets/${ticket.ticket_slug || ticket.id}`)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ticket.ticket_slug || `#${ticket.id}`} {ticket.title}</p>
                          <p className="text-xs text-gray-400">{new Date(ticket.updated_at).toLocaleString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[ticket.status]}`}>{ticket.status.replace('_', ' ')}</span>
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
