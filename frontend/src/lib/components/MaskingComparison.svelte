<script lang="ts">
  let {
    before,
    after,
    title = '마스킹 전후 비교',
  }: {
    before: string;
    after: string;
    title?: string;
  } = $props();
</script>

<div>
  <p class="text-xs text-muted-foreground mb-2">{title}</p>
  <div class="grid md:grid-cols-2 gap-3">
    <div>
      <p class="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wide">원본</p>
      <pre class="bg-slate-950 text-slate-300 p-4 rounded-xs font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">{before}</pre>
    </div>
    <div>
      <p class="text-[10px] font-mono text-muted-foreground mb-1 uppercase tracking-wide">마스킹 후</p>
      <pre class="bg-slate-950 text-slate-300 p-4 rounded-xs font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">{after}</pre>
    </div>
  </div>
</div>
