import type { CanvasTopology, ToolNode } from '$lib/api/types.js';
import { getToolEntry } from './toolCatalog.js';

export const KIND_STYLE: Record<ToolNode['kind'], string> = {
  source: 'border: 2px solid #3b82f6; background: #eff6ff; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  task:   'border: 2px solid #22c55e; background: #f0fdf4; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  switch: 'border: 2px solid #f97316; background: #fff7ed; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
  sink:   'border: 2px solid #a855f7; background: #faf5ff; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
};

export const KIND_X: Record<ToolNode['kind'], number> = {
  source: 0,
  task:   280,
  switch: 560,
  sink:   840,
};

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    displayName: string;
    vendor: string;
    icon: string;
    accent: string;
    kind: string;
  };
  style?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string;
}

export function buildNodesAndEdges(topo: CanvasTopology): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const kindCounters: Record<string, number> = {};
  const nodeIdSet = new Set(topo.nodes.map(n => n.id));

  const nodes: FlowNode[] = topo.nodes.map((n) => {
    const idx = kindCounters[n.kind] ?? 0;
    kindCounters[n.kind] = idx + 1;

    const entry = getToolEntry(n.tool);
    const catalogData = entry ? {
      displayName: entry.displayName,
      vendor: entry.vendor,
      icon: entry.icon,
      accent: entry.accent,
      kind: entry.kind,
    } : {
      displayName: n.tool || n.id,
      vendor: 'Unknown',
      icon: '❓',
      accent: '#6B7280',
      kind: n.kind,
    };

    return {
      id: n.id,
      type: 'default',
      position: { x: KIND_X[n.kind], y: idx * 140 },
      data: {
        label: `${catalogData.icon} ${catalogData.displayName}\n[${n.kind}]`,
        ...catalogData,
      },
      style: KIND_STYLE[n.kind],
    };
  });

  const edges: FlowEdge[] = topo.edges
    .filter(e => nodeIdSet.has(e.from) && nodeIdSet.has(e.to))
    .map((e, i) => ({
      id: `e-${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      animated: true,
      label: e.condition ?? undefined,
    }));

  return { nodes, edges };
}
