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
- Graph 뷰는 `@xyflow/svelte`로 Bronze → Silver → Gold 3레이어 DAG를 렌더링한다 (읽기 전용, 엣지 방향·확대·이동 지원)
- 두 뷰 모두 기존 클릭 → 인스펙터 패널 연동 동작을 동일하게 지원한다

---

## 접근 방법

1. **토글 상태 추가** — `pipeline/+page.svelte`에 `let viewMode: 'grid' | 'graph' = $state(...)` 추가. 초기값은 `localStorage.getItem('pipelineViewMode') ?? 'grid'`
2. **토글 버튼 배치** — "데이터 처리 흐름" 섹션 헤더(`<section>` 내 첫 `<div>`) 우측에 `Grid | Graph` 2-way 버튼 그룹 삽입
3. **Graph 뷰 컴포넌트 신규 작성** — `frontend/src/lib/components/PipelineGraphView.svelte`
   - `@xyflow/svelte`의 `SvelteFlow`, `Background`, `Controls` import
   - 3레이어(Bronze/Silver/Gold) 고정 레이아웃으로 6+2노드 위치 지정
   - 엣지 방향 연결, 읽기전용(`nodesDraggable={false}`)
   - 노드 클릭 시 기존 `selectStage(id)` 호출 (인스펙터 연동 유지)
   - 커스텀 노드 내부는 `StageNode.svelte` 재사용 가능 범위에서 재사용
4. **조건부 렌더링** — `+page.svelte` 흐름도 영역에서 `{#if viewMode === 'graph'}<PipelineGraphView .../>{:else}...기존 grid...{/if}`
5. **localStorage 동기화** — `viewMode` 변경 시 `localStorage.setItem('pipelineViewMode', viewMode)` 반영

---

## 작업 목록

### T1. 토글 상태 + 버튼 UI (`pipeline/+page.svelte`)

- [ ] T1-1. `viewMode` 상태 변수 추가 (`$state`, 초기값 localStorage → 'grid' fallback)
- [ ] T1-2. `viewMode` 변경 핸들러 — localStorage 동기화 포함
- [ ] T1-3. 섹션 헤더 우측 토글 버튼 그룹 삽입 (`Grid | Graph` 2-way, active 강조)
- [ ] T1-4. 흐름도 영역 조건부 렌더링 분기 (`viewMode === 'graph'` → `PipelineGraphView`, else 기존 grid)

### T2. DAG Graph 뷰 컴포넌트 (`PipelineGraphView.svelte`)

- [ ] T2-1. `@xyflow/svelte` `SvelteFlow` · `Background` · `Controls` import
- [ ] T2-2. `stages` prop 수신 → nodes/edges 배열 변환 로직
  - Bronze(0-1) / Silver(2-3) / Gold(4-5) / Serving(6-7) 레이어별 y 좌표 고정
  - 순차 엣지 정의 (animated 옵션)
- [ ] T2-3. 커스텀 노드 컴포넌트 — 단계 이름·레이어 색상·상태 배지·문서 수 표시
  - `StageNode.svelte` 재사용 or 인라인 축소판
- [ ] T2-4. 노드 클릭 핸들러 → `onNodeClick` → 부모의 `selectStage(id)` 콜백 호출
- [ ] T2-5. `nodesDraggable={false}` · `nodesConnectable={false}` 읽기전용 설정
- [ ] T2-6. 컨테이너 높이 고정 (`height: 420px` 또는 `min-h-[420px]`) — xyflow 필수 요건

### Z. 머지 전·후 검증 (게이트)

#### Z-pre (정적 검증)

- [ ] TypeScript/Svelte 타입 검사 — `npm run check` 통과
- [ ] `PipelineGraphView.svelte` 문법 오류 없음 확인

#### Z-post (브라우저 확인)

- [ ] Grid 뷰(기본) 렌더링 정상 — 기존 UI 회귀 없음
- [ ] Graph 뷰 토글 시 @xyflow 그래프 표시, 노드 8개 정상 렌더
- [ ] Graph 뷰에서 노드 클릭 → 인스펙터 패널 갱신 확인
- [ ] localStorage 저장 확인 — Graph 뷰 선택 후 새로고침 시 Graph 뷰 유지
- [ ] 모바일 레이아웃 확인 — Grid 뷰 반응형 유지, Graph 뷰 스크롤/핀치 동작

---

## Verification

- `npm run check` 오류 0건
- 브라우저에서 `/pipeline` 접속 → Grid 뷰 기본 표시
- 토글 버튼 클릭 → Graph 뷰 전환, 노드 8개 + 엣지 방향 표시
- 노드 클릭 → 인스펙터 패널(우측) 동일하게 갱신
- 새로고침 후 마지막 선택 뷰 복원
- 기존 Grid 뷰 레이아웃 변경 없음 (회귀 없음)

---

## Week 2 계획서 연계

`pipeline-emulator-week2-plan.md` T2의 `@xyflow/svelte 읽기전용 단계 그래프 [ ]` 항목은 이 계획서로 이관되었다.
Week 2 계획서 해당 항목에 "→ pipeline-emulator-feat-dag-graph-toggle.md 참조"를 표기해 둔다.
