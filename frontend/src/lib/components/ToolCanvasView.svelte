<script lang="ts">
  import { writable } from 'svelte/store';
  import { SvelteFlow, Background, Controls, type Node as FlowNode, type Edge as FlowEdge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import type { ToolNode, CanvasTopology } from '$lib/api/types.js';
  import { buildNodesAndEdges } from '$lib/canvas/buildNodesAndEdges.js';

  let { topology }: { topology: CanvasTopology } = $props();

  let selectedNode = $state<ToolNode | null>(null);

  const nodesStore = writable<FlowNode[]>([]);
  const edgesStore = writable<FlowEdge[]>([]);

  $effect(() => {
    const { nodes, edges } = buildNodesAndEdges(topology);
    nodesStore.set(nodes);
    edgesStore.set(edges);
  });

  function handleNodeClick(event: CustomEvent<{ node: FlowNode }>) {
    const clicked = topology.nodes.find(n => n.id === event.detail.node.id) ?? null;
    selectedNode = clicked;
  }
</script>

<div class="relative flex gap-4" style="height: 520px;">
  <!-- Canvas -->
  <div class="flex-1 border border-border rounded-sm overflow-hidden">
    <SvelteFlow nodes={nodesStore} edges={edgesStore} fitView on:nodeclick={handleNodeClick}>
      <Background />
      <Controls />
    </SvelteFlow>
  </div>

  <!-- Drill-down 패널 -->
  {#if selectedNode}
    <div class="w-72 bg-surface border border-border rounded-sm p-4 flex flex-col gap-3 overflow-auto text-xs font-mono">
      <div class="flex items-center justify-between">
        <span class="font-bold uppercase tracking-widest text-[10px]">노드 상세</span>
        <button type="button" onclick={() => selectedNode = null} class="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div class="space-y-2">
        <div>
          <span class="text-muted-foreground">id</span>
          <span class="ml-2 font-bold">{selectedNode.id}</span>
        </div>
        <div>
          <span class="text-muted-foreground">tool</span>
          <span class="ml-2 font-bold">{selectedNode.tool}</span>
        </div>
        <div>
          <span class="text-muted-foreground">kind</span>
          <span class="ml-2 font-bold">{selectedNode.kind}</span>
        </div>
        <div>
          <span class="text-muted-foreground">config</span>
          <pre class="mt-1 bg-surface-muted p-2 rounded-xs text-[10px] overflow-auto whitespace-pre-wrap">{JSON.stringify(selectedNode.config, null, 2)}</pre>
        </div>
      </div>
      <div class="mt-auto border-t border-border pt-3 text-[10px] text-muted-foreground leading-relaxed">
        이 run의 증거는 P3에서 연결됩니다. (run_id 바인딩은 P3)
      </div>
    </div>
  {/if}
</div>
