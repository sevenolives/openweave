'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

import Layout from '@/components/Layout';
import PieChart from '@/components/PieChart';
import type { PieSlice } from '@/components/PieChart';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField, { parseFieldErrors, inputClass } from '@/components/FormField';
import { api, Project, ProjectsDashboard, ProjectDashboardItem, StatusDefinition, ApiError } from '@/lib/api';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<ProjectsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fabRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  const fetchDashboard = async () => {
    if (!currentWorkspace) return;
    try {
      const data = await api.getProjectsDashboard(currentWorkspace.slug);
      setDashboard(data);
    } catch (e: any) { toast(e?.message || 'Failed to load dashboard', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboard(); }, [currentWorkspace?.slug]);

  // Close FAB on outside click
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) setFabOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [fabOpen]);

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
      await fetchDashboard();
    } catch (e: any) {
      setFieldErrors(parseFieldErrors(e));
      toast(e?.message || 'Failed to create project', 'error');
    }
    finally { setCreating(false); }
  };

  const statuses = dashboard?.statuses || [];

  const wsSlices: PieSlice[] = statuses
    .map(sd => ({ label: sd.label, value: dashboard?.status_counts[sd.key] || 0, color: sd.color }));

  const fabActions = [
    {
      label: 'New Project',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
      onClick: () => { setFabOpen(false); setShowCreate(true); },
    },
    {
      label: 'New Ticket',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      onClick: () => { setFabOpen(false); router.push(`/private/${workspaceSlug}/tickets`); },
    },
    {
      label: 'New Workspace',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      onClick: () => { setFabOpen(false); router.push('/private/workspaces'); },
    },
  ];

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of all projects and ticket status</p>
        </div>

        {/* Create Project modal */}
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

        {/* Content */}
        {loading ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse"><div className="h-5 bg-gray-200 rounded w-32 mb-3"></div><div className="h-32 bg-gray-100 rounded"></div></div>)}
            </div>
          </div>
        ) : !dashboard || dashboard.total_projects === 0 ? (
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
          <>
            {/* Workspace-level overview */}
            {dashboard.total_tickets > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <PieChart slices={wsSlices} size={200} donut />
              </div>
            )}

            {/* Project cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard.projects.map((project) => {
                const pieSlices: PieSlice[] = statuses
                  .map(sd => ({ label: sd.label, value: project.status_counts[sd.key] || 0, color: sd.color }));
                return (
                  <div key={project.slug} onClick={() => router.push(`/private/${workspaceSlug}/tickets?project=${project.slug}`)} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50 transition-all cursor-pointer group">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate mb-1">{project.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{project.description || 'No description'}</p>

                    {/* Pie chart */}
                    {project.total_tickets > 0 ? (
                      <div className="flex justify-center my-2">
                        <PieChart slices={pieSlices} size={140} donut />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-6 text-sm text-gray-400">No tickets yet</div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                      <span className="font-medium text-gray-500">{project.slug} · {project.total_tickets} ticket{project.total_tickets !== 1 ? 's' : ''}</span>
                      <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Spacer for FAB */}
      <div className="h-24" />

      {/* FAB Speed Dial */}
      <div ref={fabRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {/* Action items — shown when open */}
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {fabActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-3 pl-4 pr-3 py-2.5 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:shadow-xl transition-all group"
              >
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{action.label}</span>
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center group-hover:bg-indigo-700 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={action.icon} /></svg>
                </div>
              </button>
            ))}
          </div>
        )}
        {/* Main FAB button */}
        <button
          onClick={() => setFabOpen(prev => !prev)}
          className={`w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all ${fabOpen ? 'rotate-45' : ''}`}
        >
          <svg className="w-6 h-6 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
    </Layout>
  );
}
