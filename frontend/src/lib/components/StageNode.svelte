<script lang="ts">
  import type { Stage, Layer } from '$lib/api/types.js';
  import { cn } from '$lib/utils.js';
  import StatusBadge from './StatusBadge.svelte';
  import PlannedBadge from './PlannedBadge.svelte';

  const layerAccent: Record<Layer | string, string> = {
    Bronze: 'border-l-amber-700/40 text-amber-800',
    Silver: 'border-l-slate-400 text-slate-600',
    Gold: 'border-l-amber-500 text-amber-600',
    Serving: 'border-l-primary/40 text-primary',
  };

  let {
    stage,
    active = false,
    onclick,
    compact = false,
  }: {
    stage: Stage;
    active?: boolean;
    onclick?: () => void;
    compact?: boolean;
  } = $props();

  const dimmed = $derived(
    (stage.status === 'pending' || stage.status === 'none') && !stage.planned
  );
</script>

<button
  type="button"
  {onclick}
  class={cn(
    'w-full text-left bg-surface border border-border p-4 rounded-sm shadow-sm transition-all',
    'hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
    active && 'border-primary ring-4 ring-primary/10 shadow-md',
    stage.planned && 'bg-surface-muted border-dashed',
    dimmed && 'opacity-70',
  )}
  aria-pressed={active}
>
  <div class="flex items-center justify-between mb-3">
    <span class={cn('text-[10px] font-mono font-bold uppercase tracking-widest border-l-2 pl-2', layerAccent[stage.layer])}>
      {stage.layer}
    </span>
    <span class="text-[10px] font-mono text-muted-foreground uppercase">
      Stage {String(stage.index).padStart(2, '0')}
    </span>
  </div>
  <h3 class="font-bold text-sm tracking-tight">{stage.name}</h3>
  {#if !compact}
    <p class="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{stage.description}</p>
  {/if}
  <div class="mt-4 pt-3 border-t border-border flex items-center justify-between">
    {#if stage.planned}
      <PlannedBadge />
    {:else}
      <StatusBadge status={stage.status} />
    {/if}
    <span class="font-mono text-xs font-bold tabular-nums">
      {stage.planned ? '—' : stage.docsOut > 0 ? stage.docsOut.toLocaleString() : '—'}
    </span>
  </div>
</button>
