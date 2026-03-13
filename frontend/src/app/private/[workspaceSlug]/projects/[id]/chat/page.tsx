'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { api, Comment, Project } from '@/lib/api';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function dateKey(dateStr: string) {
  return new Date(dateStr).toDateString();
}

export default function ProjectChatPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const params = useParams<{ workspaceSlug: string; id: string }>();
  const workspaceSlug = params.workspaceSlug;
  const projectId = params.id;
  const { toast } = useToast();

  const fetchComments = useCallback(async () => {
    try {
      const data = await api.getComments({
        ticket__project: projectId,
        ordering: 'created_at',
      });
      setComments(data);
    } catch (e: any) {
      toast(e?.message || 'Failed to load comments', 'error');
    }
  }, [projectId, toast]);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getProject(parseInt(projectId));
        setProject(p);
      } catch {}
      await fetchComments();
      setLoading(false);
    })();
  }, [projectId, fetchComments]);

  // Auto-scroll to bottom when comments load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Auto-poll every 30s
  useEffect(() => {
    const interval = setInterval(fetchComments, 30000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  // Group comments by date
  const grouped: { date: string; comments: Comment[] }[] = [];
  let lastDate = '';
  for (const c of comments) {
    const dk = dateKey(c.created_at);
    if (dk !== lastDate) {
      grouped.push({ date: formatDate(c.created_at), comments: [c] });
      lastDate = dk;
    } else {
      grouped[grouped.length - 1].comments.push(c);
    }
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={() => router.push(`/private/${workspaceSlug}/projects/${projectId}`)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              💬 {project?.name || 'Project'} Activity
            </h1>
            <p className="text-xs text-gray-500">{comments.length} comments across all tickets</p>
          </div>
          <button
            onClick={() => { fetchComments(); toast('Refreshed'); }}
            className="ml-auto px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Chat feed */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 space-y-1 bg-gray-50">
          {loading ? (
            <div className="text-center text-gray-400 py-16">Loading…</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-gray-400 py-16">No comments yet. Activity from all tickets will appear here.</div>
          ) : (
            grouped.map((group) => (
              <div key={group.date}>
                {/* Date divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {group.comments.map((comment) => {
                  const isBot = comment.author_details?.user_type === 'BOT';
                  const initials = (comment.author_details?.username || '?')[0].toUpperCase();
                  return (
                    <div key={comment.id} className="flex gap-3 py-2 group hover:bg-white/60 rounded-lg px-2 transition-colors">
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${isBot ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Author + ticket ref + time */}
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            {isBot ? '🤖' : '👤'} {comment.author_details?.name || comment.author_details?.username || 'Unknown'}
                          </span>
                          {comment.ticket_details && (
                            <button
                              onClick={() => router.push(`/private/${workspaceSlug}/tickets/${comment.ticket_details!.id}`)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {comment.ticket_details.ticket_slug}: {comment.ticket_details.title}
                            </button>
                          )}
                          <span className="text-[11px] text-gray-400">{formatTime(comment.created_at)}</span>
                        </div>
                        {/* Body */}
                        <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{comment.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </Layout>
  );
}
