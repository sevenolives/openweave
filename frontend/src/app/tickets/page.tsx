'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { api, Ticket, Project, Agent } from '@/lib/api';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  BLOCKED: 'bg-red-100 text-red-700', RESOLVED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-200 text-gray-600',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [sortCol, setSortCol] = useState<'created_at' | 'priority' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([api.getTickets(), api.getProjects(), api.getAgents()])
      .then(([t, p, a]) => { setTickets(t); setProjects(p); setAgents(a); })
      .catch(() => toast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = tickets;
    if (search) result = result.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || `#${t.id}`.includes(search));
    if (filterStatus) result = result.filter(t => t.status === filterStatus);
    if (filterPriority) result = result.filter(t => t.priority === filterPriority);
    if (filterProject) result = result.filter(t => t.project === parseInt(filterProject));
    if (filterAgent) result = result.filter(t => t.assigned_to === parseInt(filterAgent));

    result.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'priority') {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        cmp = (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
      } else if (sortCol === 'status') cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [tickets, search, filterStatus, filterPriority, filterProject, filterAgent, sortCol, sortDir]);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(t => t.id)));
  };

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => sortCol === col ? <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span> : null;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
            <p className="text-sm text-gray-500 mt-1">{filtered.length} of {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets..." className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
            <option value="">All Statuses</option>
            {['OPEN','IN_PROGRESS','BLOCKED','RESOLVED','CLOSED'].map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
            <option value="">All Priorities</option>
            {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="hidden sm:block px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="hidden sm:block px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
            <option value="">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
          </select>
        </div>

        {/* Selected count */}
        {selected.size > 0 && (
          <div className="mb-4 px-4 py-2.5 bg-indigo-50 rounded-xl text-sm text-indigo-700 font-medium flex items-center gap-3">
            {selected.size} ticket{selected.size > 1 ? 's' : ''} selected
            <button onClick={() => setSelected(new Set())} className="text-indigo-500 hover:text-indigo-700 underline text-xs">Clear</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{tickets.length === 0 ? 'No tickets yet' : 'No matching tickets'}</h3>
            <p className="text-sm text-gray-500">{tickets.length === 0 ? 'Create a ticket from a project to get started.' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="pl-5 py-3 w-10"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ticket</th>
                  <th onClick={() => handleSort('status')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Status<SortIcon col="status" /></th>
                  <th onClick={() => handleSort('priority')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Priority<SortIcon col="priority" /></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Assigned</th>
                  <th onClick={() => handleSort('created_at')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 hidden sm:table-cell">Date<SortIcon col="created_at" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-gray-50 group">
                    <td className="pl-5 py-3"><input type="checkbox" checked={selected.has(ticket.id)} onChange={() => toggleSelect(ticket.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">#{ticket.id} {ticket.title}</p>
                    </td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>{ticket.status.replace('_',' ')}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{ticket.project_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{ticket.assigned_to_details?.username || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 hidden sm:table-cell">{new Date(ticket.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
