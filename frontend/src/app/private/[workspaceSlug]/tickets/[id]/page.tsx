'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass, selectClass } from '@/components/FormField';
import { useAuth } from '@/hooks/useAuth';
import { api, resolveMediaUrl, Ticket, Comment, User, TicketAttachment, ApiError, StatusDefinition, Phase } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';
import MentionText from '@/components/MentionText';
import MentionInput from '@/components/MentionInput';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-900/50 text-green-300', MEDIUM: 'bg-yellow-900/50 text-yellow-300',
  HIGH: 'bg-orange-900/50 text-orange-300', CRITICAL: 'bg-red-900/50 text-red-300',
};
const COLOR_BADGES: Record<string, string> = {
  gray: 'bg-gray-800/50 text-gray-300', blue: 'bg-blue-900/50 text-blue-300',
  red: 'bg-red-900/50 text-red-300', purple: 'bg-purple-900/50 text-purple-300',
  amber: 'bg-amber-900/50 text-amber-300', green: 'bg-green-900/50 text-green-300',
  yellow: 'bg-yellow-900/50 text-yellow-300', indigo: 'bg-indigo-900/50 text-indigo-300',
  pink: 'bg-pink-900/50 text-pink-300', orange: 'bg-orange-900/50 text-orange-300',
};
function statusBadge(statuses: StatusDefinition[], key: string): string {
  const sd = statuses.find(s => s.key === key);
  return sd ? (COLOR_BADGES[sd.color] || 'bg-gray-800/50 text-gray-300') : 'bg-gray-800/50 text-gray-300';
}
const ALL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function TicketDetailPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [projectAgents, setProjectAgents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editTicketType, setEditTicketType] = useState('BUG');
  const [editApproval, setEditApproval] = useState('UNAPPROVED');
  const [editAssigned, setEditAssigned] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [showDeleteComment, setShowDeleteComment] = useState<number | null>(null);
  const [commentsNext, setCommentsNext] = useState<string | null>(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const router = useRouter();
  const params = useParams<{ workspaceSlug: string; id: string }>();
  const workspaceSlug = params.workspaceSlug;
  const ticketId = params.id;
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (currentWorkspace) api.getStatusDefinitions(currentWorkspace.slug).then(setStatuses).catch((err: any) => {
      toast(err?.detail || err?.message || 'Failed to load status definitions', 'error');
    });
  }, [currentWorkspace?.slug]);

  const fetchData = async () => {
    try {
      const t = await api.getTicket(ticketId);
      const [cp, att] = await Promise.all([
        api.getCommentsPaginated({ ticket: t.ticket_slug, ordering: "created_at", page_size: "20" }),
        api.getAttachments({ ticket: t.ticket_slug }),
      ]);
      setTicket(t);
      setComments(cp.results);
      setCommentsNext(cp.next);
      setCommentsCount(cp.count);
      setAttachments(att);
      // Fetch project agents for assignment dropdowns (t.project is now the slug)
      try {
        const pAgents = await api.getProjectAgents(t.project);
        setAgents(pAgents); setProjectAgents(pAgents);
      } catch (err: any) {
        console.error('Failed to load project agents:', err);
        setAgents([]); setProjectAgents([]);
      }
      // Fetch phases for the ticket's project
      try {
        const ph = await api.getPhases(t.project);
        setPhases(ph);
      } catch { setPhases([]); }
      setEditTitle(t.title); setEditDesc(t.description); setEditStatus(t.status);
      setEditPriority(t.priority); setEditTicketType(t.ticket_type); setEditAssigned(t.assigned_to?.toString() || '');
    } catch (e: any) { toast(e?.message || 'Failed to load ticket', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [ticketId]);

  const handleStatusChange = async (status: string) => {
    if (!ticket) return;
    try {
      await api.updateTicket(ticket.ticket_slug, { status: status as Ticket['status'] });
      setTicket({ ...ticket, status: status as Ticket['status'] });
      toast('Status updated');
    } catch (e: any) { toast(e?.message || 'Failed to update status', 'error'); }
  };

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const updated = await api.updateTicket(ticket.ticket_slug, {
        title: editTitle, description: editDesc,
        status: editStatus as Ticket['status'], priority: editPriority as Ticket['priority'], ticket_type: editTicketType as Ticket['ticket_type'],
        assigned_to: editAssigned || null,
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
      const comment = await api.createComment({ ticket: ticket.ticket_slug as any, body: newComment.trim() });
      setComments([...comments, comment]);
      setCommentsCount(prev => prev + 1);
      setNewComment('');
      toast('Comment added');
    } catch (e: any) { toast(e?.message || 'Failed to add comment', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleLoadMore = async () => {
    if (!commentsNext || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.fetchUrl<import("@/lib/api").PaginatedResponse<Comment>>(commentsNext);
      setComments(prev => [...prev, ...page.results]);
      setCommentsNext(page.next);
    } catch (e: any) {
      toast(e?.message || "Failed to load more comments", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const canEditComment = (comment: Comment) => user?.id === comment.author;
  const canDeleteComment = (comment: Comment) =>
    user?.id === comment.author ||
    currentWorkspace?.owner === user?.id ||
    user?.role === "ADMIN";

  const handleEditComment = async (comment: Comment) => {
    if (!editingCommentBody.trim()) return;
    setCommentSubmitting(true);
    try {
      const updated = await api.updateComment(comment.id, { body: editingCommentBody.trim() });
      setComments(comments.map(c => c.id === comment.id ? updated : c));
      setEditingCommentId(null);
      toast("Comment updated");
    } catch (e: any) {
      toast(e?.message || "Failed to update comment", "error");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (id: number) => {
    try {
      await api.deleteComment(id);
      setComments(comments.filter(c => c.id !== id));
      setShowDeleteComment(null);
      toast("Comment deleted");
    } catch (e: any) {
      toast(e?.message || "Failed to delete comment", "error");
    }
  };

  const handleDelete = async () => {
    if (!ticket) return;
    try {
      await api.deleteTicket(ticket.ticket_slug);
      toast('Ticket deleted');
      router.back();
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
          <div className="text-center py-20 text-gray-400">Ticket not found</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ticket header */}
              <div className="bg-[#111118] rounded-xl border border-[#222233] p-5 sm:p-6">
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
                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={selectClass(fieldErrors.status)}>
                          {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Priority" error={fieldErrors.priority}>
                        <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className={selectClass(fieldErrors.priority)}>
                          {ALL_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Type" error={fieldErrors.ticket_type}>
                        <select value={editTicketType} onChange={e => setEditTicketType(e.target.value)} className={selectClass(fieldErrors.ticket_type)}>
                          <option value="BUG">🐛 Bug</option><option value="FEATURE">✨ Feature</option>
                        </select>
                      </FormField>
                      {/* approval field removed */}
                    </div>
                    <FormField label="Assigned To" error={fieldErrors.assigned_to}>
                      <select value={editAssigned} onChange={e => setEditAssigned(e.target.value)} className={selectClass(fieldErrors.assigned_to)}>
                        <option value="">Unassigned</option>
                        {projectAgents.map(a => <option key={a.id} value={a.username}>{a.username} ({a.user_type})</option>)}
                      </select>
                    </FormField>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setEditing(false)} className="px-4 py-2.5 border border-[#222233] rounded-xl text-sm font-medium text-gray-300 hover:bg-[#1a1a2e]">Cancel</button>
                      <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300">{saving ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">{ticket.ticket_slug}</span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusBadge(statuses, ticket.status)}`}>{statuses.find(s => s.key === ticket.status)?.label || ticket.status.replace(/_/g, ' ')}</span>
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-white">{ticket.title}</h1>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button onClick={() => setEditing(true)} className="p-2 rounded-lg hover:bg-[#1a1a2e] text-gray-400 hover:text-gray-300">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setShowDelete(true)} className="p-2 rounded-lg hover:bg-red-900/200/10 text-gray-400 hover:text-red-400">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-400 text-sm leading-relaxed mb-5">{ticket.description || 'No description provided.'}</p>

                    {/* Quick status change */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">Quick Status Change</label>
                      <div className="flex flex-wrap gap-2">
                        {statuses.map(s => (
                          <button key={s.key} onClick={() => handleStatusChange(s.key)}
                            className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[44px] sm:min-h-auto ${
                              ticket.status === s.key ? statusBadge(statuses, s.key) + ' ring-2 ring-offset-1 ring-current' : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#222233]'
                            }`}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* approval toggle removed */}
                  </>
                )}
              </div>

              {/* Comments / Activity tabs */}
              <div className="bg-[#111118] rounded-xl border border-[#222233]">
                <div className="flex border-b border-[#222233]">
                  <button onClick={() => setTab('comments')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'comments' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    Comments ({commentsCount || comments.length})
                  </button>
                  <button onClick={() => setTab('activity')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'activity' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                    Activity
                  </button>
                </div>

                <div className="p-5">
                  {tab === 'comments' ? (
                    <>
                      <div className="space-y-4 mb-6">
                        {comments.length === 0 ? (
                          <p className="text-gray-500 text-center py-6 text-sm">No comments yet — be the first!</p>
                        ) : comments.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white ${comment.author_details.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                              {comment.author_details.username[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-sm text-white">{comment.author_details.username}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${comment.author_details.user_type === 'BOT' ? 'bg-purple-900/50 text-purple-300' : 'bg-indigo-900/50 text-indigo-300'}`}>{comment.author_details.user_type}</span>
                                <span className="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                                <div className="flex-1" />
                                {canEditComment(comment) && editingCommentId !== comment.id && (
                                  <button
                                    onClick={() => { setEditingCommentId(comment.id); setEditingCommentBody(comment.body); }}
                                    className="text-xs text-gray-500 hover:text-indigo-400 transition-colors px-1"
                                    title="Edit comment"
                                  >
                                    Edit
                                  </button>
                                )}
                                {canDeleteComment(comment) && (
                                  <button
                                    onClick={() => setShowDeleteComment(comment.id)}
                                    className="text-xs text-gray-500 hover:text-red-400 transition-colors px-1"
                                    title="Delete comment"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                              {editingCommentId === comment.id ? (
                                <div className="mt-1">
                                  <textarea
                                    className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
                                    rows={3}
                                    value={editingCommentBody}
                                    onChange={e => setEditingCommentBody(e.target.value)}
                                    disabled={commentSubmitting}
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => handleEditComment(comment)}
                                      disabled={commentSubmitting || !editingCommentBody.trim()}
                                      className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {commentSubmitting ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                      onClick={() => setEditingCommentId(null)}
                                      disabled={commentSubmitting}
                                      className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs font-medium hover:bg-gray-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"><MentionText text={comment.body} /></p>
                              )}
                            </div>
                          </div>
                        ))}
                        {commentsNext && (
                          <div className="flex justify-center pt-2 pb-1">
                            <button
                              onClick={handleLoadMore}
                              disabled={loadingMore}
                              className="px-4 py-2 text-sm text-indigo-400 hover:text-indigo-300 border border-gray-700 hover:border-indigo-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {loadingMore ? "Loading…" : `Load more (${Math.max(0, commentsCount - comments.length)} remaining)`}
                            </button>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleComment}>
                        <div className="border-2 border-[#222233] rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                          <MentionInput value={newComment} onChange={setNewComment} members={projectAgents} disabled={submitting} />
                          <div className="flex justify-between items-center px-3 py-2.5 bg-[#0a0a0f] border-t border-[#222233] rounded-b-xl">
                            <span className="text-xs text-gray-400">{newComment.length > 0 ? `${newComment.length} chars` : ''}</span>
                            <button type="submit" disabled={submitting || !newComment.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors">
                              {submitting ? 'Sending…' : 'Add Comment'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Ticket created by <span className="font-medium text-gray-300">{ticket.created_by_details.username}</span></span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.created_at).toLocaleString()}</span>
                      </div>
                      {ticket.resolved_at && (
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Ticket resolved</span>
                          <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.resolved_at).toLocaleString()}</span>
                        </div>
                      )}
                      {ticket.closed_at && (
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span>Ticket closed</span>
                          <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.closed_at).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        <span>Last updated</span>
                        <span className="text-xs text-gray-400 ml-auto">{new Date(ticket.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <div className="bg-[#111118] rounded-xl border border-[#222233]">
                <div className="px-5 py-3 border-b border-[#222233] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-200">Attachments ({attachments.length})</h3>
                  <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${uploading ? 'bg-[#1a1a2e] text-gray-500' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-900/200/20'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    {uploading ? 'Uploading…' : 'Upload'}
                    <input type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip" disabled={uploading} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !ticket) return;
                      setUploading(true);
                      try {
                        const att = await api.uploadAttachment(ticket.ticket_slug, file);
                        setAttachments(prev => [att, ...prev]);
                        toast('File uploaded');
                      } catch (err: any) { toast(err?.message || 'Upload failed', 'error'); }
                      finally { setUploading(false); e.target.value = ''; }
                    }} />
                  </label>
                </div>
                <div className="p-5">
                  {attachments.length === 0 ? (
                    <p className="text-gray-500 text-center py-4 text-sm">No attachments yet</p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map(att => {
                        const name = (att.filename || '').toLowerCase();
                        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
                        const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(name);
                        const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name);
                        const mediaUrl = resolveMediaUrl(att.url);
                        return (
                        <div key={att.id} className="rounded-lg bg-[#1a1a2e] group overflow-hidden">
                          {isImage && (
                            <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={mediaUrl}
                                alt={att.filename}
                                className="w-full max-h-64 object-contain bg-[#0a0a0f] rounded-t-lg"
                                onError={(e) => {
                                  // Replace broken image with a file icon fallback
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const fallback = document.createElement('div');
                                  fallback.className = 'flex items-center gap-2 p-4 bg-[#0a0a0f] rounded-t-lg text-gray-500 text-sm';
                                  fallback.innerHTML = '<svg class="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span>Image not available</span>';
                                  target.parentElement?.appendChild(fallback);
                                }}
                              />
                            </a>
                          )}
                          {isVideo && (
                            <video controls className="w-full max-h-64 bg-black rounded-t-lg">
                              <source src={mediaUrl} />
                            </video>
                          )}
                          {isAudio && (
                            <div className="p-3 bg-[#0a0a0f] rounded-t-lg">
                              <audio controls className="w-full"><source src={mediaUrl} /></audio>
                            </div>
                          )}
                          <div className="flex items-center gap-3 p-2.5">
                          {!isImage && !isVideo && !isAudio && (
                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          )}
                          <div className="flex-1 min-w-0">
                            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 truncate block">{att.filename}</a>
                            <p className="text-xs text-gray-400">{att.uploaded_by_details?.username} · {new Date(att.created_at).toLocaleDateString()}</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await api.deleteAttachment(att.id);
                                setAttachments(prev => prev.filter(a => a.id !== att.id));
                                toast('Attachment deleted');
                              } catch (err: any) { toast(err?.message || 'Delete failed', 'error'); }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-gray-300 hover:text-red-400 hover:bg-red-900/200/10 transition-all"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                        </div>
                      );})}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Details card */}
              <div className="bg-[#111118] rounded-xl border border-[#222233] p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Details</h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Status</dt>
                    <dd><span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusBadge(statuses, ticket.status)}`}>{statuses.find(s => s.key === ticket.status)?.label || ticket.status.replace(/_/g, ' ')}</span></dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Priority</dt>
                    <dd><span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${PRIORITY_COLORS[ticket.priority]}`}>{ticket.priority}</span></dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Type</dt>
                    <dd><span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-800 text-gray-300">{ticket.ticket_type === 'BUG' ? '🐛 Bug' : '✨ Feature'}</span></dd>
                  </div>
                  {/* approved status removed */}
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Project</dt>
                    <dd><button onClick={() => router.push(`/private/${workspaceSlug}/projects/${ticket.project}`)} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">{ticket.project_name}</button></dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Phase</dt>
                    <dd>
                      <select
                        value={ticket.phase ?? ''}
                        onChange={async (e) => {
                          const val = e.target.value;
                          try {
                            const updated = await api.updateTicket(ticket.ticket_slug, { phase: val ? parseInt(val) : null } as any);
                            setTicket(updated);
                            toast('Phase updated');
                          } catch (err: any) { toast(err?.message || 'Failed to update phase', 'error'); }
                        }}
                        className="w-full px-3 py-2 border border-[#222233] rounded-lg text-sm bg-[#1a1a2e] text-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">No phase</option>
                        {phases.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.status === 'ACTIVE' ? '🟢' : '⬜'} {p.name}
                          </option>
                        ))}
                      </select>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Assigned To</dt>
                    <dd className="text-sm text-gray-300">
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
                    <dt className="text-xs font-medium text-gray-400 mb-1">Created By</dt>
                    <dd className="text-sm text-gray-300">{ticket.created_by_details.username}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Created</dt>
                    <dd className="text-sm text-gray-500">{new Date(ticket.created_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 mb-1">Updated</dt>
                    <dd className="text-sm text-gray-500">{new Date(ticket.updated_at).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              {/* Quick assign */}
              <div className="bg-[#111118] rounded-xl border border-[#222233] p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Quick Assign</h3>
                <select
                  value={ticket.assigned_to?.toString() || ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    try {
                      const updated = await api.updateTicket(ticket.ticket_slug, { assigned_to: val || null });
                      setTicket(updated);
                      toast('Assignment updated');
                    } catch (e: any) { toast(e?.message || 'Failed to assign', 'error'); }
                  }}
                  className="w-full px-4 py-3 border border-[#222233] rounded-xl text-sm bg-[#1a1a2e] text-white focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {projectAgents.map(a => <option key={a.id} value={a.username}>{a.username} ({a.user_type})</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog open={showDelete} title="Delete Ticket" message="Are you sure you want to delete this ticket? This action cannot be undone." onConfirm={handleDelete} onCancel={() => setShowDelete(false)} />
        <ConfirmDialog
          open={showDeleteComment !== null}
          title="Delete comment?"
          message="This action cannot be undone."
          onConfirm={() => showDeleteComment !== null && handleDeleteComment(showDeleteComment)}
          onCancel={() => setShowDeleteComment(null)}
        />
      </div>
    </Layout>
  );
}
