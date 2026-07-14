<script lang="ts">
  let {
    label,
    options,
    value = '',
    onchange,
  }: {
    label: string;
    options: { value: string; label: string }[];
    value?: string;
    onchange?: (value: string) => void;
  } = $props();

  const id = $derived(`filter-${label.replace(/\s+/g, '-').toLowerCase()}`);
</script>

<div class="flex items-center gap-2">
  <label for={id} class="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</label>
  <select
    {id}
    value={value}
    onchange={(e) => onchange?.((e.target as HTMLSelectElement).value)}
    class="text-xs border border-border rounded-xs px-2 py-1 bg-surface text-foreground
           focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
  >
    <option value="">전체</option>
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>
