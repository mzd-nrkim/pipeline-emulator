<script lang="ts">
  let { message = '오류가 발생했습니다.' }: { message?: string } = $props();
</script>

<div class="rounded-md border border-status-failed/30 bg-status-failed/10 px-4 py-3">
  <p class="text-sm text-status-failed">{message}</p>
</div>
