'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api, Ticket, Comment } from '@/lib/api';

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const STATUS_COLORS = {
  OPEN: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  BLOCKED: 'bg-red-100 text-red-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
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
    return PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeClass = (status: string) => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800';
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => ticket ? router.push(`/projects/${ticket.project}`) : router.back()}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Ticket #{ticketId}
                </h1>
                {ticket && (
                  <p className="text-sm text-gray-600">
                    {ticket.project_name}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        ) : ticket ? (
          <div className="space-y-6">
            {/* Ticket Details Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {ticket.title}
                  </h2>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(ticket.status)}`}>
                      {ticket.status.replace('_', ' ')}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityBadgeClass(ticket.priority)}`}>
                      {ticket.priority} Priority
                    </span>
                  </div>
                </div>
              </div>

              <div className="prose max-w-none mb-6">
                <p className="text-gray-700">{ticket.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <strong>Created by:</strong> {ticket.created_by_details.username}
                </div>
                <div>
                  <strong>Assigned to:</strong> {
                    ticket.assigned_to_details ? ticket.assigned_to_details.username : 'Unassigned'
                  }
                </div>
                <div>
                  <strong>Created:</strong> {new Date(ticket.created_at).toLocaleString()}
                </div>
                <div>
                  <strong>Updated:</strong> {new Date(ticket.updated_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Comments ({comments.length})
              </h3>

              {/* Comments List */}
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No comments yet. Be the first to add one!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="border-l-4 border-blue-200 pl-4 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {comment.author_details.username}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            comment.author_details.agent_type === 'BOT' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {comment.author_details.agent_type}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700">{comment.body}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleSubmitComment} className="space-y-3">
                <div>
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                    Add a comment
                  </label>
                  <textarea
                    id="comment"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Write your comment here..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Comment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500">Ticket not found</div>
          </div>
        )}
      </main>
    </div>
  );
}