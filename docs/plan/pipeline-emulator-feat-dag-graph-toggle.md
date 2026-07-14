# 파이프라인 뷰 토글 — Grid / DAG Graph 2-Mode

> 상태: 미시작

> 작성일: 2026-07-14
> 선행 계획서: [pipeline-emulator-week2-plan.md](./pipeline-emulator-week2-plan.md) (T2 @xyflow 항목에서 이관)
> 관련 코드:
>   - `frontend/src/routes/pipeline/+page.svelte` (흐름도 메인 페이지)
>   - `frontend/src/lib/components/StageNode.svelte` (기존 그리드 노드)

---

## 배경

파이프라인 흐름도(`/pipeline`)는 현재 Tailwind CSS Grid 8열로 구현되어 있다(지그재그 오프셋 + 절대 위치 연결선).
`@xyflow/svelte ^0.1.39`는 `package.json`에 이미 설치되어 있으나 미사용 상태다.

Week 2 계획서(T2)에서 "@xyflow 도입 여부를 실물 확인 후 결정"으로 보류했던 항목을, **기본 Grid 뷰 유지 + 우측 토글로 DAG Graph 뷰 전환** 방식으로 확정한다.

---

## 목표

- 흐름도 우측 상단 토글 버튼으로 **Grid 뷰 ↔ DAG Graph 뷰** 전환이 된다
- 기본값은 **Grid 뷰** (기존 UX 유지)
- 마지막 선택한 뷰 모드를 `localStorage`에 저장해 재방문 시 복원한다
- Graph 뷰는 `@xyflow/svelte`로 Bronze → Silver → Gold → Serving 4레이어 DAG를 렌더링한다 (총 8노드, 읽기 전용, 엣지 방향·확대·이동 지원)
- 두 뷰 모두 기존 클릭 → 인스펙터 패널 연동 동작을 동일하게 지원한다

---

## 접근 방법

1. **토글 상태 추가** — `pipeline/+page.svelte`에 `let viewMode: 'grid' | 'graph' = $state(...)` 추가. 초기값은 `localStorage.getItem('pipelineViewMode') ?? 'grid'`
2. **토글 버튼 배치** — "데이터 처리 흐름" 섹션 헤더(`<section>` 내 첫 `<div>`) 우측에 `Grid | Graph` 2-way 버튼 그룹 삽입
3. **Graph 뷰 컴포넌트 신규 작성** — `frontend/src/lib/components/PipelineGraphView.svelte`
   - `@xyflow/svelte`의 `SvelteFlow`, `Background`, `Controls` import
   - 4레이어(Bronze/Silver/Gold/Serving) 고정 레이아웃으로 8노드(Bronze 2·Silver 2·Gold 3·Serving 1) 위치 지정
   - 엣지 방향 연결, 읽기전용(`nodesDraggable={false}`)
   - 노드 클릭 시 기존 `selectStage(id)` 호출 (인스펙터 연동 유지)
   - 커스텀 노드 내부는 `StageNode.svelte` 재사용 가능 범위에서 재사용
4. **조건부 렌더링** — `+page.svelte` 흐름도 영역에서 `{#if viewMode === 'graph'}<PipelineGraphView .../>{:else}...기존 grid...{/if}`
5. **localStorage 동기화** — `viewMode` 변경 시 `localStorage.setItem('pipelineViewMode', viewMode)` 반영

---

## 실행 시 필수 고려사항

### ① SSR/localStorage 초기화 크래시 위험 (회귀 이유·범위)

`+page.svelte`는 SvelteKit 기본 SSR 대상이다. `let viewMode = $state(localStorage.getItem(...))`처럼 **컴포넌트 초기화 시점에 `localStorage`를 직접 읽으면 서버 렌더링 중 `ReferenceError: localStorage is not defined`로 페이지 전체가 크래시**한다(기존 `page.url.searchParams`는 SSR-safe라 무관). 따라서 초기값은 `'grid'`로 두고, `$app/environment`의 `browser` 가드 또는 `$effect`/`onMount`에서 localStorage를 읽어 반영한다. 이 기능의 최대 기술 리스크이므로 T1-1·Z-pre·TC(E)에서 반복 검증한다.

### ② stages 레이어 인덱스 (실물 확인 결과)

`$lib/mock/pipeline.ts` mockStages 실측: Bronze=index 0–1(ingestion, bronze_raw), Silver=index 2–3(silver_structured, silver_masked), **Gold=index 4–6(gold_chunked, gold_enriched, gold_staged — 3개)**, Serving=index 7(search_serving, `planned: true`). 계획서 초안의 "Gold(4-5)/Serving(6-7)"·"6+2노드" 표기는 오류이며 본문에서 8노드(2·2·3·1)로 정정했다. Serving 노드는 `planned`이므로 Graph 뷰에서도 점선/흐림으로 구분한다(Grid 뷰 기존 처리와 정합).

### ③ 동일 파일 편집·실행 순서 (병렬 가능 여부)

T1은 전부 `+page.svelte` **단일 파일** 편집 → 한 에이전트로 묶는다. T2는 신규 파일 `PipelineGraphView.svelte` → 독립. 단, T1-4(조건부 렌더링·import)는 T2 컴포넌트가 존재해야 `npm run check`가 통과하므로 **T2 → T1-4 순서 의존**. 실무상 T2 컴포넌트 골격을 먼저 만들고 T1을 마무리한다.

### ④ 테스트 하네스 부재 (환경 전제)

프로젝트에 vitest·playwright·test/e2e 스크립트가 **전무**하다(`package.json` scripts에 `check`만 존재, `node_modules` gitignored). 자동 e2e 하네스 신규 구축은 이 기능 범위를 크게 초과하므로 Z-post는 **브라우저 수동 검증**으로 둔다. 자동 e2e 도입 여부는 작업 목록 결정 항목으로 남긴다.

### ⑤ @xyflow/svelte 0.1.39 API (환경 전제)

설치 버전이 0.1.x 초기 버전이라 `SvelteFlow`/`Background`/`Controls` export 이름·props가 최신 문서와 다를 수 있다. 구현 시 `node_modules/@xyflow/svelte`의 실제 export를 확인한다. 컨테이너에 **명시적 height**가 없으면 그래프가 0px로 렌더되지 않는다(T2-6). SvelteFlow의 CSS(`@xyflow/svelte/dist/style.css`) import 필요 여부도 함께 확인한다.

---

## 작업 목록

### T1. 토글 상태 + 버튼 UI (`pipeline/+page.svelte` — 단일 파일, 한 에이전트)

- [x] T1-1. `viewMode` 상태 변수 추가 (SSR 안전)
  - [x] `$state<'grid' | 'graph'>('grid')`로 초기값을 'grid' 고정 (localStorage 직접 호출 금지 — 고려사항 ①)
  - [x] `$app/environment`의 `browser` import 후, `$effect` 또는 `onMount`에서 `localStorage.getItem('pipelineViewMode')`를 읽어 화이트리스트(`'grid'|'graph'`) 통과 값만 `viewMode`에 반영
- [x] T1-2. `viewMode` 변경 핸들러 — `browser` 가드 하에 `localStorage.setItem('pipelineViewMode', viewMode)` 동기화 (`$effect` 또는 토글 콜백 내)
- [x] T1-3. 섹션 헤더("데이터 처리 흐름", `<section>` 첫 `<div>`) 우측에 `Grid | Graph` 2-way 버튼 그룹 삽입 (active 강조, aria-pressed)
- [x] T1-4. 흐름도 영역 조건부 렌더링 분기 — `{#if viewMode === 'graph'}<PipelineGraphView {stages} onselect={selectStage} />{:else}...기존 grid...{/if}` (T2 컴포넌트 존재 후 배선)

### T2. DAG Graph 뷰 컴포넌트 (`PipelineGraphView.svelte` — 신규 파일, 독립)

- [x] T2-1. `@xyflow/svelte`에서 `SvelteFlow` · `Background` · `Controls` import + 필요 시 `dist/style.css` import (실물 export 확인 후 결정)
- [x] T2-2. `stages: Stage[]` prop 수신 → nodes/edges 배열 변환 로직
  - [x] 레이어별 x 좌표 고정: Bronze(index 0–1) / Silver(2–3) / Gold(4–6, 3노드) / Serving(7) — 실측 인덱스(고려사항 ②)
  - [x] 순차 엣지 정의 (`stages[i] → stages[i+1]`, animated 옵션)
  - [x] 빈 `stages`(0노드)에서 크래시 없이 빈 그래프 반환 (TC Cardinality)
- [x] T2-3. 커스텀 노드 표시 — 단계 이름·레이어 색상·상태 배지·문서 수, `planned` 노드는 점선/흐림 구분
  - [x] `StageNode.svelte`(props `stage`, `compact`, `onclick`) 재사용 or 인라인 축소판 (실물 확인 후 결정)
- [x] T2-4. 노드 클릭 핸들러 → 부모로부터 받은 `onselect(id)` 콜백 호출 (부모의 `selectStage(id)` → 인스펙터 + URL 갱신)
- [x] T2-5. `nodesDraggable={false}` · `nodesConnectable={false}` · `elementsSelectable` 읽기전용 설정
- [x] T2-6. 컨테이너 높이 고정 (`height: 420px` 또는 `min-h-[420px]`) — xyflow 필수 요건

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (워크트리, node_modules 없음 → 정적만)

- [ ] `PipelineGraphView.svelte` 신규 파일 존재 확인
- [ ] `+page.svelte`에 `viewMode` 상태·조건부 렌더링 분기·`browser` import 심볼 grep 확인
- [ ] SSR 크래시 방지 정적 확인 — `$state` 초기값 라인에 `localStorage` 직접 호출이 없는지 grep (`localStorage`는 `$effect`/`onMount`/`browser` 가드 블록에만 등장해야 함)

> `node_modules`가 gitignored라 워크트리엔 없음 → `npm run check`/`build`는 Z-pre에서 실행 불가. 아래 Node 정적 게이트로 강등(머지 직후 원본 main에서 실행).

#### Node 정적 게이트 (머지 직후 원본 main, node_modules 상주)

- [ ] `npm run check` 오류 0건 (svelte-check 타입/문법)
- [ ] `npm run build` 성공 (프로덕션 빌드 — @xyflow import·SSR 안전성까지 검증)

#### Z-post. push 후 (앱 기동, 브라우저 수동 검증)

- [ ] `/pipeline` 접속 → Grid 뷰(기본) 렌더링 정상 — 기존 UI 회귀 없음
- [ ] Graph 뷰 토글 → @xyflow 그래프 표시, 노드 8개(Bronze2·Silver2·Gold3·Serving1) + 엣지 방향 렌더
- [ ] Graph 뷰 노드 클릭 → 인스펙터 패널·URL(`?stage=`) 갱신 (Grid와 동일 동작)
- [ ] Grid→Graph→Grid 재토글 → 원복 정상 (Inverse)
- [ ] localStorage 저장 확인 — Graph 선택 후 새로고침 시 Graph 유지, 콘솔에 SSR 크래시/hydration 경고 없음
- [ ] Serving(planned) 노드 Graph 뷰에서 구분 표시(점선/흐림) 확인
- [ ] 모바일 레이아웃 — Grid 반응형 유지, Graph 스크롤/핀치 동작
  - teardown: 검증 후 DevTools > Application > Local Storage에서 `pipelineViewMode` 키 삭제 (기본값 재현 상태로 복귀)
- [ ] (결정) 자동 Playwright e2e 하네스 도입 여부 — 현재 test 하네스 전무(고려사항 ④). 도입 시 `frontend/e2e/pipeline-view-toggle.spec.ts`(토글·localStorage 복원·노드 클릭) 작성, 미도입 시 위 수동 검증으로 대체 (실물 확인 후 결정)

---

## Verification

- `npm run check` 오류 0건
- 브라우저에서 `/pipeline` 접속 → Grid 뷰 기본 표시
- 토글 버튼 클릭 → Graph 뷰 전환, 노드 8개 + 엣지 방향 표시
- 노드 클릭 → 인스펙터 패널(우측) 동일하게 갱신
- 새로고침 후 마지막 선택 뷰 복원
- 기존 Grid 뷰 레이아웃 변경 없음 (회귀 없음)

---

## TC (Right-BICEP · CORRECT)

> 프로젝트에 자동 테스트 하네스가 없어(고려사항 ④) 아래 케이스는 Z-post 브라우저 수동 검증과 매핑된다. 자동화는 Z-post 결정 항목에 따른다.

### Right-BICEP

- **Right(기대 결과)**: 토글 클릭 시 `viewMode`가 즉시 전환되고 해당 뷰가 렌더된다.
- **B(경계)**:
  - localStorage에 `pipelineViewMode` 키 없음(첫 방문) → 'grid' fallback
  - localStorage에 'grid'/'graph' 이외 임의 문자열 저장 → 'grid'로 방어(화이트리스트 검증)
- **I(역)**: Graph→Grid 재토글 시 Grid가 회귀 없이 원복.
- **C(교차검증)**: Graph 뷰 노드 수(8) = Grid 뷰 StageNode 수(8) = `mockStages.length` 일치.
- **E(에러 조건)**: SSR 렌더 중 localStorage 미접근으로 크래시 없음(고려사항 ①). 프라이빗 모드 등 localStorage 접근 차단 시 `browser` 가드/try로 앱 정상 동작.
- **P(성능)**: 해당 없음 — 노드 8개 정적 렌더, 성능 임계 없음.

### CORRECT

- **Conformance**: `viewMode` 타입 `'grid' | 'graph'`로 제한, 그 외 값 진입 불가.
- **Ordering**: 해당 없음 — 읽기 전용 그래프, 순서 의존 없음.
- **Range**: localStorage 값 화이트리스트 검증(B 경계와 동일).
- **Reference**: `PipelineGraphView`는 `stages` prop·부모 `onselect` 콜백에 의존 — 미전달 시 빈 그래프/무동작 방어.
- **Existence**: localStorage null·xyflow 컨테이너 height 미지정 시 방어(fallback 'grid', height 420px 고정).
- **Cardinality**: 0노드(빈 stages)/1노드/전체 8노드 렌더 확인 — 변환 로직이 빈 배열에서 크래시 없어야 함(T2-2).
- **Time**: SSR→hydration 타이밍에 localStorage 반영이 hydration 이후 일어나 초기 flash(grid→graph 깜빡임)를 최소화하는지 확인.

---

## Week 2 계획서 연계

`pipeline-emulator-week2-plan.md` T2의 `@xyflow/svelte 읽기전용 단계 그래프 [ ]` 항목은 이 계획서로 이관되었다.
Week 2 계획서 해당 항목에 "→ pipeline-emulator-feat-dag-graph-toggle.md 참조"를 표기해 둔다.
