<script lang="ts">
  import { SvelteFlow, Background, Controls, BackgroundVariant, type Node, type Edge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import ToolFlowNode from '$lib/components/ToolFlowNode.svelte';
  import type { Stage } from '$lib/api/types.js';
  import { defaultEdgeMarkerOptions } from '$lib/canvas/edgeMarker.js';

  let { stages, onselect }: { stages: Stage[]; onselect: (id: string) => void } = $props();

  const LAYER_X: Record<string, number> = {
    Bronze: 0,
    Silver: 300,
    Gold: 600,
    Serving: 900,
  };

  const LAYER_Y_OFFSETS: Record<string, number[]> = {
    Bronze: [0, 120],
    Silver: [0, 120],
    Gold: [0, 80, 160],
    Serving: [0],
  };

  function buildNodesAndEdges(stageList: Stage[]): { nodes: Node[]; edges: Edge[] } {
    if (!stageList.length) return { nodes: [], edges: [] };

    const layerCounters: Record<string, number> = { Bronze: 0, Silver: 0, Gold: 0, Serving: 0 };
    const nodes: Node[] = stageList.map((stage) => {
      const layer = stage.layer;
      const yOffsets = LAYER_Y_OFFSETS[layer] ?? [0];
      const idx = layerCounters[layer] ?? 0;
      layerCounters[layer] = idx + 1;
      const y = yOffsets[idx] ?? idx * 120;

      return {
        id: stage.id,
        type: 'tool',
        position: { x: LAYER_X[layer] ?? 0, y },
        data: { label: stage.name, planned: stage.planned, animated: false },
      };
    });

    const edges: Edge[] = [];
    for (let i = 0; i < stageList.length - 1; i++) {
      if (!stageList[i].planned && !stageList[i + 1].planned) {
        edges.push({
          id: `e${stageList[i].id}-${stageList[i + 1].id}`,
          source: stageList[i].id,
          target: stageList[i + 1].id,
          animated: true,
        });
      }
    }

    return { nodes, edges };
  }

  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);

  $effect(() => {
    const result = buildNodesAndEdges(stages);
    nodes = result.nodes;
    edges = result.edges;
  });

  function handleNodeClick(node: Node) {
    onselect(node.id);
  }
</script>

<div style="height: 420px; width: 100%; border: 1px solid var(--color-border); border-radius: 2px; overflow: hidden;">
  {#if nodes.length === 0}
    <div class="flex items-center justify-center h-full text-muted-foreground text-sm">
      표시할 단계가 없습니다
    </div>
  {:else}
    <SvelteFlow
      bind:nodes
      bind:edges
      nodeTypes={{ tool: ToolFlowNode as any }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      fitView
      defaultEdgeOptions={defaultEdgeMarkerOptions}
      onnodeclick={({ node }) => handleNodeClick(node)}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} bgColor="var(--surface-muted)" patternColor="var(--border)" />
      <Controls />
    </SvelteFlow>
  {/if}
</div>

<style>
  :global(.svelte-flow__edge-path) {
    stroke: var(--muted-foreground);
    stroke-width: 1.5;
  }
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
