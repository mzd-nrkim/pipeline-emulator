<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import RunHistoryItem from '$lib/components/RunHistoryItem.svelte';
  import ToolCanvasView from '$lib/components/ToolCanvasView.svelte';
  import type { Stage, Run, CanvasTopology } from '$lib/api/types.js';
  import * as mockAdapter from '$lib/api/mock-adapter.js';
  import * as realAdapter from '$lib/api/real-adapter.js';

  let { data }: { data: { stages: Stage[]; runs: Run[]; topology: CanvasTopology } } = $props();

  const currentAdapter = page.params.mode === 'real' ? realAdapter : mockAdapter;

  let selectedRunId = $state(page.url.searchParams.get('runA') ?? '');
  let activeRunId = $state<string | null>(null);
  let view = $state<'data' | 'infra'>('data');

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

<div class="flex flex-col h-full min-h-0">
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
    <div class="">
      <ToolCanvasView
        topology={data.topology}
        adapter={currentAdapter}
        stages={data.stages}
        ontrigger={(id) => activeRunId = id}
        {view}
      />
    </div>

    <!-- 실행 이력 -->
    <div class="hidden bg-surface border border-border rounded-sm flex flex-col">
      <div class="px-4 py-3 bg-surface-muted border-b border-border flex items-center justify-between">
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
  </div>
</div>
