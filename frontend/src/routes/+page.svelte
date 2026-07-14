<script lang="ts">
  import { page } from '$app/state';
  import StatusDot from '$lib/components/StatusDot.svelte';
  import PlannedBadge from '$lib/components/PlannedBadge.svelte';
  import { stages } from '$lib/mock/selectors.js';
  import { mockDimensions } from '$lib/mock/config.js';

  const activeStages = $derived(stages.filter(s => !s.planned));
  const currentConfig = $derived(
    mockDimensions.map(d => ({ label: d.label, value: d.current, planned: !!d.planned }))
  );

  const substitutions = [
    { from: 'Kafka 수집', to: '로컬 스크립트 수집기' },
    { from: 'Spark 구조화 스트리밍', to: '단일 노드 배치' },
    { from: 'Presidio + NER 마스킹', to: '정규식 패턴' },
    { from: 'LLM 엔리치먼트', to: '결정적 픽스처' },
    { from: 'OpenSearch 클러스터', to: '예정' },
  ];

  const journey = [
    { k: '01', t: '수집', d: '샘플 레코드가 Bronze 레이어에 스크립트 수집기를 통해 진입합니다.' },
    { k: '02', t: '구조화 · 마스킹', d: 'Silver 레이어가 필드를 정규화하고 PII를 마스킹합니다.' },
    { k: '03', t: '청킹 · 엔리치먼트', d: 'Gold 레이어가 청크 분할, 요약, 개체명 태깅을 수행합니다.' },
    { k: '04', t: '검색', d: '필드 매핑된 출력이 검색 인덱스에 전달됩니다.' },
  ];
</script>

<svelte:head>
  <title>개요 — PipeScale</title>
</svelte:head>

<div class="space-y-12">
  <!-- 히어로 -->
  <header class="space-y-4 max-w-3xl">
    <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">에뮬레이터 / 개요</div>
    <h1 class="text-3xl md:text-5xl font-extrabold tracking-tighter text-balance">
      PipeScale 
    </h1>
    <h4 class="text-xl md:text-xl font-extrabold tracking-tighter text-balance">
       원시 수집에서 검색 인수까지 전 구간을 실시간으로 관찰합니다.
    </h4>
    <p class="text-muted-foreground text-pretty leading-relaxed">
      PipeScale은 실제 Bronze → Silver → Gold 데이터 파이프라인을 라이브 시뮬레이션으로 재현합니다.
      샘플 레코드를 투입하고, 6개 단계를 모두 실행하고, PII 마스킹을 확인한 뒤 결과를 검색에 전달합니다.
      디자인 전용 미리보기 — 외부로 유출되는 데이터는 없습니다.
    </p>
    <div class="flex flex-wrap gap-2 pt-2">
      <a
        href="/pipeline"
        class="px-6 py-2 bg-foreground text-background text-sm font-bold uppercase tracking-tight hover:bg-foreground/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        샘플 데이터 투입
      </a>
      <a
        href="/pipeline"
        class="px-6 py-2 border border-border text-sm font-bold uppercase tracking-tight hover:bg-surface-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        파이프라인 열기
      </a>
      <a
        href="/settings"
        class="px-6 py-2 border border-border text-sm font-bold uppercase tracking-tight hover:bg-surface-muted transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        설정
      </a>
    </div>
  </header>

  <!-- 처리 여정 4단계 -->
  <section class="space-y-4">
    <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">처리 여정</div>
    <ol class="grid md:grid-cols-4 gap-3">
      {#each journey as step}
        <li class="bg-surface border border-border p-4 rounded-sm">
          <div class="text-[10px] font-mono font-bold text-primary tracking-widest">{step.k}</div>
          <div class="font-bold text-sm mt-1">{step.t}</div>
          <div class="text-xs text-muted-foreground mt-1 leading-relaxed">{step.d}</div>
        </li>
      {/each}
    </ol>
  </section>

  <!-- 현재 구성 + 단계 대체표 -->
  <section class="grid lg:grid-cols-2 gap-6">
    <div class="bg-surface border border-border p-6 rounded-sm">
      <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2 mb-4">현재 구성</div>
      <ul class="divide-y divide-border">
        {#each currentConfig as item}
          <li class="flex items-center justify-between py-2.5">
            <span class="text-sm">{item.label}</span>
            <span class="font-mono text-xs font-bold uppercase tabular-nums flex items-center gap-2">
              {item.value}
              {#if item.planned}
                <PlannedBadge />
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    </div>

    <div class="bg-surface border border-border p-6 rounded-sm">
      <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2 mb-2">단계 대체 구성표</div>
      <p class="text-xs text-muted-foreground mt-2 leading-relaxed">
        에뮬레이터는 인터페이스 형태를 유지하면서 무거운 프로덕션 컴포넌트를 경량 등가물로 대체합니다.
      </p>
      <ul class="mt-4 space-y-2 text-xs font-mono">
        {#each substitutions as s}
          <li class="flex items-center justify-between gap-2 border-b border-dashed border-border pb-1.5">
            <span class="text-muted-foreground">{s.from}</span>
            <span class="tracking-tight">→ {s.to}</span>
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <!-- 6개 처리 단계 미리보기 -->
  <section class="space-y-4">
    <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">6개 처리 단계</div>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {#each activeStages as stage}
        <div class="bg-surface border border-border p-3 rounded-sm">
          <div class="text-[10px] font-mono text-muted-foreground uppercase">{stage.layer}</div>
          <div class="font-bold text-sm mt-1">{stage.name}</div>
          <div class="flex items-center gap-1.5 mt-3 text-[10px] font-mono text-muted-foreground">
            <StatusDot status={stage.status} />
            {stage.status === 'completed' ? '완료' : stage.status === 'in_progress' ? '진행 중' : stage.status === 'pending' ? '대기' : stage.status === 'failed' ? '실패' : '없음'}
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>
