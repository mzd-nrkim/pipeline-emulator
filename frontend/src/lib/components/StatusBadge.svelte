<script lang="ts">
  import type { StageStatus } from '$lib/api/types.js';
  import { cn } from '$lib/utils.js';
  import StatusDot from './StatusDot.svelte';

  const meta: Record<StageStatus, { label: string; chip: string; text: string }> = {
    completed: { label: '완료', chip: 'bg-status-done/10 border-status-done/20', text: 'text-status-done' },
    in_progress: { label: '진행 중', chip: 'bg-status-running/10 border-status-running/20', text: 'text-status-running' },
    pending: { label: '대기', chip: 'bg-muted/10 border-border', text: 'text-muted-foreground' },
    failed: { label: '실패', chip: 'bg-status-failed/10 border-status-failed/20', text: 'text-status-failed' },
    none: { label: '없음', chip: 'bg-transparent border-border border-dashed', text: 'text-muted-foreground' },
  };

  let { status, class: className = '' }: { status: StageStatus; class?: string } = $props();
  const m = $derived(meta[status]);
</script>

<span class={cn(
  'inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase tracking-wider',
  m.chip,
  m.text,
  className
)}>
  <StatusDot {status} />
  {m.label}
</span>
