<script lang="ts">
  import type { Dimension } from '$lib/api/types.js';
  import PlannedBadge from './PlannedBadge.svelte';

  let {
    dimension,
    onchange,
  }: {
    dimension: Dimension;
    onchange?: (value: string) => void;
  } = $props();
</script>

<div class="space-y-2">
  <div class="flex items-center gap-2">
    <span class="text-sm font-medium">{dimension.label}</span>
    {#if dimension.planned}
      <PlannedBadge />
    {/if}
  </div>
  <p class="text-xs text-muted-foreground">{dimension.description}</p>
  <div class="flex">
    {#each dimension.values as value, i}
      {@const active = dimension.current === value}
      <button
        type="button"
        onclick={() => !dimension.planned && onchange?.(value)}
        disabled={!!dimension.planned}
        aria-pressed={active}
        aria-disabled={!!dimension.planned}
        class={[
          'px-4 py-2 border text-xs font-bold uppercase tracking-wide transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
          i === 0 && 'rounded-l-xs',
          i === dimension.values.length - 1 && 'rounded-r-xs',
          active && !dimension.planned
            ? 'bg-foreground text-background border-foreground'
            : 'bg-surface border-border text-muted-foreground hover:text-foreground',
          dimension.planned && 'opacity-50 cursor-not-allowed',
        ].filter(Boolean).join(' ')}
      >
        {value}
      </button>
    {/each}
  </div>
</div>
