<script lang="ts">
  import { writable } from 'svelte/store';
  import { SvelteFlow, Background, Controls, type Node as FlowNode, type Edge as FlowEdge } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import type { ToolNode, CanvasTopology, Stage } from '$lib/api/types.js';
  import { buildNodesAndEdges } from '$lib/canvas/buildNodesAndEdges.js';
  import PiiCountGrid from '$lib/components/PiiCountGrid.svelte';
  import MaskingComparison from '$lib/components/MaskingComparison.svelte';

  type Adapter = {
    triggerNode: (nodeId: string, conf: Record<string, unknown>) => Promise<{ dag_run_id: string }>;
    setNodeConfig: (nodeId: string, config: Record<string, unknown>) => Promise<void>;
  };

  let { topology, adapter = undefined, stages = [] as Stage[], ontrigger = undefined }: {
    topology: CanvasTopology;
    adapter?: Adapter;
    stages?: Stage[];
    ontrigger?: (runId: string) => void;
  } = $props();

  let selectedNode = $state<ToolNode | null>(null);
  let triggeredRunId = $state<string | null>(null);
  let triggerError = $state<string | null>(null);

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

      <!-- Medallion 증거 (masking-task 전용 + run_id 바인딩) -->
      {#if selectedNode.id === 'masking-task'}
        {@const maskingStage = stages.find(s => s.id === 'silver_masked')}
        {#if maskingStage}
          <div class="border-t border-border pt-3 space-y-3">
            <div class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
              <span>medallion 증거</span>
              {#if triggeredRunId}<span class="font-mono font-normal truncate max-w-[120px]" title={triggeredRunId}>{triggeredRunId}</span>{/if}
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-surface-muted p-2 rounded-xs">
                <div class="text-[10px] text-muted-foreground">입력 문서</div>
                <div class="text-base font-bold tabular-nums">{maskingStage.docsIn.toLocaleString()}</div>
              </div>
              <div class="bg-surface-muted p-2 rounded-xs">
                <div class="text-[10px] text-muted-foreground">출력 문서</div>
                <div class="text-base font-bold tabular-nums">{maskingStage.docsOut.toLocaleString()}</div>
              </div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">마스킹 방식</div>
              <span class="text-[10px] font-mono font-bold bg-surface-muted px-1.5 py-0.5 rounded-xs uppercase">REGEX_PATTERN</span>
            </div>
            <PiiCountGrid counts={[
              { type: 'KR_PHONE', label: '전화번호', count: 2, planned: false },
              { type: 'KR_RRN', label: '주민번호', count: 1, planned: false },
              { type: 'KR_EMAIL', label: '이메일', count: 1, planned: false },
              { type: 'KR_BANK_ACCOUNT', label: '계좌번호', count: 1, planned: false },
              { type: 'KR_NAME', label: '이름', count: 3, planned: true },
              { type: 'KR_ADDRESS', label: '주소', count: 1, planned: true },
            ]} />
            <MaskingComparison
              title="샘플 변환 · AP00005928||1"
              before={`고객 연락 010-1234-5678, 이메일 user@hmc.example, 계좌 123-456789-12.`}
              after={`고객 연락 010****1234, 이메일 [이메일 마스킹], 계좌 [계좌번호 마스킹].`}
            />
          </div>
        {/if}
      {:else}
        <div class="mt-auto border-t border-border pt-3 text-[10px] text-muted-foreground leading-relaxed">
          {#if triggeredRunId}run: {triggeredRunId}{:else}노드를 트리거하면 증거가 여기에 표시됩니다.{/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
