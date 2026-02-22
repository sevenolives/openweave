'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { api, Project } from '@/lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      setProjects(await api.getProjects());
    } catch { toast('Failed to load projects', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProjects(); }, []);

  useEffect(() => {
    if (!showCreate) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowCreate(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showCreate]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createProject({ name: name.trim(), description: desc.trim() });
      toast('Project created');
      setName(''); setDesc(''); setShowCreate(false);
      await fetchProjects();
    } catch { toast('Failed to create project', 'error'); }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteProject(deleteId);
      toast('Project deleted');
      setDeleteId(null);
      await fetchProjects();
    } catch { toast('Failed to delete project', 'error'); }
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New Project
            </button>
          </div>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white w-full sm:w-[28rem] sm:rounded-2xl rounded-t-2xl p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">New Project</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Project name" autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" rows={3} placeholder="Optional description" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating || !name.trim()} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{creating ? 'Creating…' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={!!deleteId}
          title="Delete Project"
          message="Are you sure? This will permanently delete this project and all its tickets."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />

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
            <p className="text-sm text-gray-500 mb-4">Create your first project to get started.</p>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Create Project
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <div key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate mr-2">{project.name}</h3>
                  <button onClick={e => { e.stopPropagation(); setDeleteId(project.id); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{project.description || 'No description'}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    {project.agents.length} agent{project.agents.length !== 1 ? 's' : ''}
                  </span>
                  <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Agents</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Updated</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map(project => (
                  <tr key={project.id} onClick={() => router.push(`/projects/${project.id}`)} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">{project.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-500 hidden sm:table-cell truncate max-w-xs">{project.description || '—'}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{project.agents.length}</td>
                    <td className="px-5 py-4 text-sm text-gray-400 hidden md:table-cell">{new Date(project.updated_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={e => { e.stopPropagation(); setDeleteId(project.id); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button onClick={() => setShowCreate(true)} className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-40">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
      </button>
    </Layout>
  );
}
