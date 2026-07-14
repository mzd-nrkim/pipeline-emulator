<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import PlannedBadge from '$lib/components/PlannedBadge.svelte';
  import MaskingComparison from '$lib/components/MaskingComparison.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import type { Document } from '$lib/api/types.js';

  let { data }: { data: { documents: Document[] } } = $props();

  let priorityFilter = $state(page.url.searchParams.get('priority') ?? 'all');
  let maskedOnly = $state(page.url.searchParams.get('masked') === 'true');
  let selectedId = $state(page.url.searchParams.get('doc') ?? data.documents[0]?.id ?? '');

  const filtered = $derived(
    data.documents.filter(d => {
      if (priorityFilter !== 'all' && d.priority !== priorityFilter) return false;
      if (maskedOnly && !d.masked) return false;
      return true;
    })
  );

  const selected = $derived(data.documents.find(d => d.id === selectedId) ?? data.documents[0]);

  function selectDoc(id: string) {
    selectedId = id;
    updateUrl();
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (maskedOnly) params.set('masked', 'true');
    if (selectedId) params.set('doc', selectedId);
    const qs = params.toString();
    goto(`/documents${qs ? '?' + qs : ''}`, { replaceState: true, noScroll: true });
  }

  const priorityColor: Record<string, string> = {
    S: 'bg-status-failed/10 text-status-failed border-status-failed/20',
    A: 'bg-warning/10 text-warning-foreground border-warning/30',
    B: 'bg-warning/10 text-warning-foreground border-warning/30',
    C: 'bg-surface-muted text-muted-foreground border-border',
    D: 'bg-surface-muted text-muted-foreground border-border',
    E: 'bg-surface-muted text-muted-foreground border-border',
  };

  const rawJson = $derived(selected ? `{
  "issue_id": "${selected.id}",
  "vehicle_model": "${selected.vehicleModel}",
  "priority": "${selected.priority}",
  "reporter_phone": "010-1234-5678",
  "reporter_email": "user@hmc.example",
  "reporter_name": "김철수",
  "address": "서울시 강남구",
  "body": "브레이크 센서가 콜드 스타트 후 200ms 동안 0을 리턴함."
}` : '');
</script>

<svelte:head>
  <title>문서 — PipeScale</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
  <!-- 문서 목록 (좌측) -->
  <aside class="lg:col-span-4 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">문서</div>
      <span class="text-[10px] font-mono text-muted-foreground">{filtered.length}개 표시</span>
    </div>

    <!-- 필터 -->
    <div class="flex gap-2">
      <select
        bind:value={priorityFilter}
        onchange={updateUrl}
        aria-label="중요도 필터"
        class="flex-1 text-xs font-mono border border-border rounded-xs px-2 py-1.5 bg-surface
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <option value="all">전체 중요도</option>
        {#each ['S','A','B','C','D','E'] as p}
          <option value={p}>중요도 {p}</option>
        {/each}
      </select>
      <label class="text-xs font-mono flex items-center gap-1.5 px-2 border border-border rounded-xs cursor-pointer">
        <input
          type="checkbox"
          bind:checked={maskedOnly}
          onchange={updateUrl}
          aria-label="마스킹된 문서만"
        />
        마스킹됨
      </label>
    </div>

    <!-- 문서 목록 -->
    {#if filtered.length === 0}
      <EmptyState title="문서 없음" description="필터 조건에 맞는 문서가 없습니다." />
    {:else}
      <ul class="divide-y divide-border border border-border rounded-sm bg-surface" role="listbox" aria-label="문서 목록">
        {#each filtered as doc}
          <li role="option" aria-selected={selectedId === doc.id}>
            <button
              type="button"
              onclick={() => selectDoc(doc.id)}
              class={[
                'w-full text-left p-3 hover:bg-surface-muted transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                selectedId === doc.id ? 'bg-surface-muted border-l-4 border-primary' : '',
              ].join(' ')}
            >
              <div class="flex items-center justify-between">
                <span class="font-mono text-xs font-bold truncate">{doc.id}</span>
                <span class={['inline-block border rounded-xs px-1.5 py-0.5 text-[10px] font-mono font-bold shrink-0', priorityColor[doc.priority] ?? ''].join(' ')}>
                  P·{doc.priority}
                </span>
              </div>
              <div class="text-sm font-medium mt-1 truncate">{doc.title}</div>
              <div class="text-[10px] font-mono text-muted-foreground mt-1 uppercase">
                {doc.security} · {doc.vehicleModel} · {doc.stageReached}
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </aside>

  <!-- 문서 상세 (우측) -->
  <section class="lg:col-span-8 space-y-6" aria-live="polite">
    {#if selected}
      <div class="bg-surface border border-border p-6 rounded-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">문서</div>
            <h1 class="text-2xl font-extrabold tracking-tighter mt-1">{selected.title}</h1>
            <div class="text-xs font-mono text-muted-foreground mt-1">{selected.id}</div>
          </div>
          <div class="flex gap-2 shrink-0">
            <span class={['inline-block border rounded-xs px-1.5 py-0.5 text-[10px] font-mono font-bold', priorityColor[selected.priority] ?? ''].join(' ')}>
              P·{selected.priority}
            </span>
            <span class="inline-block border border-border rounded-xs px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase text-muted-foreground">
              {selected.security}
            </span>
          </div>
        </div>
      </div>

      <!-- 단계 타임라인 -->
      <div class="space-y-4">
        <!-- Bronze 원본 -->
        <div class="bg-surface border border-border border-l-4 border-l-amber-700/40 p-5 rounded-sm">
          <h3 class="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">Bronze · 원본 등록</h3>
          <pre class="bg-slate-950 text-slate-300 p-4 rounded-xs font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">{rawJson}</pre>
        </div>

        <!-- Silver 구조화 -->
        <div class="bg-surface border border-border border-l-4 border-l-slate-400 p-5 rounded-sm">
          <h3 class="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">Silver · 구조화</h3>
          <div class="text-xs font-mono grid grid-cols-2 gap-2">
            {#each [
              { k: 'issue_body', v: '브레이크 센서가 콜드 스타트 후 0 리턴' },
              { k: 'parts[]', v: 'brake_sensor · brake_ecu' },
              { k: 'vehicle_model[]', v: selected.vehicleModel },
              { k: 'stage', v: 'silver_structured' },
            ] as field}
              <div class="border border-border rounded-xs p-2 bg-surface-muted">
                <div class="text-[10px] text-muted-foreground uppercase">{field.k}</div>
                <div class="text-xs font-bold">{field.v}</div>
              </div>
            {/each}
          </div>
          <p class="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Bronze 문제 1건이 복수의 부품·차종·프로젝트로 fan-out되어 Gold 청킹 후 문서 수가 늘어납니다.
          </p>
        </div>

        <!-- Silver 마스킹 -->
        <div class="bg-surface border border-border border-l-4 border-l-slate-400 p-5 rounded-sm">
          <h3 class="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">Silver · 마스킹 (전후 비교)</h3>
          <MaskingComparison
            before="담당자: 김철수 / 010-1234-5678 / user@hmc.example / 계좌: 123-456789-12"
            after="담당자: 김* / 010****1234 / [이메일 마스킹] / 계좌: [계좌번호 마스킹]"
          />
          <div class="mt-3 flex flex-wrap gap-2 text-[10px] font-mono">
            <span class="border border-border rounded-xs px-2 py-0.5">전화 → 010****1234</span>
            <span class="border border-border rounded-xs px-2 py-0.5">이메일 → [이메일 마스킹]</span>
            <span class="border border-border rounded-xs px-2 py-0.5">계좌 → [계좌번호 마스킹]</span>
            <span class="border border-dashed border-border rounded-xs px-2 py-0.5 opacity-70">이름 — <PlannedBadge /></span>
            <span class="border border-dashed border-border rounded-xs px-2 py-0.5 opacity-70">주소 — <PlannedBadge /></span>
          </div>
        </div>

        <!-- Gold 청킹 -->
        <div class="bg-surface border border-border border-l-4 border-l-amber-500 p-5 rounded-sm">
          <h3 class="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">Gold · 청킹</h3>
          <ol class="text-xs font-mono space-y-1.5">
            <li>[1/3] 브레이크 센서가 콜드 스타트 후 200ms 동안 0을 리턴함…</li>
            <li>[2/3] 서비스 게시판 SB-24-081에 대응책 반영…</li>
            <li>[3/3] 관련 부품: brake_sensor, brake_ecu…</li>
          </ol>
        </div>

        <!-- Gold 엔리치먼트 -->
        <div class="bg-surface border border-border border-l-4 border-l-amber-500 p-5 rounded-sm">
          <h3 class="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">Gold · 엔리치먼트</h3>
          <div class="grid md:grid-cols-3 gap-3 text-xs">
            <div>
              <div class="text-[10px] font-mono uppercase text-muted-foreground mb-1">키워드</div>
              <div>브레이크, 센서, 콜드스타트, OTA</div>
            </div>
            <div>
              <div class="text-[10px] font-mono uppercase text-muted-foreground mb-1">요약</div>
              <div>전방 좌측 브레이크 압력 센서가 냉간 시동 후 잠시 0을 리턴.</div>
            </div>
            <div>
              <div class="text-[10px] font-mono uppercase text-muted-foreground mb-1">개체명</div>
              <div>{selected.vehicleModel} · SB-24-081 · brake_ecu</div>
            </div>
          </div>
        </div>

        <!-- Gold 필드매핑 -->
        <div class="bg-surface border border-border border-l-4 border-l-amber-500 p-5 rounded-sm">
          <h3 class="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">Gold · 필드 매핑</h3>
          <pre class="bg-slate-950 text-slate-300 p-4 rounded-xs font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">{`{
  "target_index": "issues.gold.v1",
  "routing": "vehicle:${selected.vehicleModel}",
  "security": "${selected.security}",
  "priority": "${selected.priority}"
}`}</pre>
        </div>
      </div>
    {:else}
      <EmptyState title="문서를 선택하세요" description="왼쪽 목록에서 문서를 선택하면 단계별 변화를 확인할 수 있습니다." />
    {/if}
  </section>
</div>
