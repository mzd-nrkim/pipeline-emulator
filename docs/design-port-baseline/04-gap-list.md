# Lovable↔design-prompt 갭 목록

> 작성일: 2026-07-14 / Phase 0 산출물
> 비교 대상: `pipeline-explorer` 소스 ↔ `design-prompt-monitoring-dashboard.md`

---

## 요약

| 구분 | 건수 |
|------|------|
| 소스에만 있는 요소 | 4건 |
| design-prompt에만 있는 요소 | 12건 |
| 양쪽 일치 (이식 확정) | 대부분 |

---

## 1. 소스에만 있는 요소 (pipeline-explorer에 구현, design-prompt 미명시)

| 요소 | 소스 위치 | 이식 판단 |
|------|----------|----------|
| **브랜드명 "Flux.Engine"** | `__root.tsx` 헤더, `<title>`, og:title, 개요 설명 | **교체** — "PipeScale"으로 대체 (§2.5 결정 사항) |
| **"Stage substitutions" 섹션** (원본 vs 대체 구성 대응표) | `src/routes/index.tsx` 개요 페이지 | **포함** — design-prompt "원본 파이프라인과 에뮬레이터 대체 구성의 대응이 보인다" 요구사항에 해당 |
| **QueryClientProvider 래핑** (`@tanstack/react-query`) | `__root.tsx` | **생략** — SvelteKit에서 미사용, Svelte 5 `$state` 스토어로 대체 |
| **TanStack Router `head()` 메타** (페이지별 og:title/description) | 각 route 파일 | **포함 (변형)** — SvelteKit `<svelte:head>` 방식으로 이식, 내용은 한국어로 번역 |

---

## 2. design-prompt에만 있는 요소 (소스에 없음 → mock 보완 또는 신규 구현)

### 파이프라인 페이지

| 요구사항 항목 | 소스 구현 상태 | 이식 판단 |
|-------------|-------------|----------|
| **샘플 데이터 투입 조건 UI** (투입 규모·PII 밀도 선택) | 소스에 "5 Docs / 12.4 KB · PII density High" 텍스트 표시만 있음. 실제 입력 UI 없음 | **mock 보완** — 슬라이더/선택지 UI 추가, mock 상태로만 작동 |
| **전체 또는 특정 단계부터 재실행** | "Rerun" 버튼 1개 (특정 단계 선택 UI 없음) | **mock 보완** — 단계 선택 후 재실행 UI 추가 |
| **두 실행 단계별 비교** | "Compare" 버튼만 존재, 비교 화면 없음 | **mock 보완** — 두 run ID 선택 후 나란히 비교 UI 구현 |
| **단계 세부: 입/출력 문서 수 + 최근 실행 시각·소요·성공/실패·실패 사유** | StageInspector에 일부 표시됨 (docsIn/Out, durationMs, failureReason) | **포함** — 거의 완성됨, 이관하면 됨 |
| **실행 이력: 회차별 단계 결과 드릴다운** | 클릭 시 단계 결과 화면 없음 (run 클릭 핸들러 없음) | **mock 보완** — 실행 선택 시 단계별 결과 목록 UI 추가 |
| **파이프라인 flow: 확대·축소·팬** | CSS Grid 고정 배치, 확대/팬 없음 | **신규 도입** — `@xyflow/svelte`로 줌/팬 제공 |

### 문서 페이지

| 요구사항 항목 | 소스 구현 상태 | 이식 판단 |
|-------------|-------------|----------|
| **문서 목록 필터: 도달 단계·보안 분류** | priority + masked 체크박스만 있음. security·stageReached 필터 없음 | **mock 보완** — 필터 항목 확장 |
| **단계별 변화: 문서 fan-out 관계** (문제→부품·차종·프로젝트) | 텍스트 설명으로만 언급 (`<p>One Bronze issue can fan out...`) | **포함 (강화)** — 구조화 시각 표현 추가 권장 |

### 검색 페이지

| 요구사항 항목 | 소스 구현 상태 | 이식 판단 |
|-------------|-------------|----------|
| **(예정) 권한별 결과 제한 시연** | 소스에 "Permission-based result filtering" PlannedBadge 텍스트만 존재 | **mock 보완** — 예정 배지 + UI placeholder 유지 |

### 컴포넌트 페이지 (§6-Phase3)

| 요구사항 항목 | 소스 구현 상태 | 이식 판단 |
|-------------|-------------|----------|
| **공통 상태 요소** (로딩·빈·오류·재시도) | EmptyState만 존재 (파이프라인 투입 전용). 로딩/오류/재시도 컴포넌트 없음 | **신규 구현** — `LoadingState`, `ErrorNotice`, `RetryButton` |
| **필터/세그먼트 컨트롤 갤러리** | 검색 방식 토글 UI는 존재하나, 컴포넌트 갤러리에 미포함 | **신규 구현** — 컴포넌트 페이지 Group 추가 |

### 개요 페이지

| 요구사항 항목 | 소스 구현 상태 | 이식 판단 |
|-------------|-------------|----------|
| **데모 내러티브 단계** (순서로 보이는 투입→통과→적재→검색) | 4단계 카드 존재 (01 Ingest → 04 Search), 요구사항 충족 | **포함** |
| **현재 구성 요약** (마스킹 방식, 검색 서빙 상태) | 개요 페이지에 `dimensions` 전체 목록 표시 | **포함** |
| **각 주요 화면으로 이동 버튼** | "Ingest sample data" → `/pipeline`, "Open Pipeline" → `/pipeline`, "Settings" → `/settings` | **포함** (검색 이동은 소스에 없음 → 추가 필요) |

---

## 3. 이식 판단 요약

| 판단 | 건수 | 대상 |
|------|------|------|
| **포함** (그대로 이식) | 대다수 | 6페이지 기본 구조, 상태 배지, 단계 노드, PII 카운트, 마스킹 비교, 검색 결과, 구성 토글, 실행 이력, StageInspector |
| **mock 보완** (소스에 없어 신규 구현하되 mock 데이터로) | 6건 | 투입 조건 UI, 단계별 재실행 선택, 두 실행 비교, 실행 회차 드릴다운, 문서 필터 확장, 권한 필터링 placeholder |
| **신규 도입** (소스 없음, 계획서 요구사항) | 3건 | `@xyflow/svelte` 플로우, 공통 상태 컴포넌트(로딩/오류/재시도), 필터 컴포넌트 갤러리 |
| **교체** (소스 있음, 다른 값으로) | 1건 | 브랜드명 Flux.Engine → PipeScale |
| **생략** (이식 불필요) | 1건 | TanStack React Query (SvelteKit에서 미사용) |

---

## 4. 주요 발견 사항

### 스택 차이 (계획서 수정 필요)

계획서 §2가 소스를 "React/Next.js"로 서술하나 **실제는 TanStack Start + TanStack Router + React 19**다.
- TanStack Router `createFileRoute` → SvelteKit `+page.svelte` 매핑
- `useRouter` / `Link` → `$app/navigation` / `<a>`
- `head()` 함수 → `<svelte:head>` 블록
- Next.js 고유 기능(`<Image>`, `getServerSideProps` 등) 미사용 → 이식 복잡도 감소

### React Flow 미사용 확정

소스에 `@xyflow/react` 또는 `react-flow-renderer`가 없다. 파이프라인 플로우는 CSS Grid + 절대 위치 선으로 구현됨.
→ 이식 시 `@xyflow/svelte` 신규 도입 작업이 추가됨 (매핑 작업 아님, 순수 신규 구현).

### shadcn/ui 설치 vs 실사용 괴리

`components.json`에 shadcn/ui 전체 세트가 등록되고 `src/components/ui/`에 50+ 파일이 존재하나,
**6개 도메인 라우트는 shadcn UI 컴포넌트를 거의 사용하지 않음**. 도메인 컴포넌트 2파일만 실제로 사용.
→ bits-ui 이식 범위: 최소 (native `<select>`, `<button>` 직접 사용 패턴 유지 가능).

### 앱 기동 시도 결과

소스 앱 기동은 **시도하지 않음** (bun 기반, Node.js 환경 미확인, `node_modules` 없음).
→ "기동 미시도 — Z-post 시 대조" 기록. 시각 기준선은 소스 코드 분석으로 대체.
