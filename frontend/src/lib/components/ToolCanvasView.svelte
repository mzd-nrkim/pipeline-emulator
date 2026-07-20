<script lang="ts">
  import { writable } from 'svelte/store';
  import { SvelteFlow, Background, Controls, type Node as FlowNode, type Edge as FlowEdge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import LRFlowNode from './LRFlowNode.svelte';
  import type { ToolNode, CanvasTopology, Stage } from '$lib/api/types.js';
  import { buildNodesAndEdges } from '$lib/canvas/buildNodesAndEdges.js';

  type Adapter = {
    triggerNode: (nodeId: string, conf: Record<string, unknown>) => Promise<{ dag_run_id: string }>;
    setNodeConfig: (nodeId: string, config: Record<string, unknown>) => Promise<void | Record<string, unknown>>;
  };

  let { topology, adapter = undefined, stages = [] as Stage[], ontrigger = undefined, view = 'data' as 'data' | 'infra', onnodeselect = undefined }: {
    topology: CanvasTopology;
    adapter?: Adapter;
    stages?: Stage[];
    ontrigger?: (runId: string) => void;
    view?: 'data' | 'infra';
    onnodeselect?: (node: ToolNode | null) => void;
  } = $props();

  const nodesStore = writable<FlowNode[]>([]);
  const edgesStore = writable<FlowEdge[]>([]);

  $effect(() => {
    const { nodes, edges } = buildNodesAndEdges(topology, view);
    nodesStore.set(nodes);
    edgesStore.set(edges);
  });

  function handleNodeClick(event: CustomEvent<{ node: FlowNode }>) {
    const clicked = topology.nodes.find(n => n.id === event.detail.node.id) ?? null;
    onnodeselect?.(clicked);
  }
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
    <SvelteFlow nodes={nodesStore} edges={edgesStore} nodeTypes={{ lrnode: LRFlowNode as any }} fitView on:nodeclick={handleNodeClick}>
      <Background />
      <Controls />
    </SvelteFlow>
  </div>
</div>
