<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center px-4">
  <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-border pl-2">
    백엔드 연결 대기
  </div>
  <h2 class="text-xl font-bold tracking-tight">실제 데이터를 불러올 수 없습니다</h2>
  <p class="text-sm text-muted-foreground max-w-md">
    Week 2에서 ui-backend가 구현되면 이 화면이 실제 데이터로 채워집니다.
    <br />현재는 <strong>샘플 모드</strong>를 이용하세요.
  </p>
  {#if page.error?.message}
    <p class="text-xs font-mono text-muted-foreground border border-border rounded-sm px-3 py-1.5">
      {page.error.message}
    </p>
  {/if}
  <a
    href="/sample"
    class="mt-2 px-4 py-2 border border-border text-xs font-bold uppercase tracking-tight hover:bg-surface-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
  >
    샘플 모드로 이동
  </a>
</div>
