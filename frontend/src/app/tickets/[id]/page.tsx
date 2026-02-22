'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api, Ticket, Comment } from '@/lib/api';

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_COLORS = {
  OPEN: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  BLOCKED: 'bg-red-100 text-red-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
};

export default function TicketPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { user, isLoggedIn, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ticketId = parseInt(params.id as string);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }

    const fetchTicketData = async () => {
      try {
        const [ticketData, commentsData] = await Promise.all([
          api.getTicket(ticketId),
          api.getTicketComments(ticketId),
        ]);
        setTicket(ticketData);
        setComments(commentsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch ticket data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTicketData();
  }, [isLoggedIn, router, ticketId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !ticket) return;

    setIsSubmitting(true);
    try {
      const comment = await api.createComment({
        ticket: ticket.id,
        body: newComment.trim(),
      });
      setComments([...comments, comment]);
      setNewComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'bg-gray-100 text-gray-700';
  };

  const getStatusBadgeClass = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700';
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => ticket ? router.push(`/projects/${ticket.project}`) : router.back()}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  Ticket #{ticketId}
                </h1>
                {ticket && (
                  <p className="text-xs text-gray-500 truncate">{ticket.project_name}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : ticket ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Ticket Details Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">
                {ticket.title}
              </h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusBadgeClass(ticket.status)}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getPriorityBadgeClass(ticket.priority)}`}>
                  {ticket.priority}
                </span>
              </div>

              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {ticket.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Created by <span className="font-medium text-gray-700">{ticket.created_by_details.username}</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Assigned to <span className="font-medium text-gray-700">{ticket.assigned_to_details ? ticket.assigned_to_details.username : 'Unassigned'}</span></span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{new Date(ticket.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Updated {new Date(ticket.updated_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Comments <span className="text-gray-400 font-normal">({comments.length})</span>
              </h3>

              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-gray-400 text-center py-6 text-sm">
                    No comments yet
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white ${
                        comment.author_details.agent_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'
                      }`}>
                        {comment.author_details.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">
                            {comment.author_details.username}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            comment.author_details.agent_type === 'BOT'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {comment.author_details.agent_type}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{comment.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleSubmitComment}>
                <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 text-sm resize-none focus:outline-none placeholder-gray-400"
                    placeholder="Write a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <div className="flex justify-end px-3 py-2 bg-gray-50 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={isSubmitting || !newComment.trim()}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Sending…' : 'Comment'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500">Ticket not found</p>
          </div>
        )}
      </main>
    </div>
  );
}
