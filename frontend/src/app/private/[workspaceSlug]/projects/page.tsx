'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { api, Project, Ticket, ApiError, PaginatedResponse } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ticketCounts, setTicketCounts] = useState<Record<string, { total: number; open: number; inProgress: number; blocked: number; completed: number; cancelled: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchProjects = async () => {
    if (!currentWorkspace) return;
    try {
      const params: Record<string, string> = { workspace: currentWorkspace.slug, page: String(page) };
      const resp = await api.getProjectsPaginated(params);
      const projs = resp.results || [];
      setTotalCount(resp.count || 0);
      setProjects(projs);
      // Fetch ticket counts for each project
      const counts: Record<string, any> = {};
      await Promise.all(projs.map(async (p) => {
        try {
          const resp = await api.getTicketsPaginated({ project: p.slug });
          const tickets = resp.results || [];
          counts[p.slug] = {
            total: resp.count ?? tickets.length,
            open: tickets.filter(t => t.status === 'OPEN').length,
            inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
            blocked: tickets.filter(t => t.status === 'BLOCKED').length,
            completed: tickets.filter(t => t.status === 'COMPLETED').length,
            cancelled: tickets.filter(t => t.status === 'CANCELLED').length,
          };
        } catch { counts[p.slug] = { total: 0, open: 0, inProgress: 0, blocked: 0, completed: 0, cancelled: 0 }; }
      }));
      setTicketCounts(counts);
    } catch (e: any) { toast(e?.message || 'Failed to load projects', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, [currentWorkspace?.id, page]);

  useEffect(() => {
    if (!showCreate) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowCreate(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showCreate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createProject({ name: name.trim(), description: desc.trim(), workspace: currentWorkspace?.slug, ...(slug.trim() ? { slug: slug.trim().toUpperCase() } : {}) });
      toast('Project created');
      setName(''); setSlug(''); setDesc(''); setShowCreate(false);
      setFieldErrors({});
      await fetchProjects();
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to create project', 'error');
    }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deleteSlug) return;
    try {
      await api.deleteProject(deleteSlug);
      toast('Project deleted');
      setDeleteSlug(null);
      await fetchProjects();
    } catch (e: any) { toast(e?.message || 'Failed to delete project', 'error'); }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">Each project contains its own tickets and team members</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Project
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">New Project</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <FormField label="Name" error={fieldErrors.name} required>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass(fieldErrors.name)} placeholder="Project name" autoFocus />
                </FormField>
                <FormField label="Slug" error={fieldErrors.slug}>
                  <input type="text" value={slug} onChange={e => setSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className={inputClass(fieldErrors.slug)} placeholder="e.g. SA, PROJ (auto-generated if empty)" maxLength={10} />
                  <p className="text-xs text-gray-400 mt-1">Used in ticket IDs like SA-1, SA-2</p>
                </FormField>
                <FormField label="Description" error={fieldErrors.description}>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} className={`${inputClass(fieldErrors.description)} resize-none`} rows={3} placeholder="Optional description" />
                </FormField>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating || !name.trim()} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{creating ? 'Creating…' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog open={!!deleteSlug} title="Delete Project" message="Are you sure? The project must have no tickets before it can be deleted." onConfirm={handleDelete} onCancel={() => setDeleteSlug(null)} />

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"><div className="h-5 bg-gray-200 rounded w-32 mb-3"></div><div className="h-3 bg-gray-100 rounded w-full mb-2"></div><div className="h-3 bg-gray-100 rounded w-2/3"></div></div>)}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No projects yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first project to start tracking tickets.</p>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => {
              const counts = ticketCounts[project.slug] || { total: 0, open: 0, inProgress: 0, blocked: 0, completed: 0, cancelled: 0 };
              const activeTickets = counts.open + counts.inProgress + counts.blocked;
              return (
                <div key={project.slug} onClick={() => router.push(`/private/${workspaceSlug}/tickets?project=${project.slug}`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate mr-2">{project.name}</h3>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={e => { e.stopPropagation(); router.push(`/private/${workspaceSlug}/projects/${project.slug}`); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all" title="Settings">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteSlug(project.slug); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">{project.description || 'No description'}</p>
                  
                  {/* Ticket summary */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{counts.total} ticket{counts.total !== 1 ? 's' : ''}</span>
                      {activeTickets > 0 && <span className="text-xs text-indigo-600 font-medium">{activeTickets} active</span>}
                    </div>
                    {counts.total > 0 && (
                      <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-gray-100">
                        {counts.open > 0 && <div className="bg-gray-400 transition-all" style={{ width: `${(counts.open / counts.total) * 100}%` }} title={`${counts.open} Open`} />}
                        {counts.inProgress > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(counts.inProgress / counts.total) * 100}%` }} title={`${counts.inProgress} In Progress`} />}
                        {counts.blocked > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(counts.blocked / counts.total) * 100}%` }} title={`${counts.blocked} Blocked`} />}
                        {counts.completed > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(counts.completed / counts.total) * 100}%` }} title={`${counts.completed} Completed`} />}
                        {counts.cancelled > 0 && <div className="bg-gray-300 transition-all" style={{ width: `${(counts.cancelled / counts.total) * 100}%` }} title={`${counts.cancelled} Cancelled`} />}
                      </div>
                    )}
                  </div>

                  {/* Status pills */}
                  {counts.total > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {counts.open > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{counts.open} open</span>}
                      {counts.inProgress > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{counts.inProgress} in progress</span>}
                      {counts.blocked > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">{counts.blocked} blocked</span>}
                      {counts.completed > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600">{counts.completed} completed</span>}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {project.slug || '—'}
                    </span>
                    <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <p className="text-sm text-gray-500">Page {page} of {totalPages} · {totalCount} project{totalCount !== 1 ? 's' : ''}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <button onClick={() => setShowCreate(true)} className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-40">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
      </button>
    </Layout>
  );
}
