<script lang="ts">
  import type { StageStatus } from '$lib/api/types.js';
  import { cn } from '$lib/utils.js';

  const dotStyles: Record<StageStatus, string> = {
    completed: 'bg-status-done',
    in_progress: 'bg-status-running animate-status-pulse',
    pending: 'bg-status-pending',
    failed: 'bg-status-failed',
    none: 'bg-status-empty',
  };

  const labels: Record<StageStatus, string> = {
    completed: '완료',
    in_progress: '진행 중',
    pending: '대기',
    failed: '실패',
    none: '없음',
  };

  let { status, class: className = '' }: { status: StageStatus; class?: string } = $props();
</script>

<span
  class={cn('inline-block size-2 rounded-full', dotStyles[status], className)}
  aria-label={labels[status]}
></span>
