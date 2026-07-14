# 라우팅·컴포넌트 대응표

> 작성일: 2026-07-14 / Phase 0 산출물
> 소스: `pipeline-explorer` (TanStack Router, 파일 기반 라우팅 `/src/routes/`)

---

## 1. 6개 화면 → 소스 파일 대응표

| 화면(탭) | 소스 파일 | TanStack Route | 줄 수 | 핵심 내용 |
|---------|----------|----------------|------|----------|
| **개요** (Overview) | `src/routes/index.tsx` | `/` | 121 | 파이프라인 여정 4단계, 현재 구성 요약, 단계 대체표, 6단계 미리보기 |
| **파이프라인** (Pipeline) | `src/routes/pipeline.tsx` | `/pipeline` | 226 | RunControls, PipelineFlow(CSS Grid), StageInspector, RunHistory |
| **문서** (Documents) | `src/routes/documents.tsx` | `/documents` | 186 | 문서 목록 + 필터, StageTimeline(Bronze→Silver→Gold·Field Mapping) |
| **검색** (Search) | `src/routes/search.tsx` | `/search` | 116 | 검색 off 안내, 질의입력, 방식 토글(keyword/semantic/hybrid), 결과목록, ScoreCard |
| **설정** (Settings) | `src/routes/settings.tsx` | `/settings` | 84 | 7축 Dimension 토글 (useState로 로컬 상태 관리) |
| **컴포넌트** (Components) | `src/routes/components.tsx` | `/components` | 133 | 재사용 요소 갤러리 (8개 Group 섹션) |

### 공통 레이아웃

| 파일 | 역할 |
|------|------|
| `src/routes/__root.tsx` | RootShell(html/body), RootComponent(QueryClientProvider), **TopNav**(6탭 네비) |
| `src/lib/pipeline-data.ts` | 전체 목 데이터 + 타입 정의 (Stage, Run, Doc, SearchResult, Dimension) |
| `src/lib/utils.ts` | `cn` 유틸 (clsx + tailwind-merge) |

---

## 2. §6-Phase3 재사용 요소 → 소스 컴포넌트 대응표

| §6-Phase3 요소 | 소스 컴포넌트 | 소스 파일 | 비고 |
|----------------|-------------|----------|------|
| **상태 배지** (완료·진행·대기·실패·없음) | `StatusBadge` | `src/components/pipeline/status.tsx` | 5가지 status 열거값, dot + 라벨 조합 |
| **상태 dot** | `StatusDot` | `src/components/pipeline/status.tsx` | `size-2 rounded-full`, in_progress 시 `animate-status-pulse` |
| **예정 배지** (coming-soon) | `PlannedBadge` | `src/components/pipeline/status.tsx` | "Planned" 텍스트, 점선 border |
| **진행 스테퍼** (계층 진행) | 인라인 구현 | `src/routes/components.tsx` (Group "Progress stepper") | Bronze→Silver→Gold→Serving, 개별 컴포넌트 없음 — 이식 시 `LayerStepper.svelte`로 분리 필요 |
| **단계 노드** (계층·상태·문서 수) | `StageNode` | `src/components/pipeline/stage-node.tsx` | layer accent 색상, active 링, compact prop |
| **실행 이력 항목** | `RunHistory` 내 인라인 | `src/routes/pipeline.tsx` (RunHistory 함수) | `runs[]` 순회, border-l-4 상태색, 독립 컴포넌트 없음 — 이식 시 분리 필요 |
| **PII 카운트** | `piiCounts` 렌더링 | `src/routes/pipeline.tsx` (StageInspector) + `src/routes/components.tsx` | `piiCounts[]` grid 렌더, planned 항목 점선 처리 |
| **마스킹 전후 비교** | 인라인 pre 블록 | `src/routes/pipeline.tsx` (StageInspector) + `src/routes/components.tsx` | `bg-slate-950 text-slate-300`, `bg-primary/40` 마스킹 하이라이트 |
| **검색 결과 항목** | 인라인 article | `src/routes/search.tsx` + `src/routes/components.tsx` | ScoreCard + highlight 함수 (문자열 일치 강조) |
| **구성 토글** | 인라인 segmented button | `src/routes/settings.tsx` (Dimension 섹션) + `src/routes/components.tsx` | grid 분할 버튼, active = bg-foreground text-background |
| **공통 상태 요소** (로딩·빈·오류·재시도) | `EmptyState` (파이프라인) | `src/routes/pipeline.tsx` (EmptyState 함수) | 빈 상태만 존재; loading/error/retry 상태 컴포넌트는 **소스에 없음 → 신규 구현 필요** |
| **필터/세그먼트 컨트롤** | `Filter` (인라인) + select/checkbox | `src/routes/search.tsx`, `src/routes/documents.tsx` | 검색: Filter 스팬 배열, 문서: native select + checkbox; 독립 컴포넌트 없음 |

---

## 3. 소스 컴포넌트 인벤토리 (전체)

### 도메인 컴포넌트 (`src/components/pipeline/`)

| 파일 | 익스포트 | 이식 대상 |
|------|---------|----------|
| `stage-node.tsx` | `StageNode` | ✅ → `StageNode.svelte` |
| `status.tsx` | `StatusDot`, `StatusBadge`, `PlannedBadge` | ✅ → `StatusDot.svelte`, `StatusBadge.svelte`, `PlannedBadge.svelte` |

### UI 프리미티브 (`src/components/ui/`)

shadcn/ui New York 스타일 전체 세트. **도메인 라우트가 실제로 import하는 항목**만 이식 대상:

| shadcn 컴포넌트 | 라우트에서 사용 여부 | bits-ui 대응 |
|----------------|------------------|-------------|
| Button (인라인 구현됨) | 라우트에서 native button 직접 사용 | `Button` (bits-ui) |
| Select (`select.tsx`) | `documents.tsx`에서 native `<select>` 사용 | `Select` (bits-ui) |
| Badge (`badge.tsx`) | 직접 사용 없음 (StatusBadge 자체 구현) | 불필요 |
| 나머지 ui/ 파일 | 도메인 라우트에서 **미사용** | 이식 불필요 |

> **결론**: shadcn/ui 전체 세트가 설치되어 있으나 6개 도메인 라우트는 shadcn UI 컴포넌트를 거의 사용하지 않는다. 대부분 인라인 Tailwind + native HTML 요소로 구현됨. 이식 시 bits-ui 대응 필요 범위가 최소화됨.

---

## 4. 파이프라인 플로우 구현 방식 확정

| 항목 | 소스 구현 |
|------|----------|
| 방식 | **CSS Grid** (`grid-cols-7`) + 카드 배열 |
| 연결선 | 절대 위치 수평선 (`h-px bg-border -translate-y-1/2`) |
| 교호 배치 | 짝수 인덱스 카드에 `lg:mt-8` 적용 (지그재그) |
| @xyflow/react | **미사용** |

이식 시 계획서대로 `@xyflow/svelte`로 업그레이드 구현 (소스에는 없음 → 신규 도입).

---

## 5. 목 데이터 타입 (Week 2 API 어댑터 선점용)

`src/lib/pipeline-data.ts`에서 확인된 타입:

```typescript
// 단계 상태 열거값
type StageStatus = "completed" | "in_progress" | "pending" | "failed" | "none";
type Layer = "Bronze" | "Silver" | "Gold" | "Serving";

// 핵심 타입
interface Stage { id, index, name, layer, status, docsIn, docsOut, description, lastRunAt, durationMs, planned?, failureReason? }
interface Run { id, startedAt, durationMs, status: "succeeded"|"failed"|"in_progress", config: { masking, search } }
interface Doc { id, priority, security, stageReached, masked, vehicleModel, title }
interface SearchResult { id, title, summary, priority, security, vehicleModel, score, keywordScore, semanticScore, highlight }
interface Dimension { key, label, description, values[], current, planned?, dependsOn? }
```

> Week 2 `src/lib/api/types.ts` 작성 시 위 타입을 기반으로 `/stages`, `/runs`, `/executions` 응답 타입을 선점.
