'use client';

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { StatusDefinition, StatusTransition } from '@/lib/api';

const COLOR_HEX: Record<string, string> = {
  gray: '#9ca3af', blue: '#3b82f6', red: '#ef4444', purple: '#a855f7',
  amber: '#f59e0b', green: '#22c55e', yellow: '#eab308', indigo: '#6366f1',
  pink: '#ec4899', orange: '#f97316',
};

const ACTOR_COLORS: Record<string, string> = {
  BOT: '#a855f7',
  HUMAN: '#3b82f6',
  ALL: '#9ca3af',
};

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 160, height: 60 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 80, y: pos.y - 30 } };
  });

  return { nodes: layoutedNodes, edges };
}

interface Props {
  statuses: StatusDefinition[];
  transitions: StatusTransition[];
}

export default function StateFlowDiagram({ statuses, transitions }: Props) {
  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    const nodes: Node[] = statuses.map((s) => ({
      id: String(s.id),
      data: {
        label: (
          <div className="flex items-center gap-1.5 px-1">
            {s.is_default && <span className="text-amber-500 text-xs">⭐</span>}
            <span className="font-medium text-sm truncate">{s.label}</span>
          </div>
        ),
      },
      position: { x: 0, y: 0 },
      style: {
        background: 'white',
        border: `2px ${s.is_terminal ? 'double' : 'solid'} ${COLOR_HEX[s.color] || '#9ca3af'}`,
        borderWidth: s.is_terminal ? '4px' : '2px',
        borderRadius: s.is_terminal ? '16px' : '8px',
        padding: '8px 12px',
        minWidth: '120px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      },
    }));

    const edges: Edge[] = transitions.map((t) => ({
      id: String(t.id),
      source: String(t.from_status),
      target: String(t.to_status),
      animated: t.actor_type === 'BOT',
      style: { stroke: ACTOR_COLORS[t.actor_type] || '#9ca3af', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: ACTOR_COLORS[t.actor_type] || '#9ca3af' },
      label: t.actor_type,
      labelStyle: { fontSize: 10, fill: ACTOR_COLORS[t.actor_type] || '#9ca3af', fontWeight: 600 },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
    }));

    const result = getLayoutedElements(nodes, edges);
    return { layoutedNodes: result.nodes, layoutedEdges: result.edges };
  }, [statuses, transitions]);

  const [nodes] = useNodesState(layoutedNodes);
  const [edges] = useEdgesState(layoutedEdges);

  if (statuses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Add statuses to see the workflow diagram
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full border border-gray-100 rounded-lg overflow-hidden bg-gray-50/50">
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-200 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-purple-500 rounded" /> BOT</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-blue-500 rounded" /> HUMAN</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block bg-gray-400 rounded" /> ALL</span>
      </div>
    </div>
  );
}
