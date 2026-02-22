'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { api, Workspace, WorkspaceMember, WorkspaceInvite } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { workspaces } = useWorkspace();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (ws: Workspace) => {
    try {
      const [m, i] = await Promise.all([
        api.getWorkspaceMembers({ workspace: String(ws.id) }),
        api.getInvites({ workspace: String(ws.id) }),
      ]);
      setMembers(m);
      setInvites(i);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const ws = workspaces.find(w => w.slug === slug);
    if (ws) { setWorkspace(ws); loadData(ws); }
  }, [slug, workspaces, loadData]);

  const handleRoleChange = async (memberId: number, role: string) => {
    await api.updateWorkspaceMember(memberId, { role });
    if (workspace) loadData(workspace);
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Remove this member?')) return;
    await api.removeWorkspaceMember(memberId);
    if (workspace) loadData(workspace);
  };

  const handleCreateInvite = async () => {
    if (!workspace) return;
    await api.createInvite({ workspace: workspace.id });
    loadData(workspace);
  };

  const handleDeleteInvite = async (id: number) => {
    await api.deleteInvite(id);
    if (workspace) loadData(workspace);
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    alert('Copied!');
  };

  if (!workspace) return <Layout><div className="p-8 text-center text-gray-500">Workspace not found</div></Layout>;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{workspace.name} — Settings</h1>

        {/* Members */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Members ({members.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {members.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.user.username}</p>
                  <p className="text-xs text-gray-500">{m.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)} className="text-xs border border-gray-300 rounded px-2 py-1">
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  <button onClick={() => handleRemoveMember(m.id)} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invites */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Invite Links</h2>
            <button onClick={handleCreateInvite} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">New Invite</button>
          </div>
          <div className="divide-y divide-gray-50">
            {invites.map(inv => (
              <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-700">{inv.token.slice(0, 8)}...</p>
                  <p className="text-xs text-gray-500">Uses: {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''} · {inv.is_active ? 'Active' : 'Inactive'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyInviteLink(inv.token)} className="text-xs text-indigo-600 hover:text-indigo-800">Copy Link</button>
                  <button onClick={() => handleDeleteInvite(inv.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                </div>
              </div>
            ))}
            {invites.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">No invite links yet.</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
