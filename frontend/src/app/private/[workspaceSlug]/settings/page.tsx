'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { api, Workspace, WorkspaceMember, User } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function WorkspaceSettingsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const { workspaces, refreshWorkspaces } = useWorkspace();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const loadData = useCallback(async (ws: Workspace) => {
    try {
      const m = await api.getWorkspaceMembers({ workspace: ws.slug });
      setMembers(m);
    } catch (e: any) { 
      toast(e?.message || 'Failed to load workspace data', 'error'); 
    }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    const ws = workspaces.find(w => w.slug === workspaceSlug);
    if (ws) {
      setWorkspace(ws);
      setEditName(ws.name);
      setEditSlug(ws.slug);
      loadData(ws);
    }
  }, [workspaceSlug, workspaces, loadData]);

  const handleSaveWorkspace = async () => {
    if (!workspace) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const updated = await api.updateWorkspace(workspace.slug, { name: editName, slug: editSlug });
      setWorkspace(updated);
      await refreshWorkspaces();
      toast('Workspace updated');
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to update workspace', 'error');
    }
    finally { setSaving(false); }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.removeWorkspaceMember(memberId);
      toast('Member removed');
      if (workspace) loadData(workspace);
    } catch (e: any) { toast(e?.message || 'Failed to remove member', 'error'); }
  };

  if (!workspace) return <Layout><div className="p-8 text-center text-gray-500">Workspace not found</div></Layout>;

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">{workspace.name} — Settings</h1>

        {/* Workspace Details */}
        <div className="bg-[#111118] border border-[#222233] rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-[#222233]">
            <h2 className="font-semibold text-white">Workspace Details</h2>
          </div>
          <div className="p-5 space-y-4">
            <FormField label="Name" error={fieldErrors.name} required>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className={inputClass(fieldErrors.name)} />
            </FormField>
            <FormField label="Slug" error={fieldErrors.slug} required>
              <input type="text" value={editSlug} onChange={e => setEditSlug(e.target.value)} className={inputClass(fieldErrors.slug)} />
            </FormField>
            <button onClick={handleSaveWorkspace} disabled={saving || !editName.trim() || !editSlug.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Publish to Community */}
        <div className="bg-[#111118] border border-[#222233] rounded-xl mb-6">
          <div className="px-5 py-4 border-b border-[#222233]">
            <h2 className="font-semibold text-white">Community</h2>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              {workspace.is_public ? (
                <p className="text-sm font-medium text-white">✅ Your workflow is published to the community</p>
              ) : (
                <p className="text-sm font-medium text-white">Your workflow is not published</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Published workspaces are visible on the community page and can be used as templates by others.</p>
              {workspace.is_public && (
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs text-gray-400">Website:</label>
                  <input
                    type="url"
                    defaultValue={workspace.website || ''}
                    placeholder="https://yoursite.com"
                    onBlur={async (e) => {
                      const val = e.target.value.trim();
                      if (val !== (workspace.website || '')) {
                        try {
                          const updated = await api.updateWorkspace(workspace.slug, { website: val } as any);
                          setWorkspace(updated);
                          toast('Website updated');
                        } catch (err: any) { toast(err?.message || 'Failed to update', 'error'); }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-[#1a1a2e] border border-[#222233] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  const updated = await api.updateWorkspace(workspace.slug, { is_public: !workspace.is_public } as any);
                  setWorkspace(updated);
                  await refreshWorkspaces();
                  toast(updated.is_public ? 'Workflow published to community!' : 'Workflow unpublished');
                } catch (e: any) {
                  toast(e?.message || 'Failed to update publish status', 'error');
                }
              }}
              className={`px-4 py-2.5 text-white rounded-xl text-sm font-medium transition-colors flex-shrink-0 ${
                workspace.is_public
                  ? 'bg-gray-600 hover:bg-gray-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {workspace.is_public ? 'Unpublish' : 'Publish to Community'}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#111118] rounded-xl border border-red-500/30">
          <div className="px-5 py-4 border-b border-red-500/20">
            <h2 className="font-semibold text-red-400">Danger Zone</h2>
          </div>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Delete this workspace</p>
              <p className="text-xs text-gray-400">This action cannot be undone. All projects, tickets, and data will be permanently deleted.</p>
            </div>
            <button
              onClick={async () => {
                if (!workspace) return;
                const confirmed = confirm(`Are you sure you want to delete "${workspace.name}"? This cannot be undone.`);
                if (!confirmed) return;
                try {
                  await api.deleteWorkspace(workspace.slug);
                  toast('Workspace deleted');
                  await refreshWorkspaces();
                  router.push('/private/workspaces');
                } catch (e: any) { toast(e?.message || 'Failed to delete workspace', 'error'); }
              }}
              className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors flex-shrink-0"
            >
              Delete Workspace
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}