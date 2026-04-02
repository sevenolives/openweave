'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useWorkspace } from '@/hooks/useWorkspace';
import { api, WorkspaceMember, User } from '@/lib/api';

export default function MembersPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [bots, setBots] = useState<(User & { api_token?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBot, setExpandedBot] = useState<string | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());

  const wsSlug = currentWorkspace?.slug || workspaceSlug;

  const loadData = useCallback(async () => {
    if (!wsSlug) return;
    try {
      const m = await api.getWorkspaceMembers({ workspace: wsSlug });
      setMembers(m);
      try {
        const b = await api.getBots(wsSlug);
        setBots(b);
      } catch { /* not admin — no access to bot tokens */ }
    } catch (e: any) { toast(e?.message || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  }, [wsSlug, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const isAdmin = currentWorkspace?.owner_details?.id === undefined; // TODO: proper check
  const owner = currentWorkspace?.owner_details;

  const maskToken = (token: string) => {
    if (!token || token.length <= 8) return token || '—';
    return token.slice(0, 4) + '••••••••' + token.slice(-4);
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" /></div></Layout>;

  // Merge owner + members, mark bots
  const botMap = Object.fromEntries(bots.map(b => [b.username, b]));
  const allMembers = [
    ...(owner ? [{ user: owner, isOwner: true }] : []),
    ...members.filter(m => m.user?.id !== owner?.id).map(m => ({ user: m.user, isOwner: false })),
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Members</h1>

        <div className="space-y-2">
          {allMembers.map(({ user: m, isOwner }) => {
            if (!m) return null;
            const isBot = m.user_type === 'BOT';
            const botInfo = botMap[m.username];
            const isExpanded = expandedBot === m.username;

            return (
              <div key={m.username || m.id} className="bg-[#111118] rounded-xl border border-[#222233] overflow-hidden">
                {/* Member row */}
                <div
                  className={`flex items-center gap-3 p-4 ${isBot && botInfo ? 'cursor-pointer hover:bg-[#1a1a2e]' : ''}`}
                  onClick={() => isBot && botInfo && setExpandedBot(isExpanded ? null : m.username)}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${isBot ? 'bg-purple-600' : 'bg-indigo-600'}`}>
                    {m.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{m.name || m.username}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isBot ? 'bg-purple-500/20 text-purple-300' : 'bg-indigo-500/20 text-indigo-300'}`}>{m.user_type}</span>
                      {isOwner && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">OWNER</span>}
                    </div>
                    {m.description && <p className="text-xs text-gray-500 truncate mt-0.5">{m.description}</p>}
                  </div>
                  {isBot && botInfo && (
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  )}
                </div>

                {/* Bot token accordion */}
                {isBot && botInfo && isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#222233]">
                    <div className="mt-3">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">API Token</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono text-gray-300 bg-[#0a0a0f] border border-[#222233] rounded px-2 py-1.5 select-all truncate">
                          {revealedTokens.has(m.username) ? (botInfo.api_token || '—') : maskToken(botInfo.api_token || '')}
                        </code>
                        <button onClick={(e) => { e.stopPropagation(); setRevealedTokens(prev => { const n = new Set(prev); revealedTokens.has(m.username) ? n.delete(m.username) : n.add(m.username); return n; }); }}
                          className="px-2 py-1.5 text-[10px] font-medium text-gray-400 hover:text-white bg-[#1a1a2e] border border-[#222233] rounded">
                          {revealedTokens.has(m.username) ? 'Hide' : 'Show'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(botInfo.api_token || ''); toast('Token copied!'); }}
                          className="px-2 py-1.5 text-[10px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded">
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Regenerate token for ${m.username}? Old token will stop working immediately.`)) return;
                        try {
                          const result = await api.regenerateToken(m.username);
                          setBots(prev => prev.map(b => b.username === m.username ? { ...b, api_token: result.api_token } : b));
                          setRevealedTokens(prev => new Set(prev).add(m.username));
                          toast('Token regenerated');
                        } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                      }} className="px-3 py-1.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded hover:bg-amber-500/20">
                        Regenerate
                      </button>
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete bot ${m.username}? This cannot be undone.`)) return;
                        try {
                          await api.deleteUser(m.username as any);
                          setBots(prev => prev.filter(b => b.username !== m.username));
                          toast('Bot deleted');
                          loadData();
                        } catch (e: any) { toast(e?.message || 'Failed', 'error'); }
                      }} className="px-3 py-1.5 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20">
                        Delete Bot
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
