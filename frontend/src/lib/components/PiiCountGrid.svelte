<script lang="ts">
  import type { PiiCount } from '$lib/api/types.js';
  import PlannedBadge from './PlannedBadge.svelte';

  let { counts }: { counts: PiiCount[] } = $props();
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
  {#each counts as pii}
    <div class={[
      'p-2 border rounded-xs',
      pii.planned
        ? 'border-dashed border-border opacity-60'
        : 'border-border bg-surface-muted',
    ].join(' ')}>
      <div class="text-[10px] text-muted-foreground mb-1">{pii.label}</div>
      <div class="font-mono font-bold text-sm">{pii.planned ? '—' : pii.count}</div>
      {#if pii.planned}
        <PlannedBadge class="mt-1" />
      {/if}
    </div>
  {/each}
</div>
