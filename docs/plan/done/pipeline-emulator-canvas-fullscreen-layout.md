# 파이프라인 캔버스 — n8n식 풀스크린 셸 + 오버레이 드로어 레이아웃

> 상태: 수정필요
> 작성일: 2026-07-15

현재 `/[mode]/pipeline`의 DAG 캔버스는 "큰 화면 안 작은 프레임"에 갇혀 있다. 세 겹의 크기 제약이 곱해진 결과다 — ① 전역 셸 `max-w-7xl`(1280px), ② 페이지 `grid grid-cols-12`에서 캔버스가 `col-span-9`(75%)·실행이력이 `col-span-3`(25%)를 상시 점유, ③ 캔버스 컨테이너 `height:520px` 하드코딩. 지향점인 n8n은 **DAG 캔버스가 화면 대부분을 edge-to-edge로 채우고, 노드 상세·실행이력 등 보조 UI는 캔버스 위에 오버레이 드로어로 뜨는** 구조다. 이 계획은 캔버스의 *내용*(노드 의미론)이 아니라 *그릇/크기*(셸 레이아웃)를 그 구조로 전환한다.

> 근거: 레이아웃 조사 세션(2026-07-15). `+layout.svelte`·`[mode=mode]/pipeline/+page.svelte`·`ToolCanvasView.svelte` 정독. 사용자 결정: (1) full-bleed **전역** 적용, (2) 노드상세+실행이력을 **단일 오버레이 드로어에서 탭 전환**, (3) DAG 캔버스 화면 점유 최대화.

## 관련 계획서 — 충돌·순서 (실행 시 필수)

이 계획은 아래 **미시작** 계획과 **동일 파일 두 곳**을 편집한다. plan-run은 계획서만 읽으므로 여기 명시한다.

| 관련 계획 | 상태 | 겹치는 파일·영역 | 관계 |
|-----------|------|------------------|------|
| [pipeline-emulator-canvas-dualview-redesign.md](./pipeline-emulator-canvas-dualview-redesign.md) | 미시작 | `ToolCanvasView.svelte`(캔버스 렌더 62-69·드릴다운 72-220), `pipeline/+page.svelte`(조작패널 53-61·grid 66-100) | **직교**(내용 vs 그릇)하나 같은 파일 충돌 |
| refactor-tool-orchestrator-canvas P1/P2/P3 | 전부 `done` | 동일 파일들의 현재 구조를 만든 계획 | 이 계획의 **베이스라인** |

- **직교성**: dualview는 노드 `role` facet·엣지 `channels`·2뷰 투영·위상정렬(=캔버스 *내부 데이터/렌더*)을 다룬다. 이 계획은 셸 폭·캔버스 컨테이너 크기·드릴다운 패널의 *배치 방식*(인라인→오버레이)만 바꾼다. 로직·타입·topology 데이터는 **불변**.
- **권장 순서**: 이 레이아웃 계획을 **먼저** 완료(셸/그릇 확정) → dualview를 그 위에 rebase. 이유: 레이아웃은 컨테이너 수준 변경이라 dualview의 뷰 셀렉터·드릴다운 내용 변경보다 표면적이 넓고 안정적. dualview 착수 시 이 계획이 만든 오버레이 드로어 구조에 뷰 셀렉터·2뷰 토글을 얹으면 된다.
- **충돌 완화 신호**: dualview D-1(`ToolCanvasView` view prop)·D-2(`+page.svelte` 뷰 셀렉터)는 이 계획 완료 후 착수할 것을 dualview 착수자에게 전달(dualview 계획서 "열린 항목"에 순서 의존 추가 검토).

---

## 목표

- 전역 셸의 `max-w-7xl`(1280px) 폭 제약이 해제되어 콘텐츠가 viewport 전체 폭을 쓴다(full-bleed).
- `/[mode]/pipeline`에서 DAG 캔버스가 헤더 아래 **남은 화면 전체**를 edge-to-edge로 채운다(고정 520px 폐기, viewport 반응).
- 노드 상세 패널과 실행이력이 **단일 오버레이 드로어**로 통합되어 캔버스 위에 뜨고(캔버스를 밀어내지 않음), **탭으로 전환**된다.
- 비-파이프라인 페이지(개요·문서·검색·설정·컴포넌트)가 full-bleed 전역화 후에도 가독성을 유지한다(콘텐츠 폭 붕괴 방지).
- `@xyflow/svelte`는 이미 `fitView`를 쓰므로 컨테이너 확대만으로 캔버스가 자동 확장된다 — **라이브러리 교체·노드 로직 변경 없음**.

## 접근 방법

1. **전역 셸 full-bleed 개방 (`+layout.svelte`)**
   - `main`(라인 101)의 `mx-auto max-w-7xl ... px-4 py-6 sm:px-6`에서 `max-w-7xl`·좌우 여백 제약을 제거해 전체 폭을 연다. 파이프라인 페이지가 자체적으로 높이를 채우도록 `main`을 `flex-1 min-h-0`(flex 자식 축소 허용) 컨테이너로 만든다.
   - 헤더 내부 정렬(로고행 39·네비 75)의 `max-w-7xl`도 전역 방침에 맞춰 개방하되, 헤더는 콘텐츠가 적어 full-width가 자연스러운지 실물 확인 후 확정.
   - **헤더 높이 하드코딩 회피**: `calc(100vh - 헤더px)` 대신 **flexbox 체인**(`min-h-screen flex-col` → `header`(고정) + `main flex-1 min-h-0`)으로 남은 높이를 자동 분배한다. 헤더 2단(로고+탭) 높이가 바뀌어도 견고.

2. **비-파이프라인 페이지 가독성 방어**
   - 전역 `max-w-7xl` 제거로 문서 목록·설정 등 텍스트 위주 페이지가 과도하게 퍼진다. 각 페이지 최상단 래퍼에 `mx-auto max-w-7xl`(또는 페이지별 적정 폭)를 **개별 적용**하거나, 공용 `<Container>` 스니펫을 도입해 "셸은 full-bleed, 콘텐츠는 페이지가 폭 결정" 원칙을 세운다. 파이프라인만 full-bleed를 실제로 소비.
   - 실물 확인 후 각 라우트(`[mode=mode]/+page.svelte`·`documents`·`search`·`settings`·`components`)의 최상단 컨테이너 폭 처리 확정.

3. **파이프라인 페이지 풀높이 재구성 (`pipeline/+page.svelte`)**
   - 최상단 `space-y-6`(라인 30)을 `flex flex-col h-full min-h-0`로 교체 — 조작패널(고정)+캔버스(남은 높이 전부) 세로 배치.
   - 조작 패널(32-63)은 `shrink-0`로 상단 고정(툴바화).
   - `grid grid-cols-12`(66) 제거 → 캔버스 래퍼를 `relative flex-1 min-h-0`로 만들어 남은 영역을 캔버스가 독점. `col-span-9`(67)·`col-span-3` 실행이력(77-99) 제거.
   - 실행이력(`data.runs`)은 삭제하지 않고 **오버레이 드로어의 "실행이력" 탭**으로 이관(4항). `RunHistoryItem`·`selectedRunId`·`updateUrl` 로직 재사용.

4. **단일 오버레이 드로어 (노드상세 ↔ 실행이력 탭)**
   - 현재 노드 상세는 `ToolCanvasView.svelte`의 `w-72` 인라인 패널(라인 74)로 캔버스를 밀어낸다. 이를 **캔버스 위 오버레이**(`absolute right-0 top-0 h-full w-80 z-20 shadow-lg`, 캔버스 컨테이너 기준)로 전환.
   - 드로어 헤더에 **탭 2개**: `노드 상세`(선택 노드 있을 때)·`실행 이력`. 노드 미선택 시 실행이력 탭 default, 노드 클릭 시 노드상세 탭 활성.
   - 드로어 열림/닫힘 토글 버튼(캔버스 우상단). 닫으면 캔버스가 100% 폭 확보.
   - **설계 판단**: 실행이력을 `ToolCanvasView` 안으로 넣을지(드로어를 캔버스 컴포넌트가 소유) vs `+page.svelte`가 드로어를 소유하고 `ToolCanvasView`는 캔버스만 담당할지 — 후자가 관심사 분리상 우월(캔버스=그래프, 드로어=페이지 상태). `selectedNode`를 `ToolCanvasView`가 콜백(`onnodeselect`)으로 위로 올리고, 드로어는 `+page.svelte`가 렌더. 실물 확인 후 확정.

5. **캔버스 컨테이너 크기 개방 (`ToolCanvasView.svelte`)**
   - 라인 62 `<div class="relative flex gap-4" style="height:520px;">` → `relative w-full h-full`(부모 flex-1이 높이 제공). 고정 px·`flex gap-4`(드릴다운 병렬 배치용) 폐기.
   - 라인 64 캔버스 `flex-1 border rounded-sm overflow-hidden` → `absolute inset-0`(edge-to-edge). 보더는 취향에 따라 제거/유지, `overflow-hidden`은 SvelteFlow 위해 유지.
   - 드릴다운 패널(72-220)은 4항 오버레이로 이동. 내부 콘텐츠(노드 정보·config 폼·트리거·medallion 증거)는 **그대로 재사용**.
   - `fitView` 유지 — 컨테이너가 커지면 자동으로 넓게 fit.

6. **`PipelineGraphView.svelte`는 범위 밖**
   - 동일한 `height:420px` 고정(라인 75)을 갖지만, 이 계획의 대상은 `ToolCanvasView` 경로(`/[mode]/pipeline`)다. `PipelineGraphView`가 현재 어느 라우트에서 쓰이는지 실물 확인 후, 같은 원리로 후속 처리할지 열린 항목으로 남긴다.

## 실행 시 필수 고려사항

> plan-run은 이 계획서만 읽는다 — 채팅이 아닌 본문 기록.

### ① 테스트 하네스·환경 전제
- 캔버스 topology는 **DB 비의존**(mock adapter). 이 계획은 **레이아웃/CSS만** 바꾸고 topology·타입·로직 불변 → **마이그레이션 없음, DB 통합테스트 해당 없음**.
- 패키지매니저 **npm**. 정적 게이트 `cd frontend && npm run check`(svelte-check)·`npm run build`. `node_modules` gitignored → 정적 게이트는 워크트리가 아니라 **머지 직후 원본 main**에서 실행(Z-static).
- e2e는 playwright(`npm run test:e2e`, 앱 기동 전제) → **Z-post(root main)**.

### ② 회귀 이유·범위 (기존 e2e에 미치는 영향)
- 이 계획은 **DOM 구조를 재배치**한다(grid 제거·드릴다운 인라인→오버레이). 기존 e2e가 특정 셀렉터/레이아웃 구조에 의존하면 깨질 수 있다. 착수 시 아래를 실물 확인:
  - `frontend/e2e/pipeline-canvas.spec.ts` — 노드 클릭 후 drill-down 패널 검증(P1에서 신규 작성, 7 케이스). 드릴다운이 오버레이로 바뀌어도 **패널 콘텐츠·트리거 버튼·노드정보 텍스트가 여전히 존재·가시**하면 통과해야 함. 위치 기반(부모가 flex 형제) 단언이 있으면 갱신.
  - `frontend/e2e/pipeline-view-toggle.spec.ts` — Airflow 트리거(회귀 보존 대상). 트리거 버튼이 오버레이 드로어 안으로 이동해도 클릭 가능해야 함.
  - `route-split.spec.ts` — 전역 셸 변경(full-bleed)이 라우팅·헤더 네비에 영향 없는지 확인.
- **원칙**: 레이아웃 변경으로 인한 e2e 실패는 "계약 변경"이며 Z-post에서 셀렉터·가시성 기준으로 갱신한다(기능 제거 아님).

### ③ 동일 파일 편집·병렬 가능 여부
- 편집 파일: `+layout.svelte`(셸)·`pipeline/+page.svelte`(페이지+드로어)·`ToolCanvasView.svelte`(캔버스 컨테이너)·비-파이프라인 라우트들(가독성 방어).
- `+layout.svelte`(전역 셸)와 비-파이프라인 페이지 가독성 방어는 **결합**(전역 제거 → 페이지 방어가 동시에 필요) → 한 단위로 묶어 순서 보장(셸 개방 직후 페이지 방어).
- `pipeline/+page.svelte`와 `ToolCanvasView.svelte`는 **드로어 소유권**(4항 설계 판단)에 따라 인터페이스가 결합 → 같은 에이전트가 연속 처리 권장(콜백 시그니처 일치 필요).
- **관련 계획 dualview와 병렬 금지** — 동일 파일 충돌. 이 계획 완료·머지 후 dualview 착수.

## 작업 목록

> 현재 파악 수준의 체크박스 — `/plan-review`로 원자 단위 2레벨·TC 상세화 예정.

### A. 전역 셸 full-bleed + 페이지 가독성 방어
- [x] A-1. `+layout.svelte` main(라인 101) `max-w-7xl`·좌우패딩 제거, `flex-1 min-h-0`로 높이 위임 (path: frontend/src/routes/+layout.svelte)
- [x] A-2. 헤더 로고행(39)·네비(75) `max-w-7xl` 개방 여부 실물 확인 후 처리 — 헤더 내부 `max-w-7xl` 유지 결정(콘텐츠 적어 중앙정렬이 자연스러움) (path: frontend/src/routes/+layout.svelte)
- [x] A-3. 비-파이프라인 라우트 콘텐츠 폭 방어 — 개별 `max-w` 래퍼 vs 공용 Container 도입 결정(실물 확인 후 결정) 및 5개 라우트 적용
  - [x] 방식 결정: 각 페이지 최상단 래퍼에 `mx-auto max-w-5xl px-4 sm:px-6` 개별 적용으로 결정 (path: 아래 5파일)
  - [x] `[mode=mode]/+page.svelte`(개요) 본체 래퍼(라인 36 header에만 max-w-3xl, 본체 space-y-12는 무제약) 폭 방어 (path: frontend/src/routes/[mode=mode]/+page.svelte, 앵커: 최상단 콘텐츠 div, 의도: full-bleed 후 텍스트 과확산 방지)
  - [x] `documents/+page.svelte` 최상단 래퍼 폭 방어 (path: frontend/src/routes/[mode=mode]/documents/+page.svelte, 앵커: 최상단 콘텐츠 div)
  - [x] `search/+page.svelte` 최상단 래퍼 폭 방어 (path: frontend/src/routes/[mode=mode]/search/+page.svelte, 앵커: 최상단 콘텐츠 div)
  - [x] `settings/+page.svelte` 최상단 래퍼(라인 27 space-y-6, 무제약) 폭 방어 (path: frontend/src/routes/settings/+page.svelte, 앵커: 최상단 콘텐츠 div)
  - [x] `components/+page.svelte` 최상단 래퍼(라인 35 space-y-8, 무제약) 폭 방어 (path: frontend/src/routes/components/+page.svelte, 앵커: 최상단 콘텐츠 div)

### B. 파이프라인 페이지 풀높이 재구성
- [x] B-1. 최상단 `space-y-6`(30) → `flex flex-col h-full min-h-0` (path: frontend/src/routes/[mode=mode]/pipeline/+page.svelte)
- [x] B-2. 조작 패널(32-63) `shrink-0` 상단 툴바화 (path: 동)
- [x] B-3. `grid grid-cols-12`(66) 제거 → 캔버스 래퍼 `relative flex-1 min-h-0`, `col-span-9`/`col-span-3` 삭제 (path: 동)

### C. 단일 오버레이 드로어 (노드상세 ↔ 실행이력 탭)

> 참고: `ToolCanvasView`에 `handleNodeClick`(라인 41-46)이 이미 존재하나 `selectedNode`를 **내부 state로 보유**한다. 드로어를 `+page.svelte`가 소유하려면 이 선택 노드를 콜백 prop으로 위로 올려야 한다.

- [x] C-1. 드로어 소유권 확정 — `+page.svelte`가 드로어 소유, `ToolCanvasView`는 선택 노드를 콜백으로 올림(관심사 분리, 콜백 시그니처 결합도 확인)
  - [x] `ToolCanvasView`에 `onnodeselect` 콜백 prop 추가, `handleNodeClick`(41-46)에서 선택 노드를 콜백으로 방출 (path: frontend/src/lib/components/ToolCanvasView.svelte, 앵커: handleNodeClick, 의도: 선택 노드를 부모로 승격)
  - [x] `+page.svelte`에서 `onnodeselect` 수신해 `selectedNode` state 보유 (path: frontend/src/routes/[mode=mode]/pipeline/+page.svelte, 앵커: script 상단 state, 의도: 드로어 소유권 이관)
- [x] C-2. 실행이력을 드로어 "실행 이력" 탭으로 이관 — `RunHistoryItem`(import 라인 5)·`selectedRunId`(15)·`updateUrl`(18) 재사용
  - [x] 기존 실행이력 렌더 블록(col-span-3 래퍼 77 / runs 렌더 88-97)을 드로어 탭 콘텐츠로 이동 (path: frontend/src/routes/[mode=mode]/pipeline/+page.svelte, 앵커: col-span-3 실행이력 블록, 의도: 인라인 컬럼→드로어 탭)
- [x] C-3. 노드 상세를 드로어 "노드 상세" 탭으로 이관 — 기존 콘텐츠(정보·config폼·트리거·medallion) 재사용
  - [x] `ToolCanvasView` 드릴다운 마크업(72-221, `w-72` 패널 74)을 드로어 탭 콘텐츠로 이동, 선택 노드는 C-1 콜백 경로로 수신 (path: frontend/src/routes/[mode=mode]/pipeline/+page.svelte, 앵커: 드로어 노드상세 탭, 의도: 드릴다운 콘텐츠 재배치)
- [x] C-4. 드로어 셸 — 오버레이 스타일·열닫 토글·탭 전환 UI
  - [x] 드로어 컨테이너 오버레이 스타일 `absolute right-0 top-0 h-full w-80 z-20 shadow-xl`(캔버스 컨테이너 기준) (path: frontend/src/routes/[mode=mode]/pipeline/+page.svelte, 앵커: 캔버스 래퍼 내 드로어 div, 의도: 캔버스 위 오버레이)
  - [x] 열림/닫힘 토글 버튼(캔버스 우상단), 닫힘 시 캔버스 100% 폭 (path: 동, 앵커: 드로어 토글 버튼)
  - [x] 탭 2개(`노드 상세`·`실행 이력`) 전환 — 노드 미선택 시 실행이력 default, 노드 클릭 시 노드상세 활성 (path: 동, 앵커: 드로어 헤더 탭)

### D. 캔버스 컨테이너 크기 개방
- [x] D-1. ToolCanvasView 컨테이너(62) `height:520px flex gap-4` → `relative w-full h-full` (path: frontend/src/lib/components/ToolCanvasView.svelte)
- [x] D-2. 캔버스(64) `flex-1` → `absolute inset-0` edge-to-edge, `fitView` 유지 (path: 동)
- [x] D-3. 드릴다운 인라인 패널(72-220) 제거(콘텐츠는 C-3로 이동) (path: 동)

### E. (열린) PipelineGraphView 후속 판단
- [x] E-1. `PipelineGraphView.svelte` 사용 라우트 실물 확인 → **어느 파일도 import하지 않음(미사용, grep 0 matches, 2026-07-15 확인)**. 어떤 라우트도 렌더하지 않으므로 이 계획 범위 밖으로 **확정** — height:420px(라인 75) 동반 처리 불필요. (path: frontend/src/lib/components/PipelineGraphView.svelte)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)
> 스키마 변경 없음(레이아웃/CSS만) → 마이그레이션 항목 없음.
#### Z-pre. 머지 전 (워크트리 — 정적·격리)
- [x] 워크트리 브랜치에 구현 커밋 (통합테스트·머지는 메인 책임)
- [x] 변경 파일 심볼/클래스 grep 확인 (`max-w-7xl` 잔존 여부 0건, 드로어 오버레이 클래스 `absolute right-0 top-0 h-full w-80 z-20` 존재 확인)
#### Z-static. 머지 직후 (원본 main — node_modules 상주)
- [x] `cd frontend && npm run check`(svelte-check) 타입 에러 0 (경고 4건 기존 존재)
- [x] `cd frontend && npm run build` 성공
#### Z-post. push 후 (앱 기동 환경)
- [ ] `cd frontend && npm run test:e2e` — 현재 26/28. 잔여 2건(`route-split.spec.ts:25,30` `/real/*` 백엔드 연결 대기 stub 미구현) 미해결. `/real` 모드 +page.ts에 TODO 주석 추가됨. 구현 완료 후 재검증 필요.
  - 셀렉터 갱신: `button { hasText: '✕' }` → `getByRole('button', { name: '드로어 닫기' })` (strict mode — 드로어 닫기·노드 선택 해제 2건 충돌 해소)
  - `text=실행 이력` → `getByRole('button', { name: '실행 이력', exact: true })` (탭 버튼·h2 2건 충돌 해소)
  - 높이 체인 수정: `div.w-full.h-full` → `div.absolute.inset-0` (flex item 자식의 `h-full` 해석 불신뢰 → absolute inset으로 교체)
  - teardown: 신규 DB 레코드·파일 생성 없음(레이아웃/CSS만) → e2e teardown 해당 없음.

## Verification (TC — Right-BICEP · CORRECT)

### Right (정상 결과)
- [ ] `/sample/pipeline`에서 DAG 캔버스가 헤더 아래 화면 폭·높이 대부분을 채운다(1280px 프레임 소멸).
- [ ] 브라우저 폭을 넓히면(예: 1920px) 캔버스가 그만큼 넓어진다(max-w-7xl 잔재 없음).
- [ ] 드로어 닫힘 시 캔버스 100% 폭, 노드 클릭 시 우측 오버레이 드로어가 캔버스 **위에** 뜨고(캔버스 리사이즈 없음) "노드 상세" 탭 활성.
- [ ] "실행 이력" 탭 전환 시 `data.runs` 목록이 드로어에 표시되고 선택 시 `updateUrl` 동작.

### B — Boundary
- [ ] 드로어 열림/닫힘 왕복 후 캔버스 레이아웃 정상(잔여 여백·클리핑 없음).
- [ ] 노드 미선택 상태에서 드로어 열면 실행이력 탭 default(빈 노드상세 크래시 없음).

### I — Inverse
- [ ] 노드 선택→해제(✕)→재선택 후 드로어 탭 상태·콘텐츠 정상 복원.

### C — Cross-check
- [ ] 트리거 버튼이 오버레이 드로어 안에서 클릭 가능하고 `ontrigger`→`activeRunId` 갱신이 기존과 동일하게 동작.

### E — Error
- [ ] 좁은 뷰포트(모바일 폭)에서 드로어가 캔버스를 완전히 덮거나 접히는 등 깨지지 않음(반응형 확인).

### CORRECT
- [ ] **Conformance**: `npm run check` 통과, 브라우저 콘솔 에러 0.
- [ ] **Existence**: 드릴다운 콘텐츠(노드정보·config폼·트리거·medallion)가 오버레이 이관 후에도 모두 존재.
- [ ] **Reference**: 비-파이프라인 페이지(문서·설정 등) full-bleed 후 콘텐츠 폭 붕괴 없이 렌더.
- [ ] **Range**: 캔버스 높이가 viewport-헤더 범위 내(스크롤·언더플로 없음).
- [ ] **Cardinality**: `data.runs`가 0개일 때 실행이력 탭이 빈 상태(크래시·null 참조 없이 "실행 없음" 등)로 렌더, 1개·N개일 때 목록 정상.
- **Ordering**: 해당 없음 — 드로어 탭 전환·열닫은 순서 무관(멱등 UI 상태), 순서 의존 로직 없음. 열닫 왕복은 Boundary에서 검증.
- **Time**: 해당 없음 — 시간 의존 동작 없음(CSS/레이아웃 변경).

### 회귀
- [x] 기존 e2e(`pipeline-canvas`·`pipeline-view-toggle`·`route-split`) 셀렉터 갱신 후 26/28 통과 (`/real/*` 2건 기존 실패, 이 계획 무관).
- **Performance**: 해당 없음 — 소규모 mock topology·CSS 변경.
- **DB 통합 테스트**: 해당 없음 — DB 비의존.

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 헤더 자체도 full-width로 열지 | 실물 확인 후 | 콘텐츠 적어 중앙정렬이 나을 수도 |
| 드로어 소유권(page vs ToolCanvasView) | plan-review/실물 확인 | 권장: page 소유, 캔버스는 콜백 |
| 비-파이프라인 페이지 방어 방식 | plan-review | 개별 래퍼 vs 공용 Container |
| PipelineGraphView(420px) 동반 처리 | 확정(범위 밖) | grep 0 matches — 미사용, 어떤 라우트도 미렌더(E-1) |
| dualview-redesign 착수 순서 의존 | 확정(이 계획 먼저) | dualview 계획서에 순서 의존 반영 검토 |

## 참고 (파일 위치)
- 전역 셸: `frontend/src/routes/+layout.svelte`
- 파이프라인 페이지: `frontend/src/routes/[mode=mode]/pipeline/+page.svelte`
- 캔버스 컴포넌트: `frontend/src/lib/components/ToolCanvasView.svelte`
- (참고) 별도 그래프 뷰: `frontend/src/lib/components/PipelineGraphView.svelte`
- 관련 계획: `docs/plan/pipeline-emulator-canvas-dualview-redesign.md`(미시작·직교)
