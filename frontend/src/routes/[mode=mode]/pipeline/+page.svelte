<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import StageNode from '$lib/components/StageNode.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import PlannedBadge from '$lib/components/PlannedBadge.svelte';
  import RunHistoryItem from '$lib/components/RunHistoryItem.svelte';
  import PiiCountGrid from '$lib/components/PiiCountGrid.svelte';
  import MaskingComparison from '$lib/components/MaskingComparison.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import PipelineGraphView from '$lib/components/PipelineGraphView.svelte';
  import type { Stage, Run } from '$lib/api/types.js';

  let { data }: { data: { stages: Stage[]; runs: Run[] } } = $props();

  let selectedStageId = $state(page.url.searchParams.get('stage') ?? 'silver_masked');
  let selectedRunId = $state(page.url.searchParams.get('runA') ?? '');
  let ingested = $state(true);
  let running = $state(false);
  let viewMode = $state<'grid' | 'graph'>('grid');

  onMount(() => { if (browser) { const saved = localStorage.getItem('pipelineViewMode'); if (saved === 'grid' || saved === 'graph') viewMode = saved; } });

  const selectedStage = $derived(data.stages.find(s => s.id === selectedStageId) ?? data.stages[0]);
  const selectedRun = $derived(data.runs.find(r => r.id === selectedRunId) ?? null);

  function selectStage(id: string) {
    selectedStageId = id;
    updateUrl();
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (selectedStageId) params.set('stage', selectedStageId);
    if (selectedRunId) params.set('runA', selectedRunId);
    const qs = params.toString();
    goto(`/${page.params.mode}/pipeline${qs ? '?' + qs : ''}`, { replaceState: true, noScroll: true });
  }

  function setViewMode(mode: 'grid' | 'graph') {
    viewMode = mode;
    if (browser) localStorage.setItem('pipelineViewMode', mode);
  }

  const durationLabel = (ms: number | null) => ms ? `${(ms / 1000).toFixed(1)}s` : '—';
  const timeLabel = (iso: string | null) => iso ? new Date(iso).toLocaleString('ko-KR') : '—';
</script>

<svelte:head>
  <title>파이프라인 — PipeScale</title>
</svelte:head>

<div class="space-y-6">
  <!-- 실행 조작 패널 -->
  <div class="bg-surface border border-border p-4 rounded-sm shadow-sm">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex flex-wrap items-center gap-6">
        <div class="space-y-1">
          <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">활성 실행</div>
          <div class="flex items-center gap-2 font-mono text-sm font-medium">
            <StatusDot status={running ? 'in_progress' : ingested ? 'completed' : 'none'} />
            RUN_ID: RX-9042-ALPHA
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
          onclick={() => { ingested = true; }}
          class="px-4 py-2 border border-border text-sm font-bold uppercase tracking-tight
                 hover:bg-surface-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          샘플 투입
        </button>
        {#if running}
          <button
            type="button"
            onclick={() => { running = false; }}
            class="px-4 py-2 border border-status-failed/40 text-status-failed text-sm font-bold uppercase tracking-tight
                   hover:bg-status-failed/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            중지
          </button>
        {:else}
          <button
            type="button"
            disabled={!ingested}
            onclick={() => { running = true; }}
            class="px-6 py-2 bg-foreground text-background text-sm font-bold uppercase tracking-tight
                   hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            파이프라인 시작
          </button>
        {/if}
        <button
          type="button"
          class="px-4 py-2 border border-border text-sm font-bold uppercase tracking-tight
                 hover:bg-surface-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          재실행
        </button>
      </div>
    </div>
  </div>

  {#if !ingested}
    <!-- 투입 전 빈 상태 -->
    <div class="bg-surface border border-dashed border-border rounded-sm p-12 text-center">
      <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">데이터 없음</div>
      <h2 class="mt-2 text-xl font-bold tracking-tight">샘플 데이터를 투입해 시작하세요</h2>
      <p class="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        파이프라인이 유휴 상태입니다. 위 컨트롤을 사용해 샘플 레코드를 Bronze 레이어에 로드한 뒤 실행을 시작하세요.
      </p>
    </div>
  {:else}
    <!-- 파이프라인 플로우 (CSS Grid 기반 단계 카드) -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">
          데이터 처리 흐름
        </div>
        <div class="flex items-center gap-3">
          <div class="flex border border-border rounded-xs overflow-hidden">
            <button type="button" onclick={() => setViewMode('grid')} aria-pressed={viewMode === 'grid'}
              class={['px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-tight transition-colors', viewMode === 'grid' ? 'bg-foreground text-background' : 'bg-surface text-muted-foreground hover:bg-surface-muted'].join(' ')}>
              Grid
            </button>
            <button type="button" onclick={() => setViewMode('graph')} aria-pressed={viewMode === 'graph'}
              class={['px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-tight transition-colors border-l border-border', viewMode === 'graph' ? 'bg-foreground text-background' : 'bg-surface text-muted-foreground hover:bg-surface-muted'].join(' ')}>
              Graph
            </button>
          </div>
          <span class="text-[10px] font-mono text-muted-foreground uppercase">
            {data.stages.filter(s => !s.planned).length}개 활성 단계 · {data.stages.filter(s => s.planned).length}개 예정
          </span>
        </div>
      </div>
      {#if viewMode === 'graph'}
        <PipelineGraphView stages={data.stages} onselect={selectStage} />
      {:else}
        <div class="relative">
          <div class="absolute top-1/2 left-0 right-0 h-px bg-border -translate-y-1/2 hidden lg:block -z-10" aria-hidden="true"></div>
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {#each data.stages as stage, i}
              <div class={i % 2 === 1 ? 'lg:mt-8' : ''}>
                <StageNode
                  {stage}
                  active={selectedStageId === stage.id}
                  onclick={() => selectStage(stage.id)}
                />
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <!-- 단계 인스펙터 + 실행 이력 -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 단계 인스펙터 -->
      <div class="lg:col-span-8 bg-surface border border-border rounded-sm overflow-hidden flex flex-col">
        <div class="px-4 py-3 bg-surface-muted border-b border-border flex items-center justify-between">
          <h2 class="font-bold text-xs uppercase tracking-widest">인스펙터: {selectedStage.name}</h2>
          <StatusBadge status={selectedStage.planned ? 'none' : selectedStage.status} />
        </div>
        <div class="p-6 space-y-6">
          <!-- 주요 지표 -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div class="space-y-1">
              <span class="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">입력 문서</span>
              <div class="text-xl font-extrabold tabular-nums">{selectedStage.docsIn.toLocaleString()}</div>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">출력 문서</span>
              <div class={['text-xl font-extrabold tabular-nums', selectedStage.docsOut > selectedStage.docsIn ? 'text-primary' : ''].join(' ')}>
                {selectedStage.docsOut.toLocaleString()}
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">소요 시간</span>
              <div class="text-xl font-extrabold tabular-nums">{durationLabel(selectedStage.durationMs)}</div>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">마지막 실행</span>
              <div class="font-mono text-sm font-bold">{timeLabel(selectedStage.lastRunAt)}</div>
            </div>
          </div>

          {#if selectedStage.failureReason}
            <div class="border border-status-failed/30 bg-status-failed/10 text-status-failed text-xs font-mono p-3 rounded-xs">
              {selectedStage.failureReason}
            </div>
          {/if}

          <!-- PII 마스킹 단계 전용 UI -->
          {#if selectedStage.id === 'silver_masked'}
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">마스킹 방식:</span>
                <span class="text-[10px] font-mono font-bold bg-surface-muted px-1.5 py-0.5 rounded-xs uppercase">REGEX_PATTERN</span>
              </div>

              <div class="space-y-3">
                <h4 class="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">감지된 PII 유형</h4>
                <PiiCountGrid counts={[
                  { type: 'KR_PHONE', label: '전화번호', count: 2, planned: false },
                  { type: 'KR_RRN', label: '주민번호', count: 1, planned: false },
                  { type: 'KR_EMAIL', label: '이메일', count: 1, planned: false },
                  { type: 'KR_BANK_ACCOUNT', label: '계좌번호', count: 1, planned: false },
                  { type: 'KR_NAME', label: '이름', count: 3, planned: true },
                  { type: 'KR_ADDRESS', label: '주소', count: 1, planned: true },
                ]} />
              </div>

              <MaskingComparison
                title="샘플 변환 · AP00005928||1"
                before={`고객 연락 010-1234-5678, 이메일 user@hmc.example, 계좌 123-456789-12.`}
                after={`고객 연락 010****1234, 이메일 [이메일 마스킹], 계좌 [계좌번호 마스킹].`}
              />
            </div>
          {/if}

          <div>
            <a
              href={`/${page.params.mode}/documents`}
              class="text-xs font-mono font-bold text-primary underline underline-offset-4 hover:text-primary/80"
            >
              이 단계를 통과한 문서 보기 →
            </a>
          </div>
        </div>
      </div>

      <!-- 실행 이력 -->
      <div class="lg:col-span-4 bg-surface border border-border rounded-sm flex flex-col">
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
  {/if}
</div>
