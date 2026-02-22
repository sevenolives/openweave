'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { useAuth } from '@/hooks/useAuth';
import { api, Ticket, Comment, User, ApiError } from '@/lib/api';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-700', MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700', CRITICAL: 'bg-red-100 text-red-700',
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-gray-100 text-gray-700', IN_PROGRESS: 'bg-blue-100 text-blue-700',
  BLOCKED: 'bg-red-100 text-red-700', RESOLVED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-200 text-gray-600',
};
const ALL_STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED', 'CLOSED'];
const ALL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function TicketDetailPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssigned, setEditAssigned] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');

  const router = useRouter();
  const params = useParams();
  const ticketId = parseInt(params.id as string);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchData = async () => {
    try {
      const [t, c, a] = await Promise.all([api.getTicket(ticketId), api.getComments({ ticket: ticketId.toString() }), api.getUsers()]);
      setTicket(t); setComments(c); setAgents(a);
      setEditTitle(t.title); setEditDesc(t.description); setEditStatus(t.status);
      setEditPriority(t.priority); setEditAssigned(t.assigned_to?.toString() || '');
    } catch (e: any) { toast(e?.message || 'Failed to load ticket', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [ticketId]);

  const handleStatusChange = async (status: string) => {
    if (!ticket) return;
    try {
      await api.updateTicket(ticket.id, { status: status as Ticket['status'] });
      setTicket({ ...ticket, status: status as Ticket['status'] });
      toast('Status updated');
    } catch (e: any) { toast(e?.message || 'Failed to update status', 'error'); }
  };

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const updated = await api.updateTicket(ticket.id, {
        title: editTitle, description: editDesc,
        status: editStatus as Ticket['status'], priority: editPriority as Ticket['priority'],
        assigned_to: editAssigned ? parseInt(editAssigned) : null,
      });
      setTicket(updated); setEditing(false);
      setFieldErrors({});
      toast('Ticket updated');
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to update ticket', 'error');
    }
    finally { setSaving(false); }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !ticket) return;
    setSubmitting(true);
    try {
      const comment = await api.createComment({ ticket: ticket.id, body: newComment.trim() });
      setComments([...comments, comment]);
      setNewComment('');
      toast('Comment added');
    } catch (e: any) { toast(e?.message || 'Failed to add comment', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!ticket) return;
    try {
      await api.deleteTicket(ticket.id);
      toast('Ticket deleted');
      router.push(`/projects/${ticket.project}`);
    } catch (e: any) { toast(e?.message || 'Failed to delete ticket', 'error'); }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : !ticket ? (
          <div className="text-center py-20 text-gray-500">Ticket not found</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ticket header */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                {editing ? (
                  <div className="space-y-4">
                    <FormField label="Title" error={fieldErrors.title} required>
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputClass(fieldErrors.title)} />
                    </FormField>
                    <FormField label="Description" error={fieldErrors.description}>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className={`${inputClass(fieldErrors.description)} resize-none`} rows={4} />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Status" error={fieldErrors.status}>
                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={`${inputClass(fieldErrors.status)} bg-white`}>
                          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Priority" error={fieldErrors.priority}>
                        <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className={`${inputClass(fieldErrors.priority)} bg-white`}>
                          {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </FormField>
                    </div>
                    <FormField label="Assigned To" error={fieldErrors.assigned_to}>
                      <select value={editAssigned} onChange={e => setEditAssigned(e.target.value)} className={`${inputClass(fieldErrors.assigned_to)} bg-white`}>
                        <option value="">Unassigned</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.username} ({a.user_type})</option>)}
                      </select>
                    </FormField>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setEditing(false)} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300">{saving ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">#{ticket.id}</span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>{ticket.status.replace('_',' ')}</span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{ticket.title}</h1>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button onClick={() => setEditing(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setShowDelete(true)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm leading-relaxed mb-5">{ticket.description || 'No description provided.'}</p>

                    {/* Quick status change */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Quick Status Change</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_STATUSES.map(s => (
                          <button key={s} onClick={() => handleStatusChange(s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              ticket.status === s ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}>
                            {s.replace('_',' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Comments / Activity tabs */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="flex border-b border-gray-200">
                  <button onClick={() => setTab('comments')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'comments' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    Comments ({comments.length})
                  </button>
                  <button onClick={() => setTab('activity')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'activity' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    Activity
                  </button>
                </div>

                <div className="p-5">
                  {tab === 'comments' ? (
                    <>
                      <div className="space-y-4 mb-6">
                        {comments.length === 0 ? (
                          <p className="text-gray-400 text-center py-6 text-sm">No comments yet — be the first!</p>
                        ) : comments.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white ${comment.author_details.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                              {comment.author_details.username[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-sm text-gray-900">{comment.author_details.username}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${comment.author_details.user_type === 'BOT' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'}`}>{comment.author_details.user_type}</span>
                                <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleComment}>
                        <div className="border-2 border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                          <textarea rows={3} className="w-full px-4 py-3 text-sm resize-none focus:outline-none placeholder-gray-400" placeholder="Write a comment…" value={newComment} onChange={e => setNewComment(e.target.value)} disabled={submitting} />
                          <div className="flex justify-between items-center px-3 py-2.5 bg-gray-50 border-t border-gray-100">
                            <span className="text-xs text-gray-400">{newComment.length > 0 ? `${newComment.length} chars` : ''}</span>
                            <button type="submit" disabled={submitting || !newComment.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                              {submitting ? 'Sending…' : 'Add Comment'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Ticket created by <span className="font-medium text-gray-700">{ticket.created_by_details.username}</span></span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.created_at).toLocaleString()}</span>
                      </div>
                      {ticket.resolved_at && (
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Ticket resolved</span>
                          <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.resolved_at).toLocaleString()}</span>
                        </div>
                      )}
                      {ticket.closed_at && (
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span>Ticket closed</span>
                          <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.closed_at).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        <span>Last updated</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Details card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Details</h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Status</dt>
                    <dd><span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_COLORS[ticket.status]}`}>{ticket.status.replace('_',' ')}</span></dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Priority</dt>
                    <dd><span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span></dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Project</dt>
                    <dd><button onClick={() => router.push(`/projects/${ticket.project}`)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">{ticket.project_name}</button></dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Assigned To</dt>
                    <dd className="text-sm text-gray-700">
                      {ticket.assigned_to_details ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${ticket.assigned_to_details.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                            {ticket.assigned_to_details.username[0].toUpperCase()}
                          </span>
                          {ticket.assigned_to_details.username}
                        </span>
                      ) : 'Unassigned'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Created By</dt>
                    <dd className="text-sm text-gray-700">{ticket.created_by_details.username}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Created</dt>
                    <dd className="text-sm text-gray-500">{new Date(ticket.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Updated</dt>
                    <dd className="text-sm text-gray-500">{new Date(ticket.updated_at).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              {/* Quick assign */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Assign</h3>
                <select
                  value={ticket.assigned_to?.toString() || ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    try {
                      const updated = await api.updateTicket(ticket.id, { assigned_to: val ? parseInt(val) : null });
                      setTicket(updated);
                      toast('Assignment updated');
                    } catch (e: any) { toast(e?.message || 'Failed to assign', 'error'); }
                  }}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.username} ({a.user_type})</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog open={showDelete} title="Delete Ticket" message="Are you sure you want to delete this ticket? This action cannot be undone." onConfirm={handleDelete} onCancel={() => setShowDelete(false)} />
      </div>
    </Layout>
  );
}
