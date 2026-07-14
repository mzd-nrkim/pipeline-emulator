<script lang="ts">
  let { message = '불러오는 중...' }: { message?: string } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
  <div class="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"></div>
  <p class="text-sm">{message}</p>
</div>
