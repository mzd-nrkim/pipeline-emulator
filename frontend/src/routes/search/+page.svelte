<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import PlannedBadge from '$lib/components/PlannedBadge.svelte';
  import SearchResultItem from '$lib/components/SearchResultItem.svelte';
  import FilterControl from '$lib/components/FilterControl.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import type { SearchResult, Dimension } from '$lib/api/types.js';

  let { data }: { data: { results: SearchResult[]; dimensions: Dimension[] } } = $props();

  const searchDim = $derived(data.dimensions.find(d => d.key === 'search_serving'));
  const searchEnabled = $derived(searchDim?.current !== 'off' && !searchDim?.planned);

  let query = $state(page.url.searchParams.get('q') ?? '');
  let mode = $state<'keyword' | 'semantic' | 'hybrid'>(
    (page.url.searchParams.get('mode') as any) ?? 'hybrid'
  );
  let securityFilter = $state(page.url.searchParams.get('security') ?? '');
  let priorityFilter = $state(page.url.searchParams.get('importance') ?? '');
  let vehicleFilter = $state(page.url.searchParams.get('vehicle') ?? '');

  const results: SearchResult[] = $derived.by(() => {
    if (!searchEnabled) return [];
    return data.results.filter(r => {
      if (securityFilter && r.security !== securityFilter) return false;
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (vehicleFilter && r.vehicleModel !== vehicleFilter) return false;
      return true;
    });
  });

  function updateUrl() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (mode !== 'hybrid') params.set('mode', mode);
    if (securityFilter) params.set('security', securityFilter);
    if (priorityFilter) params.set('importance', priorityFilter);
    if (vehicleFilter) params.set('vehicle', vehicleFilter);
    const qs = params.toString();
    goto(`/search${qs ? '?' + qs : ''}`, { replaceState: true, noScroll: true });
  }
</script>

<svelte:head>
  <title>검색 — PipeScale</title>
</svelte:head>

<div class="space-y-6">
  <header class="space-y-2">
    <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">검색 데모</div>
    <h1 class="text-2xl font-extrabold tracking-tighter">Gold 레이어 질의</h1>
  </header>

  {#if !searchEnabled}
    <!-- 검색 서빙 off 상태 -->
    <div class="bg-surface border border-dashed border-border rounded-sm p-6 flex items-start justify-between gap-4">
      <div>
        <PlannedBadge />
        <h2 class="mt-2 text-lg font-bold tracking-tight">검색 서빙이 꺼져 있습니다</h2>
        <p class="text-sm text-muted-foreground mt-1 max-w-lg">
          검색 서빙이 활성화되면 검색 데모를 사용할 수 있습니다.
          고급 마스킹 및 하이브리드 랭킹은 MVP 이후 기능입니다.
        </p>
      </div>
      <a
        href="/settings"
        class="px-4 py-2 border border-border text-xs font-bold uppercase tracking-tight hover:bg-surface-muted transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        설정 열기
      </a>
    </div>
  {:else}
    <!-- 검색 활성 상태 -->
    <div class="bg-surface border border-border p-4 rounded-sm space-y-3">
      <div class="flex flex-col md:flex-row gap-2">
        <input
          type="search"
          bind:value={query}
          oninput={updateUrl}
          placeholder="문제, 부품, 증상을 검색하세요..."
          aria-label="검색 질의"
          class="flex-1 border border-border rounded-xs px-3 py-2 text-sm font-mono bg-background
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        />
        <div class="flex gap-1" role="group" aria-label="검색 방식">
          {#each (['keyword', 'semantic', 'hybrid'] as const) as m}
            <button
              type="button"
              onclick={() => { mode = m; updateUrl(); }}
              aria-pressed={mode === m}
              class={[
                'px-3 py-2 border text-[10px] font-mono font-bold uppercase tracking-widest transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                mode === m
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border hover:bg-surface-muted',
              ].join(' ')}
            >
              {m === 'keyword' ? '키워드' : m === 'semantic' ? '의미론' : '하이브리드'}
            </button>
          {/each}
        </div>
      </div>

      <div class="flex flex-wrap gap-3">
        <FilterControl
          label="보안분류"
          value={securityFilter}
          options={[
            { value: 'RESTRICTED', label: 'RESTRICTED' },
            { value: 'INTERNAL', label: 'INTERNAL' },
            { value: 'PUBLIC', label: 'PUBLIC' },
          ]}
          onchange={(v) => { securityFilter = v; updateUrl(); }}
        />
        <FilterControl
          label="중요도"
          value={priorityFilter}
          options={[
            { value: 'S', label: 'S' }, { value: 'A', label: 'A' },
            { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
          ]}
          onchange={(v) => { priorityFilter = v; updateUrl(); }}
        />
        <FilterControl
          label="차종"
          value={vehicleFilter}
          options={[
            { value: 'NX01', label: 'NX01' },
            { value: 'NX02', label: 'NX02' },
            { value: 'GN01', label: 'GN01' },
          ]}
          onchange={(v) => { vehicleFilter = v; updateUrl(); }}
        />
      </div>
    </div>

    <!-- 검색 결과 -->
    <div class="space-y-3">
      {#if !query.trim()}
        <EmptyState title="검색어를 입력하세요" description="키워드, 증상, 부품명 등을 입력해 검색합니다." />
      {:else if results.length === 0}
        <EmptyState title="결과 없음" description="검색 조건에 맞는 문서가 없습니다." />
      {:else}
        {#each results as result}
          <div class="relative">
            <SearchResultItem {result} />
            {#if mode === 'hybrid' || mode === 'semantic'}
              <div class="absolute right-5 top-5 bg-surface-muted border border-border rounded-xs p-3 min-w-[140px]">
                <div class="text-[10px] font-mono uppercase text-muted-foreground">점수</div>
                <div class="text-2xl font-extrabold tabular-nums">{result.score.toFixed(2)}</div>
                {#if mode === 'hybrid'}
                  <div class="mt-2 space-y-1 text-[10px] font-mono">
                    <div class="flex justify-between"><span>키워드</span><span class="font-bold">{result.keywordScore.toFixed(2)}</span></div>
                    <div class="flex justify-between"><span>의미론</span><span class="font-bold">{result.semanticScore.toFixed(2)}</span></div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- 권한별 결과 제한 (예정) -->
    <div class="bg-surface-muted border border-dashed border-border rounded-sm p-4 text-xs text-muted-foreground flex items-center justify-between">
      <span>보안분류별 권한 기반 결과 제한</span>
      <PlannedBadge />
    </div>
  {/if}
</div>
