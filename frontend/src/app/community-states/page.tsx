'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';
import { useToast } from '@/components/Toast';

interface StateInfo {
  key: string;
  label: string;
  color: string;
  is_default: boolean;
}

interface PublicWorkspace {
  slug: string;
  name: string;
  description: string;
  state_count: number;
  state_flow_preview: string;
  states: StateInfo[];
}

interface PageResponse {
  count: number;
  num_pages: number;
  page: number;
  results: PublicWorkspace[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://backend.openweave.dev/api';

export default function CommunityStatesPage() {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<PublicWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [page, search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: page.toString(), page_size: '12' });
      if (search) params.append('search', search);
      const res = await fetch(`${API_BASE}/public/workspaces/?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data: PageResponse = await res.json();
      setWorkspaces(data.results);
      setTotalPages(data.num_pages);
      setTotalCount(data.count);
    } catch (e: any) {
      toast(e?.message || 'Failed to load community states', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <PublicNav />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Community States</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Browse ticket state configurations from public workspaces. Find a workflow that fits your team and import it.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="max-w-md mx-auto mb-8">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search workspaces..."
              className="w-full bg-[#111118] border border-[#222233] rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-gray-500 mb-4">{totalCount} public workspace{totalCount !== 1 ? 's' : ''}</p>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-2">No public workspaces found</p>
            <p className="text-gray-500 text-sm">Workspaces will appear here when owners make them public.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map(ws => (
              <div key={ws.slug} className="bg-[#111118] border border-[#222233] rounded-xl overflow-hidden hover:border-[#333355] transition-colors">
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-white truncate">{ws.name}</h3>
                    <span className="text-[10px] font-medium text-gray-500 bg-[#1a1a2e] px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                      {ws.state_count} states
                    </span>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2">{ws.description}</p>
                  )}

                  {/* State flow preview */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {ws.states.slice(0, 6).map((s, i) => (
                      <React.Fragment key={s.key}>
                        {i > 0 && <span className="text-gray-600 text-xs self-center">→</span>}
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: s.color + '20', color: s.color, border: `1px solid ${s.color}40` }}
                        >
                          {s.label}
                        </span>
                      </React.Fragment>
                    ))}
                    {ws.states.length > 6 && (
                      <span className="text-[10px] text-gray-500 self-center">+{ws.states.length - 6} more</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpanded(expanded === ws.slug ? null : ws.slug)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      {expanded === ws.slug ? 'Hide Details' : 'View Details'}
                    </button>
                    <Link
                      href={`/community/${ws.slug}`}
                      className="text-xs text-gray-400 hover:text-gray-300 font-medium ml-auto"
                    >
                      Full Profile →
                    </Link>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded === ws.slug && (
                  <div className="border-t border-[#222233] px-5 py-4 bg-[#0d0d14]">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">All States</h4>
                    <div className="space-y-2">
                      {ws.states.map(s => (
                        <div key={s.key} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-sm text-white">{s.label}</span>
                          <span className="text-[10px] text-gray-500 font-mono">{s.key}</span>
                          {s.is_default && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">DEFAULT</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded bg-[#111118] border border-[#222233] text-gray-400 disabled:opacity-30 hover:border-indigo-500"
            >
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
              Math.max(0, page - 3), Math.min(totalPages, page + 2)
            ).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-sm rounded border ${p === page ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-[#111118] border-[#222233] text-gray-400 hover:border-indigo-500'}`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded bg-[#111118] border border-[#222233] text-gray-400 disabled:opacity-30 hover:border-indigo-500"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
