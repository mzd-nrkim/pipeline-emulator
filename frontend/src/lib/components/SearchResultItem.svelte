<script lang="ts">
  import type { SearchResult } from '$lib/api/types.js';

  let { result }: { result: SearchResult } = $props();

  function highlight(text: string): string {
    return text.replace(/<mark>(.*?)<\/mark>/g, '<mark class="bg-primary/20 text-primary rounded-xs px-0.5">$1</mark>');
  }
</script>

<article class="bg-surface border border-border p-5 rounded-sm hover:border-primary/30 transition-colors">
  <div class="font-bold">{result.title}</div>
  <div class="text-xs font-mono text-muted-foreground mt-1">{result.id}</div>
  <p class="text-sm text-muted-foreground mt-2">{result.summary}</p>
  {#if result.highlight}
    <p class="text-sm mt-2 text-foreground">
      {@html highlight(result.highlight)}
    </p>
  {/if}
  <div class="mt-3 flex flex-wrap gap-2 text-[10px] font-mono">
    <span class="border border-border rounded-xs px-1.5 py-0.5">{result.security}</span>
    <span class="border border-border rounded-xs px-1.5 py-0.5">{result.priority}</span>
    <span class="border border-border rounded-xs px-1.5 py-0.5">{result.vehicleModel}</span>
    <span class="border border-border rounded-xs px-1.5 py-0.5 text-primary">점수 {result.score.toFixed(2)}</span>
  </div>
</article>
