<script lang="ts">
  import type { Stage } from '$lib/api/types.js';

  let { stages, onselect }: { stages: Stage[]; onselect: (id: string) => void } = $props();

  // @xyflow/svelte 0.1.x API - 실물 export 확인 필요
  // node_modules는 워크트리에 없으므로, 구현만 작성 (npm run check는 머지 후 실행)
  import { SvelteFlow, Background, Controls, type Node, type Edge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

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

  function buildNodesAndEdges(stages: Stage[]): { nodes: Node[]; edges: Edge[] } {
    if (!stages.length) return { nodes: [], edges: [] };

    const layerCounters: Record<string, number> = { Bronze: 0, Silver: 0, Gold: 0, Serving: 0 };
    const nodes: Node[] = stages.map((stage) => {
      const layer = stage.layer;
      const yOffsets = LAYER_Y_OFFSETS[layer] ?? [0];
      const idx = layerCounters[layer] ?? 0;
      layerCounters[layer] = idx + 1;
      const y = yOffsets[idx] ?? idx * 120;

      return {
        id: stage.id,
        type: 'default',
        position: { x: LAYER_X[layer] ?? 0, y },
        data: { label: stage.name, stage },
        style: stage.planned
          ? 'border: 2px dashed #888; opacity: 0.5; background: transparent; padding: 8px; border-radius: 4px; font-size: 11px;'
          : 'border: 1px solid #333; background: #fff; padding: 8px; border-radius: 4px; font-size: 11px; cursor: pointer;',
      };
    });

    const edges: Edge[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      if (!stages[i].planned && !stages[i + 1].planned) {
        edges.push({
          id: `e${stages[i].id}-${stages[i + 1].id}`,
          source: stages[i].id,
          target: stages[i + 1].id,
          animated: true,
        });
      }
    }

    return { nodes, edges };
  }

  const { nodes, edges } = $derived(buildNodesAndEdges(stages));

  function handleNodeClick(_event: MouseEvent, node: Node) {
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
      {nodes}
      {edges}
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
