'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import Layout from '@/components/Layout';
import PieChart from '@/components/PieChart';
import type { PieSlice } from '@/components/PieChart';
import { useAuth } from '@/hooks/useAuth';
import { api, DashboardStats, ProjectsDashboard, Ticket, StatusDefinition } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/components/Toast';

// Map color tokens to tailwind classes
const COLOR_MAP: Record<string, { bg: string; text: string; badge: string }> = {
  gray:   { bg: 'bg-gray-900/30',   text: 'text-gray-300',   badge: 'bg-gray-800/50 text-gray-300' },
  blue:   { bg: 'bg-blue-900/30',   text: 'text-blue-300',   badge: 'bg-blue-900/50 text-blue-300' },
  red:    { bg: 'bg-red-900/30',    text: 'text-red-300',    badge: 'bg-red-900/50 text-red-300' },
  purple: { bg: 'bg-purple-900/30', text: 'text-purple-300', badge: 'bg-purple-900/50 text-purple-300' },
  amber:  { bg: 'bg-amber-900/30',  text: 'text-amber-300',  badge: 'bg-amber-900/50 text-amber-300' },
  green:  { bg: 'bg-green-900/30',  text: 'text-green-300',  badge: 'bg-green-900/50 text-green-300' },
  yellow: { bg: 'bg-yellow-900/30', text: 'text-yellow-300', badge: 'bg-yellow-900/50 text-yellow-300' },
  indigo: { bg: 'bg-indigo-900/30', text: 'text-indigo-300', badge: 'bg-indigo-900/50 text-indigo-300' },
  pink:   { bg: 'bg-pink-900/30',   text: 'text-pink-300',   badge: 'bg-pink-900/50 text-pink-300' },
  orange: { bg: 'bg-orange-900/30', text: 'text-orange-300', badge: 'bg-orange-900/50 text-orange-300' },
};
const fallback = { bg: 'bg-gray-900/30', text: 'text-gray-300', badge: 'bg-gray-800/50 text-gray-300' };
function colorFor(color: string) { return COLOR_MAP[color] || fallback; }

export function statusBadgeClass(statuses: StatusDefinition[], statusKey: string): string {
  const sd = statuses.find(s => s.key === statusKey);
  return sd ? colorFor(sd.color).badge : fallback.badge;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    Promise.all([
      api.getDashboard({ workspace: currentWorkspace.slug }),
      api.getProjectsDashboard(currentWorkspace.slug),
    ])
      .then(([dashboard, projects]) => {
        setData(dashboard);
        setProjectsData(projects);
      })
      .catch((err: any) => {
        const message = err?.detail || err?.message || 'Failed to load dashboard';
        toast(message, 'error');
      })
      .finally(() => setLoading(false));
  }, [currentWorkspace?.slug]);

  const priorityColors: Record<string, string> = {
    LOW: 'bg-green-900/50 text-green-300', MEDIUM: 'bg-yellow-900/50 text-yellow-300',
    HIGH: 'bg-orange-900/50 text-orange-300', CRITICAL: 'bg-red-900/50 text-red-300',
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome back, {user?.name || user?.username} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-1">Here&apos;s what&apos;s happening with your tickets today.</p>
        </div>

        {!loading && data && data.total_projects === 0 ? (
          <div className="max-w-3xl mx-auto mt-4">
            <div className="bg-[#111118] rounded-2xl border border-[#222233] p-8 sm:p-10 text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Welcome to OpenWeave! 🎉</h2>
              <p className="text-gray-400 max-w-lg mx-auto">
                OpenWeave enforces what your AI agents can do using state machines with gate-based permissions.
                Get started by setting up your first project.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => router.push(`/private/${workspaceSlug}/projects`)}
                className="bg-[#111118] rounded-xl border border-[#222233] p-6 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:bg-indigo-900/200/20 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                </div>
                <h3 className="font-semibold text-white mb-1">Create a Project</h3>
                <p className="text-sm text-gray-400">Set up your first project to start tracking work.</p>
              </button>

              <button
                onClick={() => router.push(`/private/${workspaceSlug}/settings`)}
                className="bg-[#111118] rounded-xl border border-[#222233] p-6 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="font-semibold text-white mb-1">Invite Team Members</h3>
                <p className="text-sm text-gray-400">Collaborate with your team on projects and tickets.</p>
              </button>

              <button
                onClick={() => router.push(`/private/${workspaceSlug}/state-machine`)}
                className="bg-[#111118] rounded-xl border border-[#222233] p-6 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="font-semibold text-white mb-1">Explore the Demo</h3>
                <p className="text-sm text-gray-400">See how state machines and gate-based permissions work.</p>
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="bg-[#111118] rounded-xl border border-[#222233] p-5 animate-pulse">
                <div className="h-4 bg-[#252540] rounded w-20 mb-3"></div>
                <div className="h-8 bg-[#252540] rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : data && (
          <>
            {/* Stats — dynamic from status definitions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total */}
              <div onClick={() => router.push(`/private/${workspaceSlug}/tickets`)} className="bg-[#111118] rounded-xl border border-[#222233] p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-400">Total Tickets</span>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-900/20 text-indigo-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{data.total_tickets}</p>
              </div>
              {/* Per-status cards */}
              {data.statuses.map(sd => {
                const c = colorFor(sd.color);
                const count = data.status_counts[sd.key] || 0;
                return (
                  <div key={sd.key} onClick={() => router.push(`/private/${workspaceSlug}/tickets?status=${sd.key}`)} className="bg-[#111118] rounded-xl border border-[#222233] p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-400">{sd.label}</span>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg} ${c.text}`}>
                        <span className="text-xs font-bold">{sd.key.charAt(0)}</span>
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-white">{count}</p>
                  </div>
                );
              })}
              {/* Completed today */}
              <div onClick={() => router.push(`/private/${workspaceSlug}/tickets?status=COMPLETED`)} className="bg-[#111118] rounded-xl border border-[#222233] p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-400">Completed Today</span>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-900/20 text-green-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{data.completed_today}</p>
              </div>
            </div>

            {/* Ticket Status Breakdown — Pie Chart */}
            {data.total_tickets > 0 && (() => {
              const slices: PieSlice[] = data.statuses
                .filter(sd => (data.status_counts[sd.key] || 0) > 0)
                .map(sd => ({
                  label: sd.label,
                  value: data.status_counts[sd.key] || 0,
                  color: sd.color,
                }));
              return (
                <div className="bg-[#111118] rounded-xl border border-[#222233] p-5 mb-8">
                  <h2 className="font-semibold text-white mb-4">Ticket Status Breakdown</h2>
                  <div className="flex justify-center">
                    <PieChart slices={slices} size={220} donut />
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 mb-8">
              <button onClick={() => router.push(`/private/${workspaceSlug}/tickets`)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                New Ticket
              </button>
              <button onClick={() => router.push(`/private/${workspaceSlug}/projects`)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1a1a2e] border border-[#222233] text-gray-300 rounded-xl text-sm font-medium hover:bg-[#1a1a2e] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                New Project
              </button>
            </div>

            {/* Project Cards with Member Workload */}
            {projectsData && projectsData.projects.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Projects</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projectsData.projects.map(project => (
                    <div
                      key={project.slug}
                      onClick={() => router.push(`/private/${workspaceSlug}/projects/${project.slug}`)}
                      className="bg-[#111118] rounded-xl border border-[#222233] p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white truncate">{project.name}</h3>
                        <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
                          {project.total_tickets} ticket{project.total_tickets !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {project.members.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Team</p>
                          {project.members.map(member => (
                            <div key={member.username} className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${member.user_type === 'BOT' ? 'bg-purple-600' : 'bg-indigo-600'}`}>
                                {member.user_type === 'BOT' ? '🤖' : (member.name?.[0] || member.username[0]).toUpperCase()}
                              </div>
                              <span className="text-xs text-gray-300 truncate flex-1">{member.name || member.username}</span>
                              {member.tickets > 0 && (
                                <span className="text-[10px] text-gray-400 bg-[#1a1a2e] px-1.5 py-0.5 rounded flex-shrink-0">
                                  {member.tickets}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* My Tickets */}
              <div className="bg-[#111118] rounded-xl border border-[#222233]">
                <div className="px-5 py-4 border-b border-[#222233] flex items-center justify-between">
                  <h2 className="font-semibold text-white">My Tickets</h2>
                  <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-full font-medium">{data.my_tickets}</span>
                </div>
                <div className="divide-y divide-[#222233]">
                  {data.my_assigned.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No tickets assigned to you</div>
                  ) : (
                    data.my_assigned.map((ticket: Ticket) => (
                      <button key={ticket.ticket_slug} onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug}`)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#1a1a2e] transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{ticket.ticket_slug} {ticket.title}</p>
                          <p className="text-xs text-gray-500">{ticket.project_name}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-[#111118] rounded-xl border border-[#222233]">
                <div className="px-5 py-4 border-b border-[#222233]">
                  <h2 className="font-semibold text-white">Recent Activity</h2>
                </div>
                <div className="divide-y divide-[#222233]">
                  {data.recent_tickets.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No recent activity</div>
                  ) : (
                    data.recent_tickets.map((ticket: Ticket) => (
                      <button key={ticket.ticket_slug} onClick={() => router.push(`/private/${workspaceSlug}/tickets/${ticket.ticket_slug}`)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#1a1a2e] transition-colors text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{ticket.ticket_slug} {ticket.title}</p>
                          <p className="text-xs text-gray-400">{new Date(ticket.updated_at).toLocaleString()}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusBadgeClass(data.statuses, ticket.status)}`}>{ticket.status.replace(/_/g, ' ')}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            {/* Team & Workload — merged, uses agent_workload data (no extra queries) */}
            {data.members && data.members.length > 0 && (() => {
              const workloadMap = Object.fromEntries((data.agent_workload || []).map((a: any) => [a.username, a]));
              return (
              <div className="bg-[#111118] rounded-xl border border-[#222233] p-5">
                <h2 className="text-lg font-semibold text-white mb-4">Team ({data.members.length})</h2>
                <div className="space-y-2">
                  {data.members.map((m: any) => {
                    const workload = workloadMap[m.username];
                    return (
                      <div key={m.username} className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0a0f]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${m.user_type === 'BOT' ? 'bg-purple-600' : 'bg-indigo-600'}`}>
                          {m.username[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{m.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${m.user_type === 'BOT' ? 'bg-purple-500/20 text-purple-300' : 'bg-indigo-500/20 text-indigo-300'}`}>{m.user_type}</span>
                            {m.role === 'OWNER' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">OWNER</span>}
                          </div>
                          {workload && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(workload.statuses as Record<string, number>).map(([status, count]) => {
                                const sd = data.statuses?.find((s: any) => s.key === status);
                                const label = sd?.label || status.replace(/_/g, ' ');
                                return (
                                  <span key={status} className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a2e] text-gray-400">
                                    {label}: {count as number}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-lg font-bold text-white">{workload?.total || 0}</span>
                          <p className="text-[10px] text-gray-500">tickets</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}
          </>
        )}
      </div>
    </Layout>
  );
}
