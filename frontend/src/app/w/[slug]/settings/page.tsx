'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { api, Workspace, WorkspaceMember, WorkspaceInvite } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { workspaces, refreshWorkspaces } = useWorkspace();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const loadData = useCallback(async (ws: Workspace) => {
    try {
      const [m, i] = await Promise.all([
        api.getWorkspaceMembers({ workspace: String(ws.id) }),
        api.getInvites({ workspace: String(ws.id) }),
      ]);
      setMembers(m);
      setInvites(i);
    } catch (e: any) { toast(e?.message || 'Failed to load workspace data', 'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    const ws = workspaces.find(w => w.slug === slug);
    if (ws) {
      setWorkspace(ws);
      setEditName(ws.name);
      setEditSlug(ws.slug);
      loadData(ws);
    }
  }, [slug, workspaces, loadData]);

  const handleSaveWorkspace = async () => {
    if (!workspace) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const updated = await api.updateWorkspace(workspace.id, { name: editName, slug: editSlug });
      setWorkspace(updated);
      await refreshWorkspaces();
      toast('Workspace updated');
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to update workspace', 'error');
    }
    finally { setSaving(false); }
  };

  const handleRoleChange = async (memberId: number, role: string) => {
    try {
      await api.updateWorkspaceMember(memberId, { role });
      toast('Role updated');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to update role', 'error'); }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.removeWorkspaceMember(memberId);
      toast('Member removed');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to remove member', 'error'); }
  };

  const handleCreateInvite = async () => {
    if (!workspace) return;
    try {
      await api.createInvite({ workspace: workspace.id });
      toast('Invite created');
      loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to create invite', 'error'); }
  };

  const handleDeleteInvite = async (id: number) => {
    try {
      await api.deleteInvite(id);
      toast('Invite deleted');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to delete invite', 'error'); }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast('Invite link copied!');
  };

  const copyInviteCode = (token: string) => {
    navigator.clipboard.writeText(token);
    toast('Invite code copied for bot!');
  };


  if (!workspace) return <Layout><div className="p-8 text-center text-gray-500">Workspace not found</div></Layout>;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{workspace.name} — Settings</h1>

        {/* Workspace Details */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Workspace Details</h2>
          </div>
          <div className="p-5 space-y-4">
            <FormField label="Name" error={fieldErrors.name} required>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass(fieldErrors.name)} />
            </FormField>
            <FormField label="Slug" error={fieldErrors.slug} required>
              <input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value)} className={inputClass(fieldErrors.slug)} />
            </FormField>
            <button onClick={handleSaveWorkspace} disabled={saving || !editName.trim() || !editSlug.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white border border-gray-200 rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Members ({members.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {members.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${m.user.user_type === 'BOT' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                    {m.user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.user.username}</p>
                    <p className="text-xs text-gray-500">{m.user.email} · <span className={m.user.user_type === 'BOT' ? 'text-purple-600' : ''}>{m.user.user_type}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                  <button onClick={() => handleRemoveMember(m.id)} className="px-3 py-2 text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-colors min-w-[80px]">
                    Remove
                  </button>
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
                  <button onClick={() => copyInviteLink(inv.token)} className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded" title="For humans — opens invite page">👤 Link</button>
                  <button onClick={() => copyInviteCode(inv.token)} className="px-2 py-1 text-xs text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded" title="Copy invite code for bots">🤖 Code</button>
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
