<script lang="ts">
  import { SvelteFlow, Background, Controls, Panel, BackgroundVariant, type Node as FlowNode, type Edge as FlowEdge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import ToolFlowNode from '$lib/components/ToolFlowNode.svelte';
  import AirflowGroupNode from '$lib/components/AirflowGroupNode.svelte';
  import InfraStepEdge from './InfraStepEdge.svelte';
  import type { ToolNode, CanvasTopology, Stage } from '$lib/api/types.js';
  import { buildNodesAndEdges } from '$lib/canvas/buildNodesAndEdges.js';
  import { defaultEdgeMarkerOptions } from '$lib/canvas/edgeMarker.js';

  type Adapter = {
    triggerNode: (nodeId: string, conf: Record<string, unknown>) => Promise<{ dag_run_id: string }>;
  };

  let { topology, adapter = undefined, stages = [] as Stage[], liveStageCounts = undefined as Record<string, number> | undefined, ontrigger = undefined, view = 'data' as 'data' | 'infra', onnodeselect = undefined, hideOrphans = true, onGroupSelect = undefined }: {
    topology: CanvasTopology;
    adapter?: Adapter;
    stages?: Stage[];
    liveStageCounts?: Record<string, number>;
    ontrigger?: (runId: string) => void;
    view?: 'data' | 'infra';
    onnodeselect?: (node: ToolNode | null) => void;
    hideOrphans?: boolean;
    onGroupSelect?: (groupId: string) => void;
  } = $props();

  let nodes = $state.raw<FlowNode[]>([]);
  let edges = $state.raw<FlowEdge[]>([]);

  let collapsedGroups = $state(new Set<string>());

  // topology에서 그룹 ID(자식을 가진 노드) 추출
  let allGroupIds = $derived(
    topology
      ? topology.nodes
          .filter((n: any) => topology.nodes.some((c: any) => c.parentId === n.id))
          .map((n: any) => n.id)
      : []
  );

  let allCollapsed = $derived(allGroupIds.length > 0 && allGroupIds.every((id: string) => collapsedGroups.has(id)));

  function toggleAllGroups() {
    if (allCollapsed) {
      collapsedGroups = new Set();
    } else {
      collapsedGroups = new Set(allGroupIds);
    }
  }

  // topology prop 참조가 실제로 바뀔 때만 그룹을 접힘 상태로 리셋
  let lastTopology: CanvasTopology | undefined = undefined;
  $effect(() => {
    const topo = topology;            // 유일한 추적 의존성
    if (topo === lastTopology) return;
    lastTopology = topo;
    const ids = topo
      ? topo.nodes.filter((n: any) => topo.nodes.some((c: any) => c.parentId === n.id)).map((n: any) => n.id)
      : [];
    collapsedGroups = new Set(ids);
  });

  function toggleCollapse(groupId: string) {
    const next = new Set(collapsedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    collapsedGroups = next;
  }

  $effect(() => {
    const result = buildNodesAndEdges(topology, view, hideOrphans, collapsedGroups);
    const mappedNodes = result.nodes.map(n => {
      if (n.type === 'group') {
        return {
          ...n,
          data: {
            ...n.data,
            onTitleClick: () => onGroupSelect?.(n.id),
            onToggleCollapse: () => toggleCollapse(n.id),
            ...(liveStageCounts ? { liveCount: liveStageCounts[n.id] ?? 0 } : {}),
          },
        };
      }
      // collapsed 그룹은 type:'tool'로 렌더되므로 onToggleCollapse 배선
      if ((n.data as any).collapsed === true) {
        return {
          ...n,
          data: {
            ...n.data,
            onToggleCollapse: () => toggleCollapse(n.id),
            ...(liveStageCounts ? { liveCount: liveStageCounts[n.id] ?? 0 } : {}),
          },
        };
      }
      return liveStageCounts
        ? { ...n, data: { ...n.data, liveCount: liveStageCounts[n.id] ?? 0 } }
        : n;
    });
    nodes = mappedNodes;
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
    <SvelteFlow bind:nodes bind:edges nodeTypes={{ tool: ToolFlowNode as any, group: AirflowGroupNode as any }} edgeTypes={{ 'infra-step': InfraStepEdge as any }} fitView fitViewOptions={{ minZoom: 0.6, maxZoom: 1.2 }} defaultEdgeOptions={defaultEdgeMarkerOptions} onnodeclick={({ node }) => { if (node.type === 'group') return; if ((node.data as any).collapsed === true) { (node.data as any).onToggleCollapse?.(); return; } const clicked = topology.nodes.find(n => n.id === node.id) ?? null; onnodeselect?.(clicked); }}>
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} bgColor="var(--surface-muted)" patternColor="var(--border)" />
      <Controls />
      {#if view === 'data' && allGroupIds.length > 0}
        <Panel position="top-left">
          <button
            onclick={toggleAllGroups}
            data-testid="toggle-all-groups"
            class="px-2 py-1 text-sm bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
          >
            {allCollapsed ? '▾ 모두 펼치기' : '▸ 모두 접기'}
          </button>
        </Panel>
      {/if}
    </SvelteFlow>
  </div>
</div>

<style>
  :global(.svelte-flow__edge-path) {
    stroke: var(--muted-foreground);
    stroke-width: 1.5;
  }
  /* 그룹 노드(airflow extended)의 SvelteFlow 기본 검은 실선 테두리 제거 —
     테두리는 AirflowGroupNode의 파란 점선만 남긴다 */
  :global(.svelte-flow__node-group) {
    border: none;
    background: transparent;
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
