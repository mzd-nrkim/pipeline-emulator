<script lang="ts">
  let { onclick, label = '다시 시도' }: { onclick: () => void; label?: string } = $props();
</script>

<button
  {onclick}
  class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
>
  {label}
</button>
