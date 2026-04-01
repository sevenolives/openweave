'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { api, Comment, Project } from '@/lib/api';
import MentionText from '@/components/MentionText';

const PAGE_SIZE = 50;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState(2);
  const [totalCount, setTotalCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const params = useParams<{ workspaceSlug: string; id: string }>();
  const workspaceSlug = params.workspaceSlug;
  const projectId = params.id;
  const { toast } = useToast();
  const initialScrollDone = useRef(false);

  const fetchPage = useCallback(async (page: number) => {
    const query = new URLSearchParams({
      ticket__project: projectId,
      ordering: 'created_at',
      page: String(page),
      page_size: String(PAGE_SIZE),
    }).toString();
    const response = await api.getCommentsPaginated({
      ticket__project: projectId,
      ordering: 'created_at',
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    return response;
  }, [projectId]);

  // Initial load — get last page (newest) first
  const fetchInitial = useCallback(async () => {
    try {
      // First get count to find last page
      const first = await fetchPage(1);
      const total = first.count || 0;
      setTotalCount(total);
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      
      if (totalPages === 1) {
        setComments(first.results || []);
        setHasMore(false);
      } else {
        // Load last page (newest comments)
        const last = await fetchPage(totalPages);
        setComments(last.results || []);
        setHasMore(totalPages > 1);
        setNextPage(totalPages - 1);
      }
    } catch (e: any) {
      toast(e?.message || 'Failed to load comments', 'error');
    }
  }, [fetchPage, toast]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || nextPage < 1) return;
    setLoadingMore(true);
    const scrollEl = feedRef.current;
    const prevScrollHeight = scrollEl?.scrollHeight || 0;
    try {
      const response = await fetchPage(nextPage);
      const older = response.results || [];
      setComments(prev => [...older, ...prev]);
      setNextPage(p => p - 1);
      setHasMore(nextPage > 1);
      // Maintain scroll position
      requestAnimationFrame(() => {
        if (scrollEl) {
          const newScrollHeight = scrollEl.scrollHeight;
          scrollEl.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    } catch (e: any) {
      toast(e?.message || 'Failed to load more', 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextPage, fetchPage, toast]);

  // Poll for new comments
  const pollNew = useCallback(async () => {
    try {
      const total = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      const response = await fetchPage(total);
      const newTotal = response.count || 0;
      if (newTotal !== totalCount) {
        // Refetch all loaded to get new comments
        setTotalCount(newTotal);
        const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
        const last = await fetchPage(newTotalPages);
        setComments(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newComments = (last.results || []).filter(c => !existingIds.has(c.id));
          if (newComments.length > 0) {
            return [...prev, ...newComments];
          }
          return prev;
        });
      }
    } catch {}
  }, [fetchPage, totalCount]);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getProject(projectId);
        setProject(p);
      } catch {}
      await fetchInitial();
      setLoading(false);
    })();
  }, [projectId, fetchInitial]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (!loading && !initialScrollDone.current && comments.length > 0) {
      initialScrollDone.current = true;
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [loading, comments]);

  // Auto-poll every 30s
  useEffect(() => {
    const interval = setInterval(pollNew, 30000);
    return () => clearInterval(interval);
  }, [pollNew]);

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
        <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-4 border-b border-[#222233] bg-[#111118] flex-shrink-0">
          <button
            onClick={() => router.push(`/private/${workspaceSlug}/projects/${projectId}`)}
            className="p-2 rounded-lg hover:bg-[#1a1a2e] text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              💬 {project?.name || 'Project'} Activity
            </h1>
            <p className="text-xs text-gray-500">{totalCount} comments across all tickets</p>
          </div>
          <button
            onClick={() => { pollNew(); toast('Refreshed'); }}
            className="ml-auto px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Chat feed */}
        <div ref={feedRef} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 space-y-1 bg-[#0a0a0f]">
          {loading ? (
            <div className="text-center text-gray-400 py-16">Loading…</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-gray-400 py-16">No comments yet. Activity from all tickets will appear here.</div>
          ) : (
            <>
              {/* Load more */}
              {hasMore && (
                <div className="text-center py-3">
                  <button
                    onClick={loadOlder}
                    disabled={loadingMore}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading…' : '↑ Load older messages'}
                  </button>
                </div>
              )}

              {grouped.map((group) => (
                <div key={group.date}>
                  {/* Date divider */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-[#222233]" />
                    <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{group.date}</span>
                    <div className="flex-1 h-px bg-[#222233]" />
                  </div>

                  {group.comments.map((comment) => {
                    const isBot = comment.author_details?.user_type === 'BOT';
                    const initials = (comment.author_details?.username || '?')[0].toUpperCase();
                    return (
                      <div key={comment.id} className="flex gap-3 py-2 group hover:bg-[#111118] rounded-lg px-2 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${isBot ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">
                              {isBot ? '🤖' : '👤'} {comment.author_details?.name || comment.author_details?.username || 'Unknown'}
                            </span>
                            {comment.ticket_details && (
                              <button
                                onClick={() => router.push(`/private/${workspaceSlug}/tickets/${comment.ticket_details!.ticket_slug}`)}
                                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                              >
                                {comment.ticket_details.ticket_slug}: {comment.ticket_details.title}
                              </button>
                            )}
                            <span className="text-[11px] text-gray-400">{formatTime(comment.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap break-words"><MentionText text={comment.body} /></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </Layout>
  );
}
