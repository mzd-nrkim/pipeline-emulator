<script lang="ts">
  import { writable } from 'svelte/store';
  import { SvelteFlow, Background, Controls, type Node, type Edge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import LRFlowNode from './LRFlowNode.svelte';
  import type { Stage } from '$lib/api/types.js';

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
        type: 'lrnode',
        position: { x: LAYER_X[layer] ?? 0, y },
        data: { label: stage.name },
        style: stage.planned
          ? 'border: 2px dashed #888; opacity: 0.5; background: transparent; padding: 8px; border-radius: 4px; font-size: 11px;'
          : 'border: 1px solid #333; background: #fff; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
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

  // @xyflow/svelte 0.1.39 requires Writable<Node[]> / Writable<Edge[]>
  const nodesStore = writable<Node[]>([]);
  const edgesStore = writable<Edge[]>([]);

  $effect(() => {
    const { nodes, edges } = buildNodesAndEdges(stages);
    nodesStore.set(nodes);
    edgesStore.set(edges);
  });

  function handleNodeClick(event: CustomEvent<{ node: Node; event: MouseEvent | TouchEvent }>) {
    onselect(event.detail.node.id);
  }
</script>

<div style="height: 420px; width: 100%; border: 1px solid var(--color-border); border-radius: 2px; overflow: hidden;">
  {#if $nodesStore.length === 0}
    <div class="flex items-center justify-center h-full text-muted-foreground text-sm">
      표시할 단계가 없습니다
    </div>
  {:else}
    <SvelteFlow
      nodes={nodesStore}
      edges={edgesStore}
      nodeTypes={{ lrnode: LRFlowNode as any }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      fitView
      on:nodeclick={handleNodeClick}
    >
      <Background />
      <Controls />
    </SvelteFlow>
  {/if}
</div>
