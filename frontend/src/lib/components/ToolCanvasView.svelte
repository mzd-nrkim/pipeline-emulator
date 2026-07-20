<script lang="ts">
  import { SvelteFlow, Background, Controls, BackgroundVariant, type Node as FlowNode, type Edge as FlowEdge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import ToolFlowNode from '$lib/components/ToolFlowNode.svelte';
  import AirflowGroupNode from '$lib/components/AirflowGroupNode.svelte';
  import type { ToolNode, CanvasTopology, Stage } from '$lib/api/types.js';
  import { buildNodesAndEdges } from '$lib/canvas/buildNodesAndEdges.js';
  import { defaultEdgeMarkerOptions } from '$lib/canvas/edgeMarker.js';

  type Adapter = {
    triggerNode: (nodeId: string, conf: Record<string, unknown>) => Promise<{ dag_run_id: string }>;
    setNodeConfig: (nodeId: string, config: Record<string, unknown>) => Promise<void | Record<string, unknown>>;
  };

  let { topology, adapter = undefined, stages = [] as Stage[], ontrigger = undefined, view = 'data' as 'data' | 'infra', onnodeselect = undefined, hideOrphans = true }: {
    topology: CanvasTopology;
    adapter?: Adapter;
    stages?: Stage[];
    ontrigger?: (runId: string) => void;
    view?: 'data' | 'infra';
    onnodeselect?: (node: ToolNode | null) => void;
    hideOrphans?: boolean;
  } = $props();

  let nodes = $state.raw<FlowNode[]>([]);
  let edges = $state.raw<FlowEdge[]>([]);

  $effect(() => {
    const result = buildNodesAndEdges(topology, view, hideOrphans);
    nodes = result.nodes;
    edges = result.edges;
  });
</script>

<div class="relative w-full h-full">
  <!-- Canvas -->
  <div class="absolute inset-0 overflow-hidden">
    <!-- 인프라 뷰 배지 -->
    {#if view === 'infra'}
      <div class="absolute top-2 left-2 z-10 px-2 py-0.5 bg-amber-50 border border-amber-300 rounded-xs text-[10px] font-mono font-bold text-amber-700 uppercase tracking-wide">
        인프라 연결 뷰
      </div>
    {/if}
    <SvelteFlow bind:nodes bind:edges nodeTypes={{ tool: ToolFlowNode as any, group: AirflowGroupNode as any }} fitView fitViewOptions={{ minZoom: 0.6, maxZoom: 1.2 }} defaultEdgeOptions={defaultEdgeMarkerOptions} onnodeclick={({ node }) => { if (node.type === 'group') return; const clicked = topology.nodes.find(n => n.id === node.id) ?? null; onnodeselect?.(clicked); }}>
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} bgColor="var(--surface-muted)" patternColor="var(--border)" />
      <Controls />
    </SvelteFlow>
  </div>
</div>

<style>
  :global(.svelte-flow__edge-path) {
    stroke: var(--muted-foreground);
    stroke-width: 1.5;
  }
  /* 엣지 조건(condition) 라벨 pill 배지 — 토큰·형상은 app.css 전역 스타일로 위임 */
  :global(.svelte-flow__controls) {
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }
  :global(.svelte-flow__controls-button) {
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    color: var(--foreground);
    padding: 4px 6px;
  }
  :global(.svelte-flow__controls-button:hover) {
    background: var(--surface-muted);
  }
</style>
