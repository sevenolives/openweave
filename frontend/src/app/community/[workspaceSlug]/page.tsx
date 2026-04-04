'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PublicNav from '@/components/PublicNav';
import { api, tokenStorage, Workspace } from '@/lib/api';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

interface StatusDefinition {
  id: number;
  key: string;
  label: string;
  color: string;
  description: string;
  is_default: boolean;
  position: number;
  allowed_from: string[];
}

interface WorkspaceData {
  workspace: {
    name: string;
    slug: string;
    description: string;
    created_at: string;
  };
  status_definitions: StatusDefinition[];
}

const COLOR_HEX: Record<string, string> = {
  gray: '#9ca3af', red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b', purple: '#a855f7', pink: '#ec4899', indigo: '#6366f1',
  yellow: '#eab308', orange: '#f97316', cyan: '#06b6d4',
};

export default function PublicWorkspacePage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState<'states' | 'transitions' | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [applyingSync, setApplyingSync] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://backend.openweave.dev/api';
        const response = await fetch(`${apiBase}/public/workspaces/${workspaceSlug}/`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Workspace not found or not public');
          } else {
            setError('Failed to load workspace');
          }
          return;
        }
        const workspaceData = await response.json();
        setData(workspaceData);
      } catch (err: any) {
        setError(err?.message || 'Failed to load workspace');
        console.error('Error loading workspace:', err);
      } finally {
        setLoading(false);
      }
    };

    if (workspaceSlug) {
      loadWorkspace();
    }
  }, [workspaceSlug]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const t = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastMsg]);

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as globalThis.Node)) {
        setShowWorkspacePicker(null);
      }
    };
    if (showWorkspacePicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showWorkspacePicker]);

  const openWorkspacePicker = async (mode: 'states' | 'transitions') => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      router.push(`/login?redirect=/community/${workspaceSlug}`);
      return;
    }
    setShowWorkspacePicker(mode);
    setLoadingWorkspaces(true);
    try {
      const workspaces = await api.getWorkspaces();
      setUserWorkspaces(workspaces);
    } catch {
      setToastMsg({ text: 'Failed to load your workspaces', type: 'error' });
      setShowWorkspacePicker(null);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const handleApplySync = async (targetSlug: string) => {
    if (!data || !showWorkspacePicker) return;
    const mode = showWorkspacePicker;
    const targetWs = userWorkspaces.find(ws => ws.slug === targetSlug);
    const targetName = targetWs?.name || targetSlug;
    setApplyingSync(true);
    try {
      const token = tokenStorage.getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://backend.openweave.dev/api'}/status-definitions/sync-from/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace: targetSlug, source_workspace: data.workspace.slug, mode }),
      });
      const d = await res.json();
      if (!res.ok) {
        setToastMsg({ text: d.detail || 'Sync failed', type: 'error' });
      } else {
        if (mode === 'states') {
          setToastMsg({ text: `Applied ${d.added || 0} states to ${targetName}`, type: 'success' });
        } else {
          setToastMsg({ text: `Applied transitions to ${targetName}`, type: 'success' });
        }
      }
    } catch {
      setToastMsg({ text: 'Failed to apply. Please try again.', type: 'error' });
    } finally {
      setApplyingSync(false);
      setShowWorkspacePicker(null);
    }
  };

  // Build workflow diagram
  const { nodes, edges } = useMemo(() => {
    if (!data?.status_definitions?.length) return { nodes: [], edges: [] };

    const activeStatuses = data.status_definitions.filter(s => !s.key.includes('ARCHIVED'));
    
    if (activeStatuses.length === 0) return { nodes: [], edges: [] };

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });
    g.setDefaultEdgeLabel(() => ({}));
    
    activeStatuses.forEach((s) => g.setNode(s.key, { width: 140, height: 40 }));
    
    const activeKeys = new Set(activeStatuses.map(s => s.key));
    activeStatuses.forEach((target) => {
      if (target.allowed_from && target.allowed_from.length > 0) {
        target.allowed_from.filter((k: string) => activeKeys.has(k)).forEach((srcKey: string) => {
          g.setEdge(srcKey, target.key);
        });
      }
    });
    
    dagre.layout(g);
    
    const nodes: Node[] = activeStatuses.map((s) => {
      const nd = g.node(s.key);
      const color = COLOR_HEX[s.color] || '#9ca3af';
      return {
        id: s.key,
        position: { x: (nd?.x ?? 0) - 70, y: (nd?.y ?? 0) - 20 },
        data: { label: s.label },
        type: 'default',
        style: {
          background: 'white',
          border: `2px solid ${color}`,
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#1f2937',
          boxShadow: s.is_default ? `0 0 0 3px ${color}44` : '0 1px 4px rgba(0,0,0,0.1)',
          minWidth: '100px',
          textAlign: 'center' as const,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    });

    const edges: Edge[] = [];
    activeStatuses.forEach((target) => {
      if (target.allowed_from && target.allowed_from.length > 0) {
        target.allowed_from.filter((k: string) => activeKeys.has(k)).forEach((srcKey: string) => {
          const color = '#6b7280';
          edges.push({
            id: `e-${srcKey}-${target.key}`,
            source: srcKey,
            target: target.key,
            animated: false,
            style: { stroke: color, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
            label: '',
            labelStyle: { fontSize: 9, fontWeight: 700, fill: color },
            labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
          });
        });
      }
    });

    return { nodes, edges };
  }, [data?.status_definitions]);

  // Helper to resolve key → label
  const keyToLabel = useMemo(() => {
    if (!data?.status_definitions) return new Map<string, { label: string; color: string }>();
    const map = new Map<string, { label: string; color: string }>();
    data.status_definitions.forEach(s => map.set(s.key, { label: s.label, color: s.color }));
    return map;
  }, [data?.status_definitions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <PublicNav />
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <PublicNav />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-8 text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-2">Workspace Not Found</h1>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <PublicNav />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Workspace Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">{data.workspace.name}</h1>
          <p className="text-sm text-indigo-400 mb-2">@{data.workspace.slug}</p>
          {data.workspace.website ? (
            <a href={data.workspace.website} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 mb-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              {String(data.workspace.website).replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          ) : null}
          {data.workspace.description && (
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">{data.workspace.description}</p>
          )}
          <div className="mt-4 text-sm text-gray-500">
            Public since {new Date(data.workspace.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* State Machine Section */}
        {data.status_definitions.length > 0 && (
          <section className="mb-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">Workflow State Machine</h2>
              <div className="relative" ref={pickerRef}>
                <div className="flex gap-2">
                  <button
                    onClick={() => openWorkspacePicker('states')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition"
                  >
                    ↓ Apply States
                  </button>
                  <button
                    onClick={() => openWorkspacePicker('transitions')}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition"
                  >
                    ↓ Apply Transitions
                  </button>
                </div>
                {showWorkspacePicker && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-[#1a1a2e] border border-[#333355] rounded-xl shadow-2xl z-50 p-4">
                    <p className="text-sm text-gray-300 mb-3">
                      Apply <span className="font-semibold text-white">{showWorkspacePicker}</span> to:
                    </p>
                    {loadingWorkspaces ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent"></div>
                      </div>
                    ) : userWorkspaces.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No workspaces found. Create one first.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {userWorkspaces.map((ws) => (
                          <button
                            key={ws.slug}
                            onClick={() => handleApplySync(ws.slug)}
                            disabled={applyingSync}
                            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-indigo-600/30 transition disabled:opacity-50"
                          >
                            {ws.name} <span className="text-gray-400">@{ws.slug}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowWorkspacePicker(null)}
                      className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Flow Diagram */}
            <div className="bg-[#111118] border border-[#222233] rounded-xl p-6">
              {nodes.length > 0 ? (
                <div className="h-96 w-full rounded-lg overflow-hidden border border-[#27272a] bg-gradient-to-br from-gray-50 to-gray-100">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    fitView
                    fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    proOptions={{ hideAttribution: true }}
                    minZoom={0.1}
                    maxZoom={2}
                    panOnScroll={false}
                    zoomOnScroll={false}
                    zoomOnPinch={false}
                    panOnDrag={true}
                  >
                    <Background gap={20} size={1} color="#cbd5e1" />
                    <Controls showInteractive={false} />
                  </ReactFlow>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-8">No workflow diagram available</p>
              )}
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  This workflow defines {data.status_definitions.length} states for managing tickets and tasks.
                </p>
              </div>
            </div>

            {/* State Cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.status_definitions.map((status) => {
                const color = COLOR_HEX[status.color] || '#9ca3af';
                return (
                  <div
                    key={status.id}
                    className="bg-[#111118] border border-[#222233] rounded-xl p-5"
                    style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
                  >
                    {/* Header: color dot + label + key */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-semibold text-white text-sm">{status.label}</span>
                      <span className="text-[11px] font-mono text-gray-500 bg-gray-800/60 px-1.5 py-0.5 rounded">
                        {status.key}
                      </span>
                      {status.is_default && (
                        <span className="text-[10px] bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded font-medium">
                          DEFAULT
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {status.description && (
                      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{status.description}</p>
                    )}

                    {/* Allowed from badges */}
                    {status.allowed_from && status.allowed_from.length > 0 ? (
                      <div className="mt-auto">
                        <p className="text-[11px] text-gray-500 font-medium mb-1.5">Allowed from</p>
                        <div className="flex flex-wrap gap-1.5">
                          {status.allowed_from.map((fromKey) => {
                            const source = keyToLabel.get(fromKey);
                            const srcColor = source ? (COLOR_HEX[source.color] || '#9ca3af') : '#9ca3af';
                            return (
                              <span
                                key={fromKey}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-medium"
                                style={{
                                  background: `${srcColor}15`,
                                  color: srcColor,
                                  border: `1px solid ${srcColor}30`,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: srcColor }}
                                />
                                {source?.label || fromKey}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-600 mt-auto">Reachable from any state</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
        
        {/* Footer */}
        <div className="text-center py-8 border-t border-[#222233]">
          <p className="text-gray-400 text-sm">
            This workspace is publicly shared on OpenWeave. 
            <a href="/login" className="text-indigo-400 hover:text-indigo-300 ml-1">
              Create your own workspace →
            </a>
          </p>
        </div>
      </div>

      {/* Toast notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
          toastMsg.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toastMsg.text}
        </div>
      )}
    </div>
  );
}
