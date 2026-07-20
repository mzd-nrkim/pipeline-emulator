<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import RunHistoryItem from '$lib/components/RunHistoryItem.svelte';
  import ToolCanvasView from '$lib/components/ToolCanvasView.svelte';
  import type { Stage, Run, CanvasTopology, ToolNode, TaskInstance } from '$lib/api/types.js';
  import { getToolEntry } from '$lib/canvas/toolCatalog';
  import * as mockAdapter from '$lib/api/mock-adapter.js';
  import * as realAdapter from '$lib/api/real-adapter.js';
  import { Dialog } from 'bits-ui';

  let { data }: { data: { stages: Stage[]; runs: Run[]; topology: CanvasTopology } } = $props();

  const currentAdapter = page.params.mode === 'real' ? realAdapter : mockAdapter;

  let selectedRunId = $state(page.url.searchParams.get('runA') ?? '');
  let selectedRunIdB = $state(page.url.searchParams.get('runB') ?? '');
  let compareMode = $state(false);
  let activeRunId = $state<string | null>(null);
  let view = $state<'data' | 'infra'>('data');
  let showOrphans = $state(false);
  let selectedNode = $state<ToolNode | null>(null);
  let localConfig = $state<Record<string, unknown>>({});
  let triggeredRunId = $state<string | null>(null);
  let triggerError = $state<string | null>(null);
  let configSaved = $state(false);
  let configError = $state<string | null>(null);
  let dialogOpen = $state(false);
  let executions = $state<TaskInstance[]>([]);
  let executionsLoading = $state(false);
  let executionsError = $state<string | null>(null);
  let drawerTab = $state<'node' | 'history'>('history');
  let liveStageCounts = $state<Record<string, number>>({});

  $effect(() => {
    localConfig = { ...(selectedNode?.config ?? {}) };
  });

  $effect(() => {
    const cleanup = currentAdapter.subscribePipelineStatus((event: unknown) => {
      const e = event as { type: string; counts: Record<string, number> };
      if (e.type === 'stage_update') {
        liveStageCounts = { ...e.counts };
      }
    });
    return cleanup;
  });

  function handleNodeSelect(node: ToolNode | null) {
    selectedNode = node;
    triggeredRunId = null;
    triggerError = null;
    configSaved = false;
    configError = null;
    if (node) { drawerTab = 'node'; dialogOpen = true; }
  }

  async function handleApplyConfig() {
    if (!selectedNode || !currentAdapter) return;
    configSaved = false;
    configError = null;
    const toolEntry = getToolEntry(selectedNode.tool);
    const runtimeFields = (toolEntry?.configFields ?? [])
      .filter(f => (f.applyMode ?? 'readonly') === 'runtime')
      .map(f => f.key);
    if (runtimeFields.length === 0) return;
    const payload: Record<string, unknown> = {};
    for (const k of runtimeFields) {
      payload[k] = localConfig[k];
    }
    try {
      await currentAdapter.setNodeConfig(selectedNode.id, payload);
      configSaved = true;
    } catch (e) {
      configError = String(e);
    }
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
    if (selectedRunIdB) params.set('runB', selectedRunIdB);
    const qs = params.toString();
    goto(`/${page.params.mode}/pipeline${qs ? '?' + qs : ''}`, { replaceState: true, noScroll: true });
  }

  function getRunById(id: string): Run | undefined {
    return data.runs.find((r) => r.id === id);
  }

  function diffValue(a: unknown, b: unknown): string {
    const na = Number(a);
    const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) {
      const d = nb - na;
      return d > 0 ? `+${d}` : String(d);
    }
    return a === b ? '동일' : '변경';
  }

  function stageCountKeys(runA: Run, runB: Run): string[] {
    const keys = new Set([
      ...Object.keys(runA.stageCounts ?? {}),
      ...Object.keys(runB.stageCounts ?? {}),
    ]);
    return [...keys].sort();
  }

  function configKeys(runA: Run, runB: Run): string[] {
    const keys = new Set([
      ...Object.keys((runA.config ?? {}) as unknown as Record<string, unknown>),
      ...Object.keys((runB.config ?? {}) as unknown as Record<string, unknown>),
    ]);
    return [...keys].sort();
  }

  const rerunLabel = $derived(selectedNode ? '노드 재실행' : '재실행');

  async function handleRerun() {
    triggeredRunId = null;
    triggerError = null;
    try {
      const nodeId = selectedNode ? selectedNode.id : 'bronze_raw';
      const result = await currentAdapter.triggerNode(nodeId, {});
      activeRunId = result.dag_run_id;
    } catch (e) {
      triggerError = String(e);
    }
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
          onclick={handleRerun}
          aria-label={rerunLabel}
          class="px-4 py-2 border border-border text-sm font-bold uppercase tracking-tight
                 hover:bg-surface-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {rerunLabel}
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
        <button
          type="button"
          onclick={() => showOrphans = !showOrphans}
          aria-pressed={showOrphans}
          class="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-tight rounded-xs border border-border transition-colors {showOrphans ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}"
        >
          연결 없는 노드 표시
        </button>
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
        liveStageCounts={liveStageCounts}
        ontrigger={(id) => activeRunId = id}
        {view}
        onnodeselect={handleNodeSelect}
        hideOrphans={!showOrphans}
      />
    </div>

    <!-- 노드 상세·실행 이력 모달 -->
    <Dialog.Root bind:open={dialogOpen}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-3xl w-[90vw] max-h-[85vh] bg-surface border border-border shadow-xl flex flex-col overflow-hidden"
          aria-label="노드 상세 및 실행 이력"
        >
          <!-- 모달 헤더: 탭 + 닫기 -->
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
          <Dialog.Close
            class="text-muted-foreground hover:text-foreground text-xs leading-none px-1"
            aria-label="모달 닫기"
          >
            ✕
          </Dialog.Close>
        </div>

        <!-- 모달 콘텐츠 -->
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
                <div class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">설정</div>
                {#if toolEntry && toolEntry.configFields && toolEntry.configFields.length > 0}
                  {#each toolEntry.configFields as field}
                    {@const applyMode = field.applyMode ?? 'readonly'}
                    {@const isDisabled = applyMode === 'readonly'}
                    <div class="config-field {field.group ? `group-${field.group}` : ''} space-y-0.5">
                      <div class="flex items-center gap-1.5">
                        <label class="block text-[11px] text-muted-foreground">{field.label}</label>
                        {#if applyMode === 'runtime'}
                          <span class="inline-flex items-center gap-0.5 px-1 py-0 text-[10px] font-bold rounded-xs bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700">🟢 실시간적용</span>
                        {:else if applyMode === 'restart'}
                          <span class="inline-flex items-center gap-0.5 px-1 py-0 text-[10px] font-bold rounded-xs bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700">🟡 재기동필요</span>
                        {:else if applyMode === 'code'}
                          <span class="inline-flex items-center gap-0.5 px-1 py-0 text-[10px] font-bold rounded-xs bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700">🔵 코드수정</span>
                        {:else}
                          <span class="inline-flex items-center gap-0.5 px-1 py-0 text-[10px] font-bold rounded-xs bg-surface-muted text-muted-foreground border border-border">🔒 읽기전용</span>
                        {/if}
                      </div>
                      {#if field.type === 'text'}
                        <input type="text" bind:value={localConfig[field.key] as string} placeholder={field.placeholder ?? ''}
                          disabled={isDisabled}
                          class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[11px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary disabled:opacity-50 disabled:cursor-not-allowed" />
                      {:else if field.type === 'number'}
                        <input type="number" bind:value={localConfig[field.key] as number}
                          disabled={isDisabled}
                          class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[11px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary disabled:opacity-50 disabled:cursor-not-allowed" />
                      {:else if field.type === 'select'}
                        <select bind:value={localConfig[field.key] as string}
                          disabled={isDisabled}
                          class="w-full bg-surface-muted border border-border rounded-xs px-2 py-1 text-[11px] font-mono text-foreground focus:outline focus:outline-1 focus:outline-primary disabled:opacity-50 disabled:cursor-not-allowed">
                          {#each field.options ?? [] as opt}
                            <option value={opt}>{opt}</option>
                          {/each}
                        </select>
                      {:else if field.type === 'boolean'}
                        <div class="flex items-center gap-1.5">
                          <input type="checkbox" bind:checked={localConfig[field.key] as boolean}
                            disabled={isDisabled}
                            class="accent-primary disabled:opacity-50 disabled:cursor-not-allowed" />
                          <span class="text-[11px] text-muted-foreground">{field.label}</span>
                        </div>
                      {/if}
                      {#if applyMode === 'restart'}
                        <p class="text-[10px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xs px-1.5 py-0.5 leading-relaxed dark:text-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-800">재기동 후 적용</p>
                      {:else if applyMode === 'code'}
                        <p class="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-xs px-1.5 py-0.5 leading-relaxed dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800">DAG 코드 수정 필요</p>
                      {/if}
                    </div>
                  {/each}
                {:else}
                  <div class="text-[11px] text-muted-foreground italic">설정 없음</div>
                {/if}
              </div>

              <!-- 조작 영역 -->
              <div class="border-t border-border pt-3 space-y-2">
                {#if (getToolEntry(selectedNode.tool)?.configFields ?? []).filter(f => (f.applyMode ?? 'readonly') === 'runtime').length > 0}
                  <button
                    type="button"
                    onclick={handleApplyConfig}
                    class="w-full px-3 py-1.5 border border-primary text-primary text-[10px] font-bold uppercase tracking-tight
                           hover:bg-primary/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    적용
                  </button>
                  {#if configSaved}
                    <div class="text-[10px] text-status-success">설정이 저장되었습니다.</div>
                  {/if}
                  {#if configError}
                    <div class="bg-status-failed/10 border border-status-failed/30 text-status-failed p-2 rounded-xs text-[10px] break-all">{configError}</div>
                  {/if}
                {/if}
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
                  onclick={() => { compareMode = !compareMode; }}
                  class="text-[10px] font-mono text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {compareMode ? '비교 종료' : '비교'}
                </button>
              </div>

              {#if compareMode}
                <!-- 비교 모드: 선택 안내 + 선택 상태 표시 -->
                <div class="px-3 py-2 bg-surface-muted/60 border-b border-border text-[10px] font-mono text-muted-foreground shrink-0 space-y-1">
                  <div>A: <span class="font-bold text-foreground">{selectedRunId || '(미선택)'}</span></div>
                  <div>B: <span class="font-bold text-foreground">{selectedRunIdB || '(미선택)'}</span></div>
                  <div class="text-[9px] text-muted-foreground/70">항목을 클릭해 A → B 순서로 선택</div>
                </div>
              {/if}

              <ul class="divide-y divide-border flex-1 overflow-auto">
                {#each data.runs as run}
                  {#if compareMode}
                    <!-- 비교 모드: A·B 선택 토글 -->
                    <li
                      class="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-muted/50 text-[10px] font-mono
                             {selectedRunId === run.id ? 'bg-primary/10 border-l-2 border-primary' : selectedRunIdB === run.id ? 'bg-amber-50 border-l-2 border-amber-400' : ''}"
                      onclick={() => {
                        if (selectedRunId === run.id) {
                          // A 해제
                          selectedRunId = '';
                          updateUrl();
                        } else if (selectedRunIdB === run.id) {
                          // B 해제
                          selectedRunIdB = '';
                          updateUrl();
                        } else if (!selectedRunId) {
                          selectedRunId = run.id;
                          updateUrl();
                        } else if (!selectedRunIdB) {
                          selectedRunIdB = run.id;
                          updateUrl();
                        } else {
                          // 둘 다 선택 상태면 A 교체
                          selectedRunId = run.id;
                          updateUrl();
                        }
                      }}
                    >
                      <span class="w-5 text-center font-bold text-[9px]">
                        {selectedRunId === run.id ? 'A' : selectedRunIdB === run.id ? 'B' : ''}
                      </span>
                      <StatusDot status={run.status === 'succeeded' ? 'completed' : run.status as import('$lib/api/types.js').StageStatus} />
                      <span class="truncate flex-1">{run.id}</span>
                      <span class="text-muted-foreground">{run.durationMs != null ? `${run.durationMs}ms` : '—'}</span>
                    </li>
                  {:else}
                    <RunHistoryItem
                      {run}
                      active={selectedRunId === run.id}
                      onclick={async () => {
                        selectedRunId = run.id;
                        updateUrl();
                        if (run.dagId) {
                          executionsLoading = true;
                          executionsError = null;
                          try {
                            executions = await Promise.resolve(currentAdapter.fetchExecutions(run.dagId, run.id));
                          } catch (e) {
                            executionsError = String(e);
                          } finally {
                            executionsLoading = false;
                          }
                        }
                      }}
                    />
                  {/if}
                {/each}
              </ul>

              <!-- 태스크 인스턴스 상세 -->
              {#if !compareMode && (executionsLoading || executionsError || executions.length > 0)}
                <div class="shrink-0 border-t border-border px-3 py-3 text-[10px] font-mono">
                  <div class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">태스크 인스턴스</div>
                  {#if executionsLoading}
                    <div class="text-muted-foreground">로딩 중…</div>
                  {:else if executionsError}
                    <div class="text-status-failed">{executionsError}</div>
                  {:else}
                    <ul class="space-y-1">
                      {#each executions as task}
                        <li class="flex items-center gap-2">
                          <StatusDot status={task.state} />
                          <span class="flex-1">{task.taskId}</span>
                          {#if task.durationMs != null}
                            <span class="text-muted-foreground">{task.durationMs}ms</span>
                          {/if}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/if}

              <!-- diff 뷰 -->
              {#if compareMode}
                {@const runA = getRunById(selectedRunId)}
                {@const runB = getRunById(selectedRunIdB)}
                <div class="shrink-0 border-t border-border px-3 py-3 text-[10px] font-mono overflow-auto max-h-72">
                  {#if !runA || !runB}
                    <div class="text-muted-foreground italic">
                      {!runA && !runB ? '비교할 run을 A·B 모두 선택하세요.' : !runA ? 'A run을 선택하세요.' : 'B run을 선택하세요.'}
                    </div>
                  {:else}
                    <!-- durationMs 비교 -->
                    <div class="mb-3">
                      <div class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">실행 시간 (ms)</div>
                      <table class="w-full text-left border-collapse">
                        <thead>
                          <tr class="text-muted-foreground text-[9px]">
                            <th class="pr-2 font-normal">항목</th>
                            <th class="pr-2 font-normal">A</th>
                            <th class="pr-2 font-normal">B</th>
                            <th class="font-normal">차이</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr class="border-t border-border">
                            <td class="pr-2 py-0.5 text-muted-foreground">durationMs</td>
                            <td class="pr-2 py-0.5">{runA.durationMs ?? '—'}</td>
                            <td class="pr-2 py-0.5">{runB.durationMs ?? '—'}</td>
                            <td class="py-0.5 {runA.durationMs != null && runB.durationMs != null && runB.durationMs > runA.durationMs ? 'text-status-failed' : runA.durationMs != null && runB.durationMs != null && runB.durationMs < runA.durationMs ? 'text-status-success' : 'text-muted-foreground'}">
                              {runA.durationMs != null && runB.durationMs != null ? diffValue(runA.durationMs, runB.durationMs) : '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <!-- stageCounts 비교 -->
                    <div class="mb-3">
                      <div class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">스테이지 카운트</div>
                      {#if stageCountKeys(runA, runB).length === 0}
                        <div class="text-muted-foreground italic">스테이지 데이터 없음</div>
                      {:else}
                        <table class="w-full text-left border-collapse">
                          <thead>
                            <tr class="text-muted-foreground text-[9px]">
                              <th class="pr-2 font-normal">스테이지</th>
                              <th class="pr-2 font-normal">A</th>
                              <th class="pr-2 font-normal">B</th>
                              <th class="font-normal">차이</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each stageCountKeys(runA, runB) as key}
                              {@const va = (runA.stageCounts ?? {})[key]}
                              {@const vb = (runB.stageCounts ?? {})[key]}
                              <tr class="border-t border-border">
                                <td class="pr-2 py-0.5 text-muted-foreground">{key}</td>
                                <td class="pr-2 py-0.5">{va ?? '—'}</td>
                                <td class="pr-2 py-0.5">{vb ?? '—'}</td>
                                <td class="py-0.5 {va != null && vb != null ? (Number(vb) > Number(va) ? 'text-status-failed' : Number(vb) < Number(va) ? 'text-status-success' : 'text-muted-foreground') : 'text-muted-foreground'}">
                                  {va != null && vb != null ? diffValue(va, vb) : '—'}
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      {/if}
                    </div>

                    <!-- config 비교 -->
                    <div>
                      <div class="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Config</div>
                      {#if configKeys(runA, runB).length === 0}
                        <div class="text-muted-foreground italic">설정 데이터 없음</div>
                      {:else}
                        <table class="w-full text-left border-collapse">
                          <thead>
                            <tr class="text-muted-foreground text-[9px]">
                              <th class="pr-2 font-normal">키</th>
                              <th class="pr-2 font-normal">A</th>
                              <th class="pr-2 font-normal">B</th>
                              <th class="font-normal">차이</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each configKeys(runA, runB) as key}
                              {@const va = (runA.config as unknown as Record<string, unknown>)[key]}
                              {@const vb = (runB.config as unknown as Record<string, unknown>)[key]}
                              <tr class="border-t border-border">
                                <td class="pr-2 py-0.5 text-muted-foreground">{key}</td>
                                <td class="pr-2 py-0.5 max-w-[4rem] truncate">{va ?? '—'}</td>
                                <td class="pr-2 py-0.5 max-w-[4rem] truncate">{vb ?? '—'}</td>
                                <td class="py-0.5 {String(va) !== String(vb) ? 'text-amber-600' : 'text-muted-foreground'}">
                                  {String(va) === String(vb) ? '동일' : '변경'}
                                </td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <!-- 실행 이력 열기 진입점 (모달 닫힌 상태에서 상시 가시, e2e 호환) -->
    <button
      type="button"
      onclick={() => { dialogOpen = true; drawerTab = 'history'; }}
      class="absolute right-4 top-4 z-10 px-3 py-1.5 bg-surface border border-border text-[10px] font-mono font-bold uppercase tracking-tight text-muted-foreground hover:text-foreground shadow-sm"
      aria-label="실행 이력 열기"
    >
      실행 이력
    </button>
  </div>
</div>
