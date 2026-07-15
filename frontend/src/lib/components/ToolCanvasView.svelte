<script lang="ts">
  import { writable } from 'svelte/store';
  import { SvelteFlow, Background, Controls, type Node as FlowNode, type Edge as FlowEdge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import type { ToolNode, CanvasTopology, Stage } from '$lib/api/types.js';
  import { buildNodesAndEdges } from '$lib/canvas/buildNodesAndEdges.js';
  import { getToolEntry } from '$lib/canvas/toolCatalog';

  type Adapter = {
    triggerNode: (nodeId: string, conf: Record<string, unknown>) => Promise<{ dag_run_id: string }>;
    setNodeConfig: (nodeId: string, config: Record<string, unknown>) => Promise<void>;
  };

  let { topology, adapter = undefined, stages = [] as Stage[], ontrigger = undefined, view = 'data' as 'data' | 'infra' }: {
    topology: CanvasTopology;
    adapter?: Adapter;
    stages?: Stage[];
    ontrigger?: (runId: string) => void;
    view?: 'data' | 'infra';
  } = $props();

  let selectedNode = $state<ToolNode | null>(null);
  let triggeredRunId = $state<string | null>(null);
  let triggerError = $state<string | null>(null);
  let localConfig = $state<Record<string, unknown>>({});

  $effect(() => {
    localConfig = { ...(selectedNode?.config ?? {}) };
  });

  const nodesStore = writable<FlowNode[]>([]);
  const edgesStore = writable<FlowEdge[]>([]);

  $effect(() => {
    const { nodes, edges } = buildNodesAndEdges(topology, view);
    nodesStore.set(nodes);
    edgesStore.set(edges);
  });

  function handleNodeClick(event: CustomEvent<{ node: FlowNode }>) {
    const clicked = topology.nodes.find(n => n.id === event.detail.node.id) ?? null;
    selectedNode = clicked;
    triggeredRunId = null;
    triggerError = null;
  }

  async function handleTrigger() {
    if (!selectedNode || !adapter) return;
    triggeredRunId = null;
    triggerError = null;
    try {
      const result = await adapter.triggerNode(selectedNode.id, {});
      triggeredRunId = result.dag_run_id;
      ontrigger?.(result.dag_run_id);
    } catch (e) {
      triggerError = String(e);
    }
  }
</script>

<div class="relative flex gap-4" style="height: 520px;">
  <!-- Canvas -->
  <div class="flex-1 border border-border rounded-sm overflow-hidden relative">
    <!-- 인프라 뷰 배지 -->
    {#if view === 'infra'}
      <div class="absolute top-2 left-2 z-10 px-2 py-0.5 bg-amber-50 border border-amber-300 rounded-xs text-[10px] font-mono font-bold text-amber-700 uppercase tracking-wide">
        인프라 연결 뷰
      </div>
    {/if}
    <SvelteFlow nodes={nodesStore} edges={edgesStore} fitView on:nodeclick={handleNodeClick}>
      <Background />
      <Controls />
    </SvelteFlow>
  </div>

  <!-- Drill-down 패널 -->
  {#if selectedNode}
    {@const toolEntry = getToolEntry(selectedNode.tool)}
    <div class="w-72 bg-surface border border-border rounded-sm p-4 flex flex-col gap-3 overflow-auto text-xs font-mono">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          {#if toolEntry?.icon}
            <span class="text-base leading-none">{toolEntry.icon}</span>
          {/if}
          <span class="font-bold uppercase tracking-widest text-[10px]">노드 상세</span>
        </div>
        <button type="button" onclick={() => selectedNode = null} class="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div class="text-[10px] font-bold text-foreground">{toolEntry?.displayName ?? selectedNode.tool}</div>
      {#if toolEntry?.vendor}
        <div class="text-[10px] text-muted-foreground -mt-1">벤더: <span class="font-bold text-foreground">{toolEntry.vendor}</span></div>
      {/if}
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
          <span class="text-muted-foreground">role</span>
          <span class="ml-2 font-bold">{selectedNode.role}</span>
        </div>
        {#if selectedNode.trigger}
          <div>
            <span class="text-muted-foreground">trigger</span>
            <span class="ml-2 font-bold text-amber-600">true</span>
          </div>
        {/if}
      </div>

      <!-- 설정 폼 -->
      <div class="border-t border-border pt-3 space-y-2">
        <div class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">설정</div>
        {#if toolEntry && toolEntry.configFields && toolEntry.configFields.length > 0}
          {#each toolEntry.configFields as field}
            <div class="config-field {field.group ? `group-${field.group}` : ''} space-y-0.5">
              <label class="block text-[10px] text-muted-foreground">{field.label}</label>
              {#if field.type === 'text'}
                <input type="text" bind:value={localConfig[field.key]} placeholder={field.placeholder ?? ''}
                  class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[10px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary" />
              {:else if field.type === 'number'}
                <input type="number" bind:value={localConfig[field.key]}
                  class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[10px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary" />
              {:else if field.type === 'select'}
                <select bind:value={localConfig[field.key]}
                  class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[10px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary">
                  {#each field.options ?? [] as opt}
                    <option value={opt}>{opt}</option>
                  {/each}
                </select>
              {:else if field.type === 'boolean'}
                <div class="flex items-center gap-1.5">
                  <input type="checkbox" bind:checked={localConfig[field.key] as boolean}
                    class="accent-primary" />
                  <span class="text-[10px] text-muted-foreground">{field.label}</span>
                </div>
              {/if}
            </div>
          {/each}
          <p class="mock-notice text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xs px-2 py-1 leading-relaxed">
            ⚠ 설정 변경은 로컬 상태에만 반영됩니다. 실제 적용은 후속 실 API 연동 계획에서 구현 예정입니다.
          </p>
        {:else}
          <div class="text-[10px] text-muted-foreground italic">설정 없음</div>
        {/if}
      </div>

      <!-- 조작 영역 -->
      <div class="border-t border-border pt-3 space-y-2">
        {#if selectedNode.config?.dagId}
          <!-- Airflow 연동 노드: 트리거 버튼 -->
          <div class="text-[10px] text-muted-foreground">
            DAG: <span class="font-bold text-foreground">{selectedNode.config.dagId}</span>
          </div>
          {#if adapter}
            <button
              type="button"
              onclick={handleTrigger}
              class="w-full px-3 py-1.5 bg-foreground text-background text-[10px] font-bold uppercase tracking-tight
                     hover:bg-foreground/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              트리거
            </button>
          {/if}
          {#if triggeredRunId}
            <div class="bg-surface-muted p-2 rounded-xs text-[10px] break-all">
              <span class="text-muted-foreground">dag_run_id</span>
              <span class="ml-1 font-bold text-foreground">{triggeredRunId}</span>
            </div>
          {/if}
          {#if triggerError}
            <div class="bg-status-failed/10 border border-status-failed/30 text-status-failed p-2 rounded-xs text-[10px] break-all">
              {triggerError}
            </div>
          {/if}
        {:else}
          <!-- mock 노드: 상태 조회 전용 배지 -->
          <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-muted border border-border rounded-xs text-[10px] text-muted-foreground">
            <span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 inline-block"></span>
            상태 조회 전용 · 실동작은 F2/F3/F7
          </div>
        {/if}
      </div>

      <!-- 트리거 결과 표시 -->
      {#if triggeredRunId}
        <div class="mt-auto border-t border-border pt-3 text-[10px] text-muted-foreground leading-relaxed">
          run: {triggeredRunId}
        </div>
      {:else}
        <div class="mt-auto border-t border-border pt-3 text-[10px] text-muted-foreground leading-relaxed">
          노드를 트리거하면 결과가 여기에 표시됩니다.
        </div>
      {/if}
    </div>
  {/if}
</div>
