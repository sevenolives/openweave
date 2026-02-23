'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { api, Project, Ticket, User } from '@/lib/api';

const STATUS_COLUMNS = [
  { status: 'OPEN', title: 'Open', accent: 'bg-gray-400', bg: 'bg-gray-50' },
  { status: 'IN_PROGRESS', title: 'In Progress', accent: 'bg-blue-500', bg: 'bg-blue-50' },
  { status: 'BLOCKED', title: 'Blocked', accent: 'bg-red-500', bg: 'bg-red-50' },
  { status: 'RESOLVED', title: 'Resolved', accent: 'bg-green-500', bg: 'bg-green-50' },
  { status: 'CLOSED', title: 'Closed', accent: 'bg-gray-400', bg: 'bg-gray-50' },
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  IN_TESTING: 'bg-purple-100 text-purple-700', BLOCKED: 'bg-red-100 text-red-700', RESOLVED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-200 text-gray-600',
};

export default function ProjectDetailPage() {
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'kanban' | 'list' | 'settings'>('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [creating, setCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [sortCol, setSortCol] = useState<'title' | 'status' | 'priority' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [movingTicket, setMovingTicket] = useState<number | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [projectAgents, setProjectAgents] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [memberSaving, setMemberSaving] = useState(false);

  const router = useRouter();
  const params = useParams();
  const projectId = parseInt(params.id as string);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const fetchData = async () => {
    try {
      const [p, t, agents] = await Promise.all([api.getProject(projectId), api.getTickets({ project: projectId.toString(), page_size: '100' }), api.getProjectAgents(projectId)]);
      setProject(p); setTickets(t); setProjectAgents(agents); setEditName(p.name); setEditDesc(p.description);
    } catch (e: any) { toast(e?.message || 'Failed to load project', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [projectId]);
  useEffect(() => {
    if (project?.workspace) {
      api.getUsers({ workspace: String(project.workspace) }).then(setAllUsers).catch(() => {});
    }
  }, [project?.workspace]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.createTicket({ project: projectId, title: title.trim(), description: desc.trim(), priority: priority as Ticket['priority'] });
      toast('Ticket created');
      setTitle(''); setDesc(''); setPriority('MEDIUM'); setShowCreate(false);
      await fetchData();
    } catch (e: any) { toast(e?.message || 'Failed to create ticket', 'error'); }
    finally { setCreating(false); }
  };

  const handleMoveTicket = async (ticketId: number, newStatus: string) => {
    setMovingTicket(null);
    try {
      await api.updateTicket(ticketId, { status: newStatus as Ticket['status'] });
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus as Ticket['status'] } : t));
      toast('Status updated');
    } catch (e: any) { toast(e?.message || 'Failed to update status', 'error'); }
  };

  const handleSaveSettings = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await api.updateProject(project.id, { name: editName, description: editDesc });
      setProject(updated);
      toast('Project updated');
    } catch (e: any) { toast(e?.message || 'Failed to update project', 'error'); }
    finally { setSaving(false); }
  };

  const handleAddMember = async () => {
    if (!project || !selectedUserId) return;
    setMemberSaving(true);
    try {
      const newIds = [...projectAgents.map(a => a.id), parseInt(selectedUserId)];
      await api.updateProject(project.id, { agent_ids: newIds });
      setProjectAgents(await api.getProjectAgents(project.id));
      setSelectedUserId('');
      toast('Member added');
    } catch (e: any) { toast(e?.message || 'Failed to add member', 'error'); }
    finally { setMemberSaving(false); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!project) return;
    setMemberSaving(true);
    try {
      const newIds = projectAgents.filter(a => a.id !== userId).map(a => a.id);
      await api.updateProject(project.id, { agent_ids: newIds });
      setProjectAgents(await api.getProjectAgents(project.id));
      toast('Member removed');
    } catch (e: any) { toast(e?.message || 'Failed to remove member', 'error'); }
    finally { setMemberSaving(false); }
  };

  const availableUsers = allUsers.filter(u => !projectAgents.some(a => a.id === u.id));

  const sortedTickets = [...tickets].sort((a, b) => {
    let cmp = 0;
    if (sortCol === 'title') cmp = a.title.localeCompare(b.title);
    else if (sortCol === 'status') cmp = a.status.localeCompare(b.status);
    else if (sortCol === 'priority') {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      cmp = (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    } else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    sortCol === col ? <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span> : null
  );

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-full mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : !project ? (
          <div className="text-center py-20 text-gray-500">Project not found</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500 mt-1">{project.description || 'No description'}</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors self-start">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Ticket
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
              {(['kanban', 'list', 'settings'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t === 'kanban' ? 'Kanban Board' : t === 'list' ? 'List View' : 'Settings'}
                </button>
              ))}
            </div>

            {/* Members sidebar-inline */}
            {tab !== 'settings' && projectAgents.length > 0 && (
              <div className="mb-6 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500">Members:</span>
                {projectAgents.map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${a.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                      {a.username[0].toUpperCase()}
                    </span>
                    {a.username}
                  </span>
                ))}
              </div>
            )}

            {/* Kanban Tab */}
            {tab === 'kanban' && (
              <>
                {tickets.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No tickets yet</h3>
                    <p className="text-sm text-gray-500 mb-4">Create your first ticket to get started.</p>
                    <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">Add Ticket</button>
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-4 kanban-scroll">
                    <div className="inline-flex gap-4 min-w-full">
                      {STATUS_COLUMNS.map(col => {
                        const colTickets = tickets.filter(t => t.status === col.status);
                        return (
                          <div key={col.status} className="flex flex-col w-64 lg:w-72 flex-shrink-0">
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-t-xl border border-b-0 border-gray-200">
                              <div className={`w-2 h-2 rounded-full ${col.accent}`} />
                              <h3 className="font-semibold text-gray-700 text-sm">{col.title}</h3>
                              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{colTickets.length}</span>
                            </div>
                            <div className={`${col.bg} border border-gray-200 rounded-b-xl p-2 min-h-[20rem] space-y-2 flex-1`}>
                              {colTickets.map(ticket => (
                                <div key={ticket.id} className="bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md hover:border-indigo-200 transition-all group relative">
                                  <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-xs text-gray-400">{ticket.ticket_slug || `#${ticket.id}`}</span>
                                    <div className="flex items-center gap-1">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                                      <button onClick={() => setMovingTicket(movingTicket === ticket.id ? null : ticket.id)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-all" title="Move">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                                      </button>
                                    </div>
                                  </div>
                                  <h4 onClick={() => router.push(`/tickets/${ticket.id}`)} className="font-medium text-gray-900 text-sm mb-1.5 line-clamp-2 cursor-pointer hover:text-indigo-700 transition-colors">{ticket.title}</h4>
                                  <div className="flex items-center justify-between text-xs text-gray-400">
                                    <span>{ticket.assigned_to_details?.username || 'Unassigned'}</span>
                                  </div>
                                  {/* Move dropdown */}
                                  {movingTicket === ticket.id && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-1">
                                      {STATUS_COLUMNS.filter(s => s.status !== ticket.status).map(s => (
                                        <button key={s.status} onClick={() => handleMoveTicket(ticket.id, s.status)} className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-md flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${s.accent}`} />{s.title}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {colTickets.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">No tickets</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* List Tab */}
            {tab === 'list' && (
              tickets.length === 0 ? (
                <div className="text-center py-16 text-sm text-gray-400">No tickets yet</div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th onClick={() => handleSort('title')} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Title<SortIcon col="title" /></th>
                        <th onClick={() => handleSort('status')} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Status<SortIcon col="status" /></th>
                        <th onClick={() => handleSort('priority')} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Priority<SortIcon col="priority" /></th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned</th>
                        <th onClick={() => handleSort('created_at')} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700">Created<SortIcon col="created_at" /></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedTickets.map(ticket => (
                        <tr key={ticket.id} onClick={() => router.push(`/tickets/${ticket.id}`)} className="hover:bg-gray-50 cursor-pointer">
                          <td className="px-5 py-3 text-sm font-medium text-gray-900">{ticket.ticket_slug || `#${ticket.id}`} {ticket.title}</td>
                          <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>{ticket.status.replace('_', ' ')}</span></td>
                          <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span></td>
                          <td className="px-5 py-3 text-sm text-gray-500">{ticket.assigned_to_details?.username || 'Unassigned'}</td>
                          <td className="px-5 py-3 text-sm text-gray-400">{new Date(ticket.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Settings Tab */}
            {tab === 'settings' && (
              <div className="space-y-6 max-w-lg">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" rows={4} />
                    </div>
                    <button onClick={handleSaveSettings} disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 transition-colors">
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                {isAdmin && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Members</h3>

                    {/* Current members */}
                    <div className="space-y-2 mb-4">
                      {projectAgents.length === 0 ? (
                        <p className="text-sm text-gray-400">No members yet.</p>
                      ) : (
                        projectAgents.map(agent => (
                          <div key={agent.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${agent.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                                {agent.username[0].toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{agent.username}</div>
                                {agent.name && (
                                  <div className="text-xs text-gray-500 truncate">{agent.name}</div>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 ${agent.user_type === 'BOT' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {agent.user_type}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(agent.id)}
                              disabled={memberSaving}
                              className="ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Remove member"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add member */}
                    {availableUsers.length > 0 && (
                      <div className="flex gap-2">
                        <select
                          value={selectedUserId}
                          onChange={e => setSelectedUserId(e.target.value)}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white min-h-[44px]"
                        >
                          <option value="">Select a user…</option>
                          {availableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.username} ({u.user_type})</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddMember}
                          disabled={!selectedUserId || memberSaving}
                          className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Create Ticket Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">New Ticket</h2>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Ticket title" autoFocus /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" rows={3} placeholder="Describe the issue" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Priority</label><select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating || !title.trim()} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{creating ? 'Creating…' : 'Create Ticket'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <button onClick={() => setShowCreate(true)} className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-40">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
      </button>
    </Layout>
  );
}
