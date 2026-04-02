'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import PublicNav from '@/components/PublicNav';
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

interface Project {
  id: number;
  name: string;
  slug: string;
  about_text: string;
  process_text: string;
  url: string | null;
  logo: string | null;
  ticket_counts: Record<string, number>;
  total_tickets: number;
}

interface TeamMember {
  id: number;
  username: string;
  name: string;
  description: string;
  user_type: string;
}

interface WorkspaceData {
  workspace: {
    name: string;
    slug: string;
    description: string;
    created_at: string;
  };
  projects: Project[];
  team_members: TeamMember[];
  bots: TeamMember[];
  status_definitions: StatusDefinition[];
}

const COLOR_HEX: Record<string, string> = {
  gray: '#9ca3af', red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b', purple: '#a855f7', pink: '#ec4899', indigo: '#6366f1',
  yellow: '#eab308', orange: '#f97316', cyan: '#06b6d4',
};

export default function PublicWorkspacePage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const response = await fetch(`/api/public/workspaces/${workspaceSlug}/`);
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

  // Build workflow diagram
  const { nodes, edges } = useMemo(() => {
    if (!data?.status_definitions?.length) return { nodes: [], edges: [] };

    const activeStatuses = data.status_definitions.filter(s => !s.key.includes('ARCHIVED'));
    
    if (activeStatuses.length === 0) return { nodes: [], edges: [] };

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 70 });
    g.setDefaultEdgeLabel(() => ({}));
    
    activeStatuses.forEach((s) => g.setNode(s.key, { width: 140, height: 40 }));
    
    // Build edges from allowed_from relationships
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
          <h1 className="text-4xl font-bold text-white mb-4">{data.workspace.name}</h1>
          {data.workspace.description && (
            <p className="text-lg text-gray-300 max-w-3xl mx-auto">{data.workspace.description}</p>
          )}
          <div className="mt-4 text-sm text-gray-500">
            Public since {new Date(data.workspace.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Projects Section */}
        {data.projects.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Projects</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {data.projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-[#111118] border border-[#222233] rounded-xl p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {project.logo && (
                          <img 
                            src={project.logo} 
                            alt={`${project.name} logo`}
                            className="w-6 h-6 rounded"
                          />
                        )}
                        <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded font-mono">
                          {project.slug}
                        </span>
                      </div>
                      {project.about_text && (
                        <p className="text-gray-300 text-sm mb-3">{project.about_text}</p>
                      )}
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 text-sm inline-flex items-center gap-1"
                        >
                          Visit Website
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Ticket Stats */}
                  <div className="border-t border-[#222233] pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Total Tickets</span>
                      <span className="text-sm font-medium text-white">{project.total_tickets}</span>
                    </div>
                    {Object.keys(project.ticket_counts).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(project.ticket_counts).map(([status, count]) => (
                          <span 
                            key={status}
                            className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded"
                          >
                            {status}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {project.process_text && (
                    <details className="mt-4">
                      <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                        View Process Guidelines
                      </summary>
                      <div className="mt-2 text-xs text-gray-400 bg-gray-900/50 p-3 rounded">
                        {project.process_text}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Team Section */}
        {(data.team_members.length > 0 || data.bots.length > 0) && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Team</h2>
            
            {data.team_members.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Team Members</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.team_members.map((member) => (
                    <div
                      key={member.id}
                      className="bg-[#111118] border border-[#222233] rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-sm font-bold text-indigo-400">
                          {member.name[0]?.toUpperCase() || member.username[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-white">{member.name || member.username}</div>
                          {member.description && (
                            <div className="text-sm text-gray-400">{member.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.bots.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Bots & Automation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.bots.map((bot) => (
                    <div
                      key={bot.id}
                      className="bg-[#111118] border border-[#222233] rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-sm font-bold text-emerald-400">
                          🤖
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            {bot.name || bot.username}
                            <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded">BOT</span>
                          </div>
                          {bot.description && (
                            <div className="text-sm text-gray-400">{bot.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* State Machine Section */}
        {data.status_definitions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Workflow State Machine</h2>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.status_definitions.map((status) => {
                    const color = COLOR_HEX[status.color] || '#9ca3af';
                    return (
                      <div
                        key={status.id}
                        className="bg-[#1a1a2e] border border-[#222233] rounded-lg p-4"
                        style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          ></div>
                          <span className="font-medium text-white">{status.label}</span>
                          {status.is_default && (
                            <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        {status.description && (
                          <p className="text-sm text-gray-400">{status.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  This workflow defines {data.status_definitions.length} states for managing tickets and tasks.
                </p>
              </div>
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
    </div>
  );
}