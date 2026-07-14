<script lang="ts">
  import type { Layer } from '$lib/api/types.js';

  const layers: Layer[] = ['Bronze', 'Silver', 'Gold', 'Serving'];

  const layerStyles = (layer: Layer, currentLayer: Layer): string => {
    const idx = layers.indexOf(layer);
    const currentIdx = layers.indexOf(currentLayer);
    if (idx < currentIdx) return 'bg-foreground text-background border-foreground';
    if (idx === currentIdx) return 'border-primary text-primary';
    return 'border-dashed border-border text-muted-foreground';
  };

  let { current = 'Gold' }: { current?: Layer } = $props();
</script>

<div class="flex items-center gap-3">
  {#each layers as layer, i}
    <div class="flex items-center gap-3">
      <span class={[
        'px-3 py-1 border rounded-xs text-[10px] font-mono font-bold uppercase tracking-widest',
        layerStyles(layer, current)
      ].join(' ')}>
        {layer}
      </span>
      {#if i < layers.length - 1}
        <div class="w-6 h-px bg-border"></div>
      {/if}
    </div>
  {/each}
</div>
