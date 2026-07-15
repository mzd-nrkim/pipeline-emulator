<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import RunHistoryItem from '$lib/components/RunHistoryItem.svelte';
  import ToolCanvasView from '$lib/components/ToolCanvasView.svelte';
  import type { Stage, Run, CanvasTopology, ToolNode } from '$lib/api/types.js';
  import { getToolEntry } from '$lib/canvas/toolCatalog';
  import * as mockAdapter from '$lib/api/mock-adapter.js';
  import * as realAdapter from '$lib/api/real-adapter.js';

  let { data }: { data: { stages: Stage[]; runs: Run[]; topology: CanvasTopology } } = $props();

  const currentAdapter = page.params.mode === 'real' ? realAdapter : mockAdapter;

  let selectedRunId = $state(page.url.searchParams.get('runA') ?? '');
  let activeRunId = $state<string | null>(null);
  let view = $state<'data' | 'infra'>('data');
  let selectedNode = $state<ToolNode | null>(null);
  let localConfig = $state<Record<string, unknown>>({});
  let triggeredRunId = $state<string | null>(null);
  let triggerError = $state<string | null>(null);
  let drawerOpen = $state(true);
  let drawerTab = $state<'node' | 'history'>('history');

  $effect(() => {
    localConfig = { ...(selectedNode?.config ?? {}) };
  });

  function handleNodeSelect(node: ToolNode | null) {
    selectedNode = node;
    triggeredRunId = null;
    triggerError = null;
    if (node) drawerTab = 'node';
  }

  async function handleTrigger() {
    if (!selectedNode || !currentAdapter) return;
    triggeredRunId = null;
    triggerError = null;
    try {
      const result = await currentAdapter.triggerNode(selectedNode.id, {});
      triggeredRunId = result.dag_run_id;
      activeRunId = result.dag_run_id;
    } catch (e) {
      triggerError = String(e);
    }
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (selectedRunId) params.set('runA', selectedRunId);
    const qs = params.toString();
    goto(`/${page.params.mode}/pipeline${qs ? '?' + qs : ''}`, { replaceState: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>파이프라인 — PipeScale</title>
</svelte:head>

<div class="flex flex-col flex-1 min-h-0">
  <!-- 실행 조작 패널 -->
  <div class="shrink-0 bg-surface border border-border p-4 rounded-sm shadow-sm">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex flex-wrap items-center gap-6">
        <div class="space-y-1">
          <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">활성 실행</div>
          <div class="flex items-center gap-2 font-mono text-sm font-medium">
            <StatusDot status={activeRunId ? 'completed' : 'none'} />
            RUN_ID: {activeRunId ?? '—'}
          </div>
        </div>
        <div class="hidden md:block h-10 w-px bg-border"></div>
        <div class="space-y-1">
          <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">투입 볼륨</div>
          <div class="text-sm font-semibold">5건 / 12.4 KB · PII 밀도 높음</div>
        </div>
        <div class="hidden md:block h-10 w-px bg-border"></div>
        <div class="space-y-1">
          <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">구성</div>
          <div class="text-sm font-mono">masking=regex · search=off</div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="px-4 py-2 border border-border text-sm font-bold uppercase tracking-tight
                 hover:bg-surface-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          재실행
        </button>
        <!-- 뷰 셀렉터 -->
        <div class="flex items-center gap-1 border border-border rounded-xs p-0.5">
          <button
            type="button"
            onclick={() => view = 'data'}
            class="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-tight rounded-xs transition-colors {view === 'data' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}"
          >
            데이터흐름
          </button>
          <button
            type="button"
            onclick={() => view = 'infra'}
            class="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-tight rounded-xs transition-colors {view === 'infra' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}"
          >
            인프라
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Canvas 뷰 + 실행 이력 -->
  <div class="relative flex-1 min-h-0">
    <div class="absolute inset-0">
      <ToolCanvasView
        topology={data.topology}
        adapter={currentAdapter}
        stages={data.stages}
        ontrigger={(id) => activeRunId = id}
        {view}
        onnodeselect={handleNodeSelect}
      />
    </div>

    <!-- 오버레이 드로어 -->
    {#if drawerOpen}
      <div class="absolute right-0 top-0 h-full w-80 z-20 shadow-xl bg-surface border-l border-border flex flex-col">
        <!-- 드로어 헤더 + 탭 + 닫기 -->
        <div class="shrink-0 flex items-center justify-between border-b border-border px-3 py-2">
          <div class="flex gap-0.5">
            <button
              type="button"
              onclick={() => drawerTab = 'node'}
              disabled={!selectedNode}
              class="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-tight rounded-xs transition-colors {drawerTab === 'node' && selectedNode ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground disabled:opacity-40'}"
            >
              노드 상세
            </button>
            <button
              type="button"
              onclick={() => drawerTab = 'history'}
              class="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-tight rounded-xs transition-colors {drawerTab === 'history' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}"
            >
              실행 이력
            </button>
          </div>
          <button
            type="button"
            onclick={() => drawerOpen = false}
            class="text-muted-foreground hover:text-foreground text-xs leading-none px-1"
            aria-label="드로어 닫기"
          >
            ✕
          </button>
        </div>

        <!-- 드로어 콘텐츠 -->
        <div class="flex-1 overflow-auto">

          <!-- 노드 상세 탭 -->
          {#if drawerTab === 'node' && selectedNode}
            {@const toolEntry = getToolEntry(selectedNode.tool)}
            <div class="p-4 flex flex-col gap-3 text-xs font-mono">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  {#if toolEntry?.icon}
                    <span class="text-base leading-none">{toolEntry.icon}</span>
                  {/if}
                </div>
                <button type="button" onclick={() => selectedNode = null} class="text-muted-foreground hover:text-foreground" aria-label="노드 선택 해제">✕</button>
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
                        <input type="text" bind:value={localConfig[field.key] as string} placeholder={field.placeholder ?? ''}
                          class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[10px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary" />
                      {:else if field.type === 'number'}
                        <input type="number" bind:value={localConfig[field.key] as number}
                          class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[10px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary" />
                      {:else if field.type === 'select'}
                        <select bind:value={localConfig[field.key] as string}
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
                  <div class="text-[10px] text-muted-foreground">
                    DAG: <span class="font-bold text-foreground">{selectedNode.config.dagId}</span>
                  </div>
                  {#if currentAdapter}
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
                  <div class="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-muted border border-border rounded-xs text-[10px] text-muted-foreground">
                    <span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 inline-block"></span>
                    상태 조회 전용 · 실동작은 F2/F3/F7
                  </div>
                {/if}
              </div>

              <!-- 트리거 결과 -->
              <div class="mt-auto border-t border-border pt-3 text-[10px] text-muted-foreground leading-relaxed">
                {#if triggeredRunId}
                  run: {triggeredRunId}
                {:else}
                  노드를 트리거하면 결과가 여기에 표시됩니다.
                {/if}
              </div>
            </div>

          <!-- 실행 이력 탭 -->
          {:else if drawerTab === 'history'}
            <div class="flex flex-col h-full">
              <div class="px-4 py-3 bg-surface-muted border-b border-border flex items-center justify-between shrink-0">
                <h2 class="font-bold text-xs uppercase tracking-widest">실행 이력</h2>
                <button
                  type="button"
                  class="text-[10px] font-mono text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  비교
                </button>
              </div>
              <ul class="divide-y divide-border flex-1">
                {#each data.runs as run}
                  <RunHistoryItem
                    {run}
                    active={selectedRunId === run.id}
                    onclick={() => {
                      selectedRunId = run.id;
                      updateUrl();
                    }}
                  />
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- 드로어 열기 버튼 -->
      <button
        type="button"
        onclick={() => drawerOpen = true}
        class="absolute right-0 top-4 z-20 px-1.5 py-3 bg-surface border border-border border-r-0 rounded-l-sm text-[10px] font-mono text-muted-foreground hover:text-foreground shadow-sm writing-mode-vertical"
        aria-label="드로어 열기"
      >
        ▶
      </button>
    {/if}
  </div>
</div>
