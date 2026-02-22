'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { api, User, Ticket } from '@/lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterType, setFilterType] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([api.getUsers(), api.getTickets()])
      .then(([a, t]) => { setAgents(a); setTickets(t); })
      .catch(() => toast('Failed to load agents', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = agents;
    if (filterRole) result = result.filter(a => a.role === filterRole);
    if (filterType) result = result.filter(a => a.user_type === filterType);
    return result;
  }, [agents, filterRole, filterType]);

  const getAgentTickets = (agentId: number) => tickets.filter(t => t.assigned_to === agentId);

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">{agents.length} agent{agents.length !== 1 ? 's' : ''} registered</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
            <option value="">All Types</option>
            <option value="HUMAN">Human</option>
            <option value="BOT">Bot</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"><div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 bg-gray-200 rounded-full"></div><div className="flex-1"><div className="h-4 bg-gray-200 rounded w-24 mb-2"></div><div className="h-3 bg-gray-100 rounded w-32"></div></div></div></div>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No agents found</h3>
            <p className="text-sm text-gray-500">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(agent => {
              const agentTickets = getAgentTickets(agent.id);
              const openTickets = agentTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;
              return (
                <div key={agent.id} onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ${agent.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                      {agent.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{agent.first_name && agent.last_name ? `${agent.first_name} ${agent.last_name}` : agent.username}</h3>
                      <p className="text-xs text-gray-500 truncate">{agent.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${agent.user_type === 'BOT' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{agent.user_type}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${agent.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{agent.role}</span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${agent.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{agent.is_active ? 'Active' : 'Inactive'}</span>
                  </div>

                  {agent.skills && agent.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.skills.slice(0, 3).map((skill, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">{skill}</span>
                      ))}
                      {agent.skills.length > 3 && <span className="px-2 py-0.5 text-xs text-gray-400">+{agent.skills.length - 3}</span>}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                    <span>{agentTickets.length} ticket{agentTickets.length !== 1 ? 's' : ''} assigned</span>
                    <span>{openTickets} active</span>
                  </div>

                  {/* Expanded detail */}
                  {selectedAgent?.id === agent.id && agentTickets.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200 space-y-2" onClick={e => e.stopPropagation()}>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned Tickets</h4>
                      {agentTickets.slice(0, 5).map(ticket => (
                        <button key={ticket.id} onClick={() => router.push(`/tickets/${ticket.id}`)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <p className="text-sm font-medium text-gray-900 truncate">#{ticket.id} {ticket.title}</p>
                          <p className="text-xs text-gray-500">{ticket.project_name} · {ticket.status.replace('_',' ')}</p>
                        </button>
                      ))}
                      {agentTickets.length > 5 && <p className="text-xs text-gray-400 px-3">+{agentTickets.length - 5} more</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
