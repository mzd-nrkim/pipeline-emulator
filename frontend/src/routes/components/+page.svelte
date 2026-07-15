<script lang="ts">
  import StatusDot from '$lib/components/StatusDot.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import PlannedBadge from '$lib/components/PlannedBadge.svelte';
  import LayerStepper from '$lib/components/LayerStepper.svelte';
  import StageNode from '$lib/components/StageNode.svelte';
  import RunHistoryItem from '$lib/components/RunHistoryItem.svelte';
  import PiiCountGrid from '$lib/components/PiiCountGrid.svelte';
  import MaskingComparison from '$lib/components/MaskingComparison.svelte';
  import SearchResultItem from '$lib/components/SearchResultItem.svelte';
  import DimensionToggle from '$lib/components/DimensionToggle.svelte';
  import FilterControl from '$lib/components/FilterControl.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ErrorNotice from '$lib/components/ErrorNotice.svelte';
  import RetryButton from '$lib/components/RetryButton.svelte';
  import { stages } from '$lib/mock/selectors.js';
  import { mockRuns } from '$lib/mock/runs.js';
  import { mockDocuments } from '$lib/mock/documents.js';
  import { mockDimensions } from '$lib/mock/config.js';
  import type { StageStatus, Dimension } from '$lib/api/types.js';

  const statuses: StageStatus[] = ['completed', 'in_progress', 'pending', 'failed', 'none'];

  const exampleDoc = mockDocuments[0];
  const examplePii = exampleDoc.piiCounts ?? [];

  let localDimension: Dimension = $state({ ...mockDimensions[0] });
</script>

<svelte:head>
  <title>컴포넌트 — PipeScale</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 sm:px-6 space-y-8">
  <header class="space-y-2">
    <div class="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest border-l-2 border-primary pl-2">라이브러리</div>
    <h1 class="text-2xl font-extrabold tracking-tighter">재사용 컴포넌트</h1>
    <p class="text-sm text-muted-foreground">파이프라인 에뮬레이터 전체에서 사용되는 UI 요소와 모든 상태·변형을 전시합니다.</p>
  </header>

  <!-- 상태 배지 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">상태 배지</h2>
      <p class="text-xs text-muted-foreground mt-0.5">단계 또는 실행의 상태를 전달합니다.</p>
    </header>
    <div class="flex flex-wrap gap-3">
      {#each statuses as status}
        <StatusBadge {status} />
      {/each}
      <PlannedBadge />
    </div>
  </section>

  <!-- 상태 점 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">상태 점(dot)</h2>
      <p class="text-xs text-muted-foreground mt-0.5">인라인 사용을 위한 소형 상태 표시기.</p>
    </header>
    <div class="flex items-center gap-4 text-xs font-mono">
      {#each statuses as status}
        <span class="flex items-center gap-1.5">
          <StatusDot {status} />
          {status.replace('_', ' ')}
        </span>
      {/each}
    </div>
  </section>

  <!-- 계층 진행 스테퍼 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">계층 진행 스테퍼</h2>
      <p class="text-xs text-muted-foreground mt-0.5">Bronze → Silver → Gold → Serving 계층 진행을 표시합니다.</p>
    </header>
    <div class="space-y-3">
      <LayerStepper current="Bronze" />
      <LayerStepper current="Silver" />
      <LayerStepper current="Gold" />
    </div>
  </section>

  <!-- 단계 노드 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">단계 노드</h2>
      <p class="text-xs text-muted-foreground mt-0.5">파이프라인 단계의 계층·상태·문서 수를 표시합니다.</p>
    </header>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <StageNode stage={stages[0]} />
      <StageNode stage={stages[2]} active />
      <StageNode stage={stages[4]} />
      <StageNode stage={stages[7]} />
    </div>
  </section>

  <!-- 실행 이력 항목 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">실행 이력 항목</h2>
      <p class="text-xs text-muted-foreground mt-0.5">실행 목록의 한 행 — 식별자·시각·결과 표시.</p>
    </header>
    <ul class="divide-y divide-border border border-border rounded-sm bg-surface max-w-md">
      {#each mockRuns as run}
        <RunHistoryItem {run} />
      {/each}
    </ul>
  </section>

  <!-- PII 카운트 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">PII 유형별 카운트</h2>
      <p class="text-xs text-muted-foreground mt-0.5">감지된 PII 유형별 건수. 예정 유형은 흐리게 표시.</p>
    </header>
    {#if examplePii.length > 0}
      <PiiCountGrid counts={examplePii} />
    {:else}
      <EmptyState description="PII 카운트 데이터 없음" />
    {/if}
  </section>

  <!-- 마스킹 전후 비교 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">마스킹 전후 비교</h2>
      <p class="text-xs text-muted-foreground mt-0.5">원본 텍스트와 마스킹된 텍스트의 나란한 비교.</p>
    </header>
    <MaskingComparison
      before="담당자: 김철수 / 010-1234-5678 / user@hmc.example / 계좌: 123-456789-12"
      after="담당자: 김* / 010****1234 / [이메일 마스킹] / 계좌: [계좌번호 마스킹]"
    />
  </section>

  <!-- 검색 결과 항목 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">검색 결과 항목</h2>
      <p class="text-xs text-muted-foreground mt-0.5">검색 결과 목록의 한 항목.</p>
    </header>
    <div class="max-w-2xl space-y-3">
      <SearchResultItem result={{
        id: 'AP00005928||1',
        title: 'CFT 문제이력 NX01 — 브레이크 센서 간헐 불량',
        summary: '전방 좌측 브레이크 압력 센서가 냉간 시동 후 200~400ms 동안 zero 값을 보고합니다.',
        priority: 'S',
        security: 'RESTRICTED',
        vehicleModel: 'NX01',
        score: 0.94,
        keywordScore: 0.91,
        semanticScore: 0.97,
        highlight: '...브레이크 센서 <mark>압력</mark>이 <mark>간헐적으로</mark> 0으로 측정됩니다...',
      }} />
    </div>
  </section>

  <!-- 구성 토글 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">구성 토글</h2>
      <p class="text-xs text-muted-foreground mt-0.5">설정 차원의 값을 선택하는 세그먼트 컨트롤.</p>
    </header>
    <div class="max-w-sm">
      <DimensionToggle
        dimension={localDimension}
        onchange={(v) => { localDimension = { ...localDimension, current: v }; }}
      />
    </div>
  </section>

  <!-- 필터 컨트롤 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">필터/세그먼트 컨트롤</h2>
      <p class="text-xs text-muted-foreground mt-0.5">목록 필터링을 위한 select 컨트롤.</p>
    </header>
    <div class="flex flex-wrap gap-4">
      <FilterControl
        label="보안분류"
        options={[
          { value: 'RESTRICTED', label: 'RESTRICTED' },
          { value: 'INTERNAL', label: 'INTERNAL' },
          { value: 'PUBLIC', label: 'PUBLIC' },
        ]}
      />
      <FilterControl
        label="중요도"
        options={[
          { value: 'S', label: 'S' }, { value: 'A', label: 'A' },
          { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
        ]}
      />
      <FilterControl
        label="차종"
        options={[
          { value: 'NX01', label: 'NX01' },
          { value: 'NX02', label: 'NX02' },
          { value: 'GN01', label: 'GN01' },
        ]}
      />
    </div>
  </section>

  <!-- 공통 상태 요소 -->
  <section class="bg-surface border border-border rounded-sm p-6 space-y-4">
    <header>
      <h2 class="font-bold text-sm tracking-tight">공통 상태 요소</h2>
      <p class="text-xs text-muted-foreground mt-0.5">로딩·빈 상태·오류·재시도 표시기.</p>
    </header>
    <div class="grid md:grid-cols-2 gap-4">
      <div class="border border-border rounded-xs p-4">
        <p class="text-xs text-muted-foreground mb-2">로딩</p>
        <LoadingState />
      </div>
      <div class="border border-border rounded-xs p-4">
        <p class="text-xs text-muted-foreground mb-2">빈 상태</p>
        <EmptyState title="문서 없음" description="조건에 맞는 문서가 없습니다." />
      </div>
      <div class="border border-border rounded-xs p-4">
        <p class="text-xs text-muted-foreground mb-2">오류</p>
        <ErrorNotice message="데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." />
      </div>
      <div class="border border-border rounded-xs p-4">
        <p class="text-xs text-muted-foreground mb-2">재시도 버튼</p>
        <RetryButton onclick={() => {}} />
      </div>
    </div>
  </section>
</div>
