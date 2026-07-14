<script lang="ts">
  let { title = '데이터 없음', description = '표시할 내용이 없습니다.' }: {
    title?: string;
    description?: string;
  } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
  <p class="font-medium text-foreground">{title}</p>
  <p class="text-sm text-muted-foreground">{description}</p>
</div>
