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
</script>

<li class={cn(
  'p-3 border-l-4 cursor-pointer hover:bg-surface-muted transition-colors',
  active && 'bg-primary/5',
  statusBorder[run.status] ?? 'border-l-border',
)}>
  <button type="button" {onclick} class="w-full text-left focus-visible:outline-none">
    <div class="flex justify-between items-start">
      <span class="font-mono text-xs font-bold">{run.id}</span>
      <span class="text-[10px] font-bold uppercase text-muted-foreground">
        {statusLabel[run.status] ?? run.status}
      </span>
    </div>
    <div class="text-[10px] font-mono text-muted-foreground mt-1">
      {new Date(run.startedAt).toLocaleString('ko-KR')} · {durationSec}초
    </div>
  </button>
</li>
