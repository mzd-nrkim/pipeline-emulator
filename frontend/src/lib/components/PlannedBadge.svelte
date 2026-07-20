<script lang="ts">
  import { cn } from '$lib/utils.js';
  let { class: className = '', label = '예정' }: { class?: string; label?: string } = $props();
</script>

<span class={cn(
  'inline-block border border-dashed border-border rounded-xs px-1.5 py-0.5',
  'text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground',
  className
)}>
  {label}
</span>
