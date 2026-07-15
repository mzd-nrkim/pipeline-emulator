<script lang="ts">
  import type { Run } from '$lib/api/types.js';
  import { cn } from '$lib/utils.js';

  const statusBorder: Record<string, string> = {
    succeeded: 'border-l-status-done',
    failed: 'border-l-status-failed',
    in_progress: 'border-l-status-running',
  };

  const statusLabel: Record<string, string> = {
    succeeded: '성공',
    failed: '실패',
    in_progress: '진행 중',
  };

  const stageLabel: Record<string, string> = {
    ingestion: '수집',
    bronze_raw: 'Bronze Raw',
    silver_structured: 'Silver 구조화',
    silver_masked: 'Silver 마스킹',
    gold_chunked: 'Gold 청킹',
    gold_enriched: 'Gold 임베딩',
    gold_staged: 'Gold 적재',
  };

  let {
    run,
    active = false,
    onclick,
  }: {
    run: Run;
    active?: boolean;
    onclick?: () => void;
  } = $props();

  const durationSec = $derived(Math.round(run.durationMs / 1000));

  let expanded = $state(false);

  function toggleDetail(e: MouseEvent) {
    e.stopPropagation();
    expanded = !expanded;
  }

  const stageEntries = $derived(
    run.stageCounts ? Object.entries(run.stageCounts) : []
  );
</script>

<li class={cn(
  'border-l-4 transition-colors',
  active && 'bg-primary/5',
  statusBorder[run.status] ?? 'border-l-border',
)}>
  <button type="button" {onclick} class="w-full text-left focus-visible:outline-none p-3 hover:bg-surface-muted cursor-pointer">
    <div class="flex justify-between items-start">
      <span class="font-mono text-xs font-bold">{run.id}</span>
      <span class="text-[10px] font-bold uppercase text-muted-foreground">
        {statusLabel[run.status] ?? run.status}
      </span>
    </div>
    <div class="text-[10px] font-mono text-muted-foreground mt-1">
      {new Date(run.startedAt).toLocaleString('ko-KR')} · {durationSec}초
    </div>
    <div class="flex gap-3 mt-1 text-[10px] text-muted-foreground">
      <span>마스킹: {run.config.masking ? '✓' : '✗'}</span>
      <span>검색: {run.config.search ? '✓' : '✗'}</span>
    </div>
  </button>

  <!-- 상세 드릴다운 토글 버튼 -->
  <div class="px-3 pb-2">
    <button
      type="button"
      onclick={toggleDetail}
      class="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 cursor-pointer focus-visible:outline-none"
    >
      {expanded ? '▲ 상세 닫기' : '▼ 단계별 상세'}
    </button>
  </div>

  <!-- 드릴다운 상세 패널 -->
  {#if expanded}
    <div class="px-3 pb-3 space-y-2">
      <!-- stageCounts 표 -->
      {#if stageEntries.length > 0}
        <table class="w-full text-[10px] font-mono border-collapse">
          <thead>
            <tr class="text-muted-foreground">
              <th class="text-left pb-1 font-medium">단계</th>
              <th class="text-right pb-1 font-medium">건수</th>
            </tr>
          </thead>
          <tbody>
            {#each stageEntries as [stage, count]}
              <tr class="border-t border-border/40">
                <td class="py-0.5 text-foreground/80">
                  {stageLabel[stage] ?? stage}
                </td>
                <td class={cn(
                  'py-0.5 text-right tabular-nums',
                  count === 0 ? 'text-status-failed' : 'text-foreground'
                )}>
                  {count}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="text-[10px] text-muted-foreground italic">데이터 없음</p>
      {/if}

      <!-- 실패 사유 -->
      {#if run.failureReason}
        <div class="mt-1 p-2 rounded bg-status-failed/10 text-[10px] text-status-failed">
          <span class="font-bold">실패 사유:</span> {run.failureReason}
        </div>
      {/if}
    </div>
  {/if}
</li>
