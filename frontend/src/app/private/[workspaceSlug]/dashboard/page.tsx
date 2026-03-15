'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { api, DashboardStats, Ticket, StatusDefinition } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

// Map color tokens to tailwind classes
const COLOR_MAP: Record<string, { bg: string; text: string; badge: string }> = {
  gray:   { bg: 'bg-gray-50',   text: 'text-gray-700',   badge: 'bg-gray-100 text-gray-700' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  badge: 'bg-green-100 text-green-700' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
  pink:   { bg: 'bg-pink-50',   text: 'text-pink-700',   badge: 'bg-pink-100 text-pink-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
};
const fallback = { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' };
function colorFor(color: string) { return COLOR_MAP[color] || fallback; }

export function statusBadgeClass(statuses: StatusDefinition[], statusKey: string): string {
  const sd = statuses.find(s => s.key === statusKey);
  return sd ? colorFor(sd.color).badge : fallback.badge;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    api.getDashboard({ workspace: currentWorkspace.slug })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id]);

  const priorityColors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
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

        {!loading && data && data.total_projects === 0 ? (
          <div className="max-w-3xl mx-auto mt-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Welcome to OpenWeave! 🎉</h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                OpenWeave enforces what your AI agents can do using state machines with gate-based permissions.
                Get started by setting up your first project.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => router.push(`/private/${workspaceSlug}/projects`)}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-indigo-200 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Create a Project</h3>
                <p className="text-sm text-gray-500">Set up your first project to start tracking work.</p>
              </button>

              <button
                onClick={() => router.push(`/private/${workspaceSlug}/settings`)}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-indigo-200 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Invite Team Members</h3>
                <p className="text-sm text-gray-500">Collaborate with your team on projects and tickets.</p>
              </button>

              <button
                onClick={() => router.push(`/private/${workspaceSlug}/state-machine`)}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-indigo-200 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-4 group-hover:bg-green-100 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Explore the Demo</h3>
                <p className="text-sm text-gray-500">See how state machines and gate-based permissions work.</p>
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-20 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : data && (
          <>
            {/* Stats — dynamic from status definitions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total */}
              <div onClick={() => router.push(`/private/${workspaceSlug}/tickets`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">Total Tickets</span>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-700">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{data.total_tickets}</p>
              </div>
              {/* Per-status cards */}
              {data.statuses.map(sd => {
                const c = colorFor(sd.color);
                const count = data.status_counts[sd.key] || 0;
                return (
                  <div key={sd.key} onClick={() => router.push(`/private/${workspaceSlug}/tickets?status=${sd.key}`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">{sd.label}</span>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg} ${c.text}`}>
                        <span className="text-xs font-bold">{sd.key.charAt(0)}</span>
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900">{count}</p>
                  </div>
                );
              })}
              {/* Completed today */}
              <div onClick={() => router.push(`/private/${workspaceSlug}/tickets?status=COMPLETED`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">Completed Today</span>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50 text-green-700">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{data.completed_today}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button onClick={() => router.push(`/private/${workspaceSlug}/tickets`)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                New Ticket
              </button>
              <button onClick={() => router.push(`/private/${workspaceSlug}/projects`)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
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
                      <button key={ticket.id} onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug || ticket.id}`)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
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
                      <button key={ticket.id} onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug || ticket.id}`)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{ticket.ticket_slug || `#${ticket.id}`} {ticket.title}</p>
                          <p className="text-xs text-gray-400">{new Date(ticket.updated_at).toLocaleString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusBadgeClass(data.statuses, ticket.status)}`}>{ticket.status.replace(/_/g, ' ')}</span>
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
