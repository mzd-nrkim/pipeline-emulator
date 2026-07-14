<script lang="ts">
  import PlannedBadge from '$lib/components/PlannedBadge.svelte';
  import { mockDimensions } from '$lib/mock/config.js';
  import type { Dimension } from '$lib/api/types.js';

  let dims = $state<Dimension[]>(mockDimensions.map(d => ({ ...d })));
  let pendingRestart = $state(false);

  function setDim(key: string, value: string) {
    dims = dims.map(d => d.key === key ? { ...d, current: value } : d);
    pendingRestart = true;
  }

  function isEnabled(d: Dimension): boolean {
    if (d.dependsOn) {
      const parent = dims.find(x => x.key === d.dependsOn);
      if (parent?.current === 'off') return false;
    }
    return true;
  }
</script>

<svelte:head>
  <title>설정 — PipeScale</title>
</svelte:head>

<div class="space-y-6">
  {#if pendingRestart}
    <div class="border border-amber-500/40 bg-amber-500/10 text-amber-600 text-xs font-mono p-3 rounded-xs flex items-center gap-2">
      <span class="font-bold uppercase">재시작 필요</span>
      <span class="text-muted-foreground">— 변경 사항은 에뮬레이터 재시작 후 적용됩니다. 백엔드 즉시 반영은 지원되지 않습니다.</span>
    </div>
  {/if}
  <header class="space-y-2">
    <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">구성</div>
    <h1 class="text-2xl font-extrabold tracking-tighter">에뮬레이터 차원</h1>
    <p class="text-sm text-muted-foreground max-w-2xl">
      각 차원은 에뮬레이터의 실행 방식을 변경합니다. 예정된 차원은 참고용으로 표시되지만 아직 선택할 수 없습니다.
    </p>
  </header>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {#each dims as dim}
      {@const enabled = isEnabled(dim)}
      <section class={['bg-surface border border-border p-5 rounded-sm', !enabled ? 'opacity-60' : ''].join(' ')}>
        <div class="flex items-start justify-between gap-2 mb-4">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h2 class="font-bold text-sm tracking-tight">{dim.label}</h2>
              {#if dim.planned}
                <PlannedBadge />
              {/if}
            </div>
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">{dim.description}</p>
            {#if !enabled && dim.dependsOn}
              <p class="text-[10px] font-mono uppercase mt-2 text-muted-foreground">검색 서빙이 활성화되어야 사용 가능합니다</p>
            {/if}
          </div>
          <span class="text-[10px] font-mono font-bold uppercase tracking-widest text-primary shrink-0">
            {dim.current}
          </span>
        </div>

        <div class="flex">
          {#each dim.values as value, i}
            {@const active = dim.current === value}
            {@const disabled = !!dim.planned || !enabled}
            <button
              type="button"
              onclick={() => !disabled && setDim(dim.key, value)}
              aria-pressed={active}
              aria-disabled={disabled}
              disabled={disabled}
              class={[
                'flex-1 p-3 border text-xs font-bold uppercase tracking-tight transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                i === 0 && 'rounded-l-xs',
                i === dim.values.length - 1 && 'rounded-r-xs',
                active && !disabled
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                disabled && 'cursor-not-allowed',
              ].filter(Boolean).join(' ')}
            >
              {value}
              {#if dim.planned}
                <span class="block mt-1">
                  <PlannedBadge />
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>
