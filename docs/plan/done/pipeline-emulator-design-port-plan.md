# 파이프라인 에뮬레이터 — Design Port 실행 계획서 (프론트엔드 이식)

> 상태: 통테통과-완료 / plan-review 보강 반영
> 작성일: 2026-07-14 / 원본 상태: 초안 (착수용)
> 스킬: `/design-port` (그린필드 모드)
> 소스: `pipeline-explorer` (Lovable 생성 React/Next.js) — https://github.com/mzd-nrkim/pipeline-explorer.git
> 타겟: `pipeline-emulator/frontend` (SvelteKit 2 + Svelte 5 신규 스캐폴딩)
> 근거: [design-prompt-monitoring-dashboard.md](../design-prompt-monitoring-dashboard.md) · [lodestar-reuse-assessment.md](../lodestar-reuse-assessment.md) · [pipeline-emulator-mvp-plan.md](./pipeline-emulator-mvp-plan.md) · [pipeline-emulator-week2-plan.md](./pipeline-emulator-week2-plan.md) · [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md) · [rename-to-pipescale.md](./rename-to-pipescale.md)
> 브랜드: 제품 표시명은 **PipeScale**(리네임 계획 확정). 단 **폴더 이동은 보류** → 이 계획의 파일시스템 경로는 당분간 `pipeline-emulator/` 유지, UI·문서 표기만 PipeScale 사용. (§2.5 참조)

---

## 0. 이 계획의 위상 (Week 2·MVP와의 경계)

이 계획은 **Lovable 소스(`pipeline-explorer`)의 시각·레이아웃·인터랙션을 SvelteKit으로 이식**하는 design-port 전용 실행 계획이다. [pipeline-emulator-week2-plan.md](./pipeline-emulator-week2-plan.md)의 T2(대시보드)·T3(설정)와 **파일·요구사항이 겹치나 목표는 다르다**.

| 구분 | design-port (이 계획) | Week 2 (후속 통합) |
|------|----------------------|-------------------|
| 데이터 | `src/lib/mock/` 목 스토어 | ui-backend `/stages`·`/runs`·`/executions` + SSE |
| flow | `@xyflow/svelte` 읽기전용 렌더 | 동일 + SSE 실시간 상태 갱신 |
| 실행 조작 | UI 상태만(목 시뮬레이션) | Airflow REST·실제 투입/실행 연동 |
| compose | `frontend/` 단독 빌드 | `ui` 서비스로 compose 편입 |
| 완료 판정 | 시각 일치 + mock 데모 | SSE·실데이터·데모 시나리오 리허설 |

- **경계**: 백엔드 HTTP·WebSocket/SSE·postgres 서비스 DB·Docker Compose `ui` 서비스 기동은 **이 계획 범위 밖**. 다만 Week 2가 그대로 흡수할 **`src/lib/api/` 어댑터 인터페이스·타입만 선점**한다(mock 구현 ↔ real 구현 스왑).
- **증분 원칙**: Week 1 MVP·Week 2 ui-backend를 버리지 않는다 — 이식 산출물은 Week 2가 **컴포넌트·라우트·DESIGN.md를 흡수**하고 데이터 소스만 mock→api로 교체한다.
- **소스 실체**: `pipeline-explorer`는 Phase 0 클론 전까지 미확인. Lovable 결과가 design-prompt와 어긋나면 **소스 실재를 우선**하고, design-prompt 누락분은 Phase 0 인벤토리에 기록 후 이식한다.

---

## 1. 목표

Lovable가 [design-prompt-monitoring-dashboard.md](../design-prompt-monitoring-dashboard.md)로 생성한 React/Next.js 결과물(`pipeline-explorer`)에서 **디자인·레이아웃·인터랙션을 추출**하여, **PipeScale**의 실제 프론트엔드인 **`pipeline-emulator/frontend`(SvelteKit 2 + Svelte 5 + Tailwind 4)로 이식**한다. 이는 MVP 계획서가 "Week 2 이후"로 미뤄둔 커스텀 대시보드(`SvelteKit + @xyflow/svelte`) 착수에 해당한다.

**완료 기준(이식 종착점)**: design-prompt의 6개 페이지 탭(개요·파이프라인·문서·검색·설정·컴포넌트)이 SvelteKit 라우트로 재현되고, 컴포넌트 페이지의 재사용 요소가 모두 Svelte 컴포넌트로 존재하며, `npm run build` 무에러 + 소스 대비 시각적 일치(레이아웃·간격·타이포·인터랙션)를 만족한다.

- **성공 기준(데모)**: 목(mock) 데이터로 6개 페이지가 렌더되고, 파이프라인 페이지의 6단계 flow가 `@xyflow/svelte`로 그려지며, 마스킹 전후 비교·상태 배지·실행 이력 등 핵심 시연 요소가 동작한다.
- **핵심 원칙**: 이식 = 디자인/구조 재현. **데이터는 목 스토어로 시작**하되, MVP 계획서의 API 어댑터 경계(환경변수 URL 주입)를 지켜 이후 `ui-backend` 연결이 컴포넌트 스왑으로 끝나게 한다.

### 이식 원칙 (크로스커팅)

- **한국어 UI**: 데모 대상이 국내 경영진·고객이므로, Lovable 소스의 **사용자 노출 문자열은 한국어로 번역**한다(라벨·버튼·빈 상태·툴팁·배지·에러 문구). 코드 식별자·CSS 클래스·목 데이터 `id` 필드는 원문 유지.
- **도메인 용어**: 처리 단계명·상태(완료·진행·대기·실패·없음)·계층(Bronze/Silver/Gold)은 design-prompt·sample-data-plan 용어를 따른다. 브랜드 표기는 §2.5 PipeScale.
- **목 데이터 계약**: [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md) 및 design-prompt **부록 A** 예시 값(문서 ID `AP00005928||1`, 단계별 행 수 5→15, PII 예시, 토글 기본값)을 mock 스토어 초기값으로 사용한다.
- **실시간 갱신 UI**: design-prompt의 "새로고침 없이 반영"은 **이번엔 mock 타이머/수동 갱신으로 시뮬레이션**하고, SSE 연동 지점(`subscribePipelineStatus` 등)은 `api.ts`에 **stub만 선점**(Week 2에서 활성화).
- **소스 기준선 보존**: Phase 0에서 소스 commit SHA, 라이선스/자산 출처, 6라우트 데스크톱·모바일 스크린샷을 먼저 고정한다. 이후 "시각 일치"는 기억이 아니라 이 기준선과 대조한다.
- **접근성 기본선**: 탭·토글·버튼·flow 선택·필터는 키보드 조작, focus-visible, aria-label/aria-current/aria-disabled를 갖춘다. 색상만으로 상태를 전달하지 않는다.
- **라우팅 상태 보존**: 선택된 단계·실행·문서·검색 질의·필터는 가능한 한 URL query/path로 표현해 새로고침·공유 링크에서 같은 화면으로 복원한다.
- **상태 4종 표준화**: 모든 데이터 뷰는 loading/error/empty/ready 상태를 갖는다. mock이라도 `real-adapter` 전환 시 필요한 실패·빈 상태 UI를 미리 만든다.

---

## 2. 소스·타겟·전제

| 항목 | 값 |
|------|-----|
| 소스 코드 | `pipeline-explorer` (React/Next.js, Lovable 생성) — **아직 클론 안 됨** |
| 소스 스타일 | Tailwind (Lovable 관행) + lucide-react (추정, Phase 0에서 확인) |
| 타겟 프로젝트 | `pipeline-emulator/frontend` (신규 SvelteKit 앱, `docs/`와 같은 repo에 공존) |
| 타겟 스택 | SvelteKit 2.0 + Svelte 5 (`$state`/`$derived`/`$effect` runes) + Tailwind CSS 4 + bits-ui + lucide-svelte |
| flow 시각화 | `@xyflow/svelte` **신규 도입** (읽기전용 3레이어 고정 레이아웃 — lodestar-reuse-assessment 결론) |
| 참고 자산 | `lodestar` — chrome/유틸(레이아웃 셸·docker-compose healthcheck 패턴 등)만 **선별 차용**, 도메인 코드는 미차용 |
| 이식 범위 | **전체 6개 페이지** (개요·파이프라인·문서·검색·설정·컴포넌트) |
| 색상 정책 | **Lovable 생성 팔레트 채택** → 이식 후 `frontend/DESIGN.md`로 **역캡처** (design-prompt 명시: 브랜드 미확정, 구현 결과 팔레트를 사후 고정) |

> **모드 판별 (design-port 1.5단계)**: 🟢 **그린필드** — 타겟 `pipeline-emulator/frontend`에 기존 `.svelte` 컴포넌트 0개. → design-port **2~5단계(토큰 추출 → 매핑 → 스타일 → 실행)** 경로 사용.

### 2.5 브랜드·네이밍 (rename-to-pipescale 준거)

[rename-to-pipescale.md](./rename-to-pipescale.md)가 확정한 네이밍을 **신규 코드에는 처음부터 적용**한다 — 이 프론트엔드는 기존 문자열 치환 대상이 아니라 새로 쓰는 코드이므로, 리네임 대기 없이 PipeScale 관례로 태어난다.

| 항목 | 적용 값 | design-port에서의 위치 |
|------|---------|------------------------|
| 표시 이름(브랜드) | **PipeScale** | 앱 헤더 로고/타이틀, 개요 페이지 제목, `<title>`, `DESIGN.md` 브랜드 섹션 |
| 경로/식별자 | `pipescale` (소문자) | 신규 심볼·CSS 클래스 prefix·목 스토어 키 등은 `pipescale`/`pipeline-emulator` 어느 쪽도 새로 박지 않되, 필요 시 `pipescale` 사용 |
| 첫 등장 병기 | `PipeScale(파이프라인 에뮬레이터)` 허용 | 개요 페이지 도입부 설명 |

- **폴더 경로는 보류**: T1(폴더 `mv`)·T2(파일명) 미실행 상태이므로, 이 계획의 **파일시스템 경로는 `pipeline-emulator/frontend` 그대로**다. 리네임 실행 시 이 `frontend/`도 `pipescale/frontend/`로 함께 이동하며, **신규 코드 내부엔 이동에 깨질 절대경로를 심지 않는다**(상대경로·SvelteKit alias 사용).
- **"에뮬레이터" 단독(일반명사)은 유지** — 교체 대상은 고유명사 "파이프라인 에뮬레이터"뿐(rename 계획 §2 원칙 준수).

---

## 3. 범위 경계

| 포함 (이번 이식) | 제외 (이후) |
|------------------|-------------|
| 6개 페이지 라우트 골격 + 네비게이션 | `ui-backend` 실제 API 연동 (목 스토어로 대체) |
| 컴포넌트 페이지의 재사용 요소 전부(§6-Phase3 목록) | 실시간 WebSocket/SSE 실행 현황 스트리밍 |
| 파이프라인 flow `@xyflow/svelte` 읽기전용 렌더 | 실제 파이프라인 실행 조작(투입/시작/재실행) 백엔드 연결 |
| 마스킹 전후 비교·PII 카운트·실행 이력 UI | 검색 서빙 실제 질의(예정 상태로만 노출) |
| 반응형(모바일 우선) + 상태색 의미 매핑 | 정밀 마스킹·하이브리드 검색 실동작(예정 배지) |
| Lovable 팔레트 → `DESIGN.md` 역캡처 | |
| 소스 public/assets·아이콘·폰트 출처 확인 및 필요한 정적 자산 이관 | 신규 브랜드 로고 제작(소스에 없으면 텍스트 로고로 대체) |

> **예정(coming-soon) 요소**: design-prompt가 "예정 표시로 구분"하라고 명시한 축(검색 서빙, 정밀 마스킹, 분산 실행, 클러스터 등)은 **예정 배지 + 비활성 UI**로 이식한다 — 기능 미구현이지 화면 미이식이 아니다.

---

## 4. 디자인 토큰 추출 계획 (design-port 2단계)

Phase 2에서 소스 코드로부터 아래 10개 카테고리를 체계적으로 추출해 `frontend/DESIGN.md` 및 Tailwind 4 테마(`app.css` `@theme`)로 고정한다.

1. **색상** — surface/background/card, text(primary/secondary/muted), border, accent, 상태색(완료·진행·대기·실패·없음 5종), hover/focus 변형 → **채택** (테마 비허용 아님)
2. **타이포그래피** — font-family, h1~h6/body/caption/label 크기·weight·line-height·letter-spacing
3. **간격** — padding/margin/gap, 섹션 여백 패턴
4. **레이아웃** — flex/grid 구조, 컨테이너 max-width, 셸 중첩(헤더+탭+콘텐츠), z-index
5. **보더** — radius(버튼·카드·입력·배지), width/style, 포커스 링
6. **그림자** — 카드·모달·드롭다운 elevation 단계
7. **애니메이션** — transition duration/easing, hover/focus, 진입·퇴장, 스켈레톤/로딩
8. **반응형** — 브레이크포인트, 모바일/태블릿/데스크톱 레이아웃 변화, 숨김·표시 전환
9. **인터랙션** — hover(스케일·색상·밑줄), 포커스, 탭 피드백, sticky 스크롤
10. **아이콘 & 에셋** — `lucide-react` → `lucide-svelte` 매핑, 아이콘 크기·색상

> **상태색 원칙(design-prompt)**: 값이 아니라 의미(완료·진행·대기·실패·없음)로 규정. Lovable가 부여한 관습적 매핑을 추출해 CSS 변수 5종(`--status-done/running/pending/failed/empty`)으로 고정한다.

---

## 5. 문법·의존성 변환 매핑 (design-port 3단계)

| React (소스) | Svelte 5 (타겟) |
|--------------|-----------------|
| `useState` / `useReducer` | `$state()` |
| `useEffect` | `$effect()` |
| `useMemo` / 파생값 | `$derived()` |
| `{cond && <C/>}` | `{#if cond}<C/>{/if}` |
| `{items.map(...)}` | `{#each items as item}...{/each}` |
| `className` / `onClick` / `onChange` | `class` / `onclick` / `oninput`·`onchange` |
| `props.children` | `{@render children()}` (snippets) |
| `useContext` | `getContext`/`setContext` |
| `useCallback` | 일반 함수(필요 시 `$derived`로 안정 참조) |
| `useRef` / `ref={el}` | `bind:this={el}` |
| `<>{...}</>` Fragment | 그냥 나열(fragment 불필요) |
| `dangerouslySetInnerHTML` | `{@html content}` (목 데이터만, XSS 주의) |
| Next.js `<Link>`·router | SvelteKit `<a>` + `$app/navigation`·`$app/state` |
| Next.js 파일 라우팅(`app/`·`pages/`) | SvelteKit `src/routes/**/+page.svelte` |
| `lucide-react` | `lucide-svelte` |
| React Flow(`@xyflow/react`, 있으면) | `@xyflow/svelte` |
| shadcn/ui·Radix (있으면) | `bits-ui` 대응 컴포넌트 |
| CSS modules / styled-components | Tailwind 클래스 유지 or scoped `<style>` |

> Tailwind는 **양쪽 다 사용** → 클래스는 원칙적으로 유지하되, Tailwind 3→4 문법 차이(`@theme`, 색상 opacity 표기 등)와 소스 커스텀 클래스는 Phase 2 테마로 흡수한다.
> **유틸**: `clsx` + `tailwind-merge`(`cn`) — lodestar `utils.ts` 패턴 그대로 도입.

---

## 5.5 스타일 이식 전략 (design-port 4단계)

| 전략 | 적용 | 비고 |
|------|------|------|
| **A. 색상 채택** | Lovable 팔레트 → `app.css` `@theme` + CSS 변수 | design-prompt "구현 결과 역캡처" 정책 |
| **B. 구조만 이식** | 해당 없음 (색상도 채택) | — |
| **C. Tailwind 유지** | 클래스 문자열 원칙 유지, 3→4 차이만 Phase 2 흡수 | `@tailwindcss/vite` 플러그인 |
| **shadcn/Radix** | 소스가 쓰면 `bits-ui` 대응 primitive만 이식(Phase 0 인벤토리로 확정) | Sheet·Dropdown·Toggle·Button 등 **실사용분만** |
| **애니메이션** | 소스가 `tw-animate-css` 등 쓰면 동일 의존성 추가 | Phase 0에서 확인 |

---

## 6. Phase 구성 (의존성 순서)

> plan-run 위임 시: 각 Phase는 Task 위임. Phase 0~2는 직렬(선행 의존), Phase 4의 5개 페이지 이식은 컴포넌트 라이브러리(Phase 3) 완료 후 **병렬 위임 가능**(독립 라우트 파일).

### Phase 0 — 소스 확보 및 구조 파악 (직렬 선행)
- **작업**
  - [x] `pipeline-explorer` repo 클론 (`/Users/mz01-risingnrkim/workspace_mzd/pipeline-explorer`)
  - [x] 소스 기준선 기록: clone 시점 commit SHA(`HEAD`), 원격 URL, 라이선스/README/asset attribution 확인(미확인 자산은 재사용 금지 또는 대체)
  - [x] 프레임워크·의존성 확정: `package.json` 확인 (Next.js 버전, Tailwind 버전, lucide-react 여부, React Flow 사용 여부, shadcn/Radix 여부)
  - [x] 라우팅 구조 매핑: 소스의 6개 화면이 어느 파일에 대응하는지 표로 정리
  - [x] 공용 컴포넌트 인벤토리: §6-Phase3 재사용 요소가 소스의 어느 컴포넌트인지 대응
  - [x] 정적 자산 인벤토리: `public/`·이미지·폰트·favicon·메타태그·OG 이미지·커스텀 아이콘을 이관/대체/폐기 3분류
  - [x] 시각 기준선 캡처: 소스 앱을 기동할 수 있으면 6개 화면을 390px/768px/1440px viewport로 스크린샷 저장(`docs/design-port-baseline/` 권장) — **기동 미시도 — Z-post 시 대조** (bun 기반, node_modules 없음)
  - [x] 사용자 노출 문자열 인벤토리: 영어/한국어/도메인 용어를 분리하고 번역 대상 목록 작성
  - [x] **Lovable↔design-prompt 갭 목록**: 소스에만 있는 요소 / design-prompt에만 있는 요소 분리 기록
- **검증**: 의존성·라우팅·컴포넌트 대응표·자산 인벤토리·문자열 인벤토리·스크린샷 기준선·갭 목록 산출. React Flow 사용 여부 확정(→ xyflow 매핑 범위 결정).

### Phase 1 — 타겟 스캐폴딩 (직렬, Phase 0 후)
- **작업**
  - [x] `pipeline-emulator/frontend`에 SvelteKit 2 + Svelte 5 신규 생성 (`npm create svelte`)
  - [x] Tailwind CSS 4 + `@theme` 설정, `bits-ui`·`lucide-svelte`·`@xyflow/svelte` 설치
  - [x] `+layout.svelte` + `AppShell.svelte`: 헤더·6탭 네비·콘텐츠 영역(소스 `AppShell` 대응). lodestar `AppShell`은 **레이아웃 패턴만** 참고(도메인 nav 항목·위협 배너 등은 미차용)
  - [x] lodestar에서 **chrome/유틸만 선별 차용** — 아래 파일 목록 Phase 1 완료 시 이 계획서에 기록:
    - `StatusPill.svelte` · `StatusDot.svelte` · `ProgressTrack.svelte` (상태 UI, 도메인 상태명만 매핑) — Phase 3에서 구현 예정
    - `statusStroke.ts` (상태색 → `--status-*` 토큰 연동) — **차용 완료** (`src/lib/statusStroke.ts`)
    - `loadstar-store.svelte.ts` (**패턴만** — `$state` 단일 스토어 구조를 `pipescale-store.svelte.ts`로 변형) — Phase 3에서 구현 예정
    - `utils.ts` (`cn`) — **차용 완료** (`src/lib/utils.ts`)
    - `api.ts` (**인터페이스·SSE stub만** — `subscribePipelineStatus` 등 Week 2 연동 지점) — **선점 완료** (`src/lib/api/`)
    - **미차용**: `FlowCanvas`·`blockers`·LLM·audit 등 도메인 코드
  - [x] 앱 셸 브랜딩: 헤더 로고/타이틀·`app.html <title>`을 **PipeScale**로 (§2.5). 개요 첫 등장 `PipeScale(파이프라인 에뮬레이터)` 병기. 경로 alias(`$lib` 등)만 사용
  - [x] 6개 라우트 골격: `src/routes/{,pipeline,documents,search,settings,components}/+page.svelte`
  - [x] 라우팅 상태 설계: `/pipeline?stage=&runA=&runB=`, `/documents?doc=&stage=`, `/search?q=&mode=&security=&importance=&vehicle=` 등 deep-link query를 선점
  - [x] 정적 자산 이관: Phase 0에서 승인된 favicon/폰트/이미지/OG 메타를 `static/` 또는 앱 메타로 반영. 출처 불명 자산은 텍스트/아이콘 대체
  - [x] 목 데이터 레이어 `src/lib/mock/`:
    - `pipeline.ts` — 6단계+검색(예정) 노드·계층·상태·문서 수(5→15)
    - `documents.ts` — 식별자·중요도·보안분류·단계별 변화·fan-out·PII 시드
    - `runs.ts` — 실행 이력·회차 비교용 스냅샷
    - `config.ts` — 7축 토글 기본값(design-prompt 부록 A)
    - `search.ts` — 질의·결과·하이브리드 스코어(검색 off 시 빈/예정)
    - `selectors.ts` — flow 노드·문서 목록·PII 카운트·검색 결과를 같은 seed에서 파생해 화면 간 숫자 drift 방지
  - [x] API 어댑터 경계 `src/lib/api/`:
    - `types.ts` — Week 2 `/stages`·`/runs`·`/executions` 응답 타입 선점
    - `client.ts` — `PUBLIC_UI_BACKEND_URL` 환경변수, mock/real 스왑 팩토리
    - `mock-adapter.ts` / `real-adapter.ts`(stub) — 컴포넌트는 adapter만 import
  - [x] 공통 상태 컴포넌트/패턴: `LoadingState`·`EmptyState`·`ErrorNotice`·`RetryButton`을 만들고 adapter 호출부가 동일 패턴 사용
  - [x] `@xyflow/svelte` SSR guard: 브라우저 전용 렌더가 필요하면 `browser` 조건 또는 client-only wrapper로 `npm run build`/SSR 오류 방지 — `@xyflow/svelte`는 현 Phase에서 import 미사용(Phase 4에서 활성화), `npm run check` 0 errors 확인
- **검증**: `npm run dev` 기동, 6탭 이동, `npm run check` 0 error, `npm run build` 무에러. 패키지 매니저 **npm** 고정.

### Phase 2 — 디자인 토큰 추출 + DESIGN.md 역캡처 (직렬, Phase 1 후)
- **작업**
  - [x] §4의 10개 카테고리를 소스에서 추출
  - [x] Tailwind 4 `@theme`에 색상·타이포·간격·radius·shadow 토큰 반영
  - [x] 상태색 5종(`--status-done/running/pending/failed/empty`) CSS 변수 고정
  - [x] `frontend/DESIGN.md` 작성 — Lovable 팔레트를 디자인 시스템 계약으로 역캡처 (design-prompt가 예고한 "구현 결과 팔레트 확정 시 역캡처"). **브랜드 섹션에 제품명 PipeScale 명시**
- **검증**: DESIGN.md의 토큰과 `app.css` `@theme` 값 일치. 임의 컴포넌트 하나에 토큰 적용해 색·간격 반영 확인.

### Phase 3 — 컴포넌트 라이브러리 이식 (직렬, Phase 4의 선행)
design-prompt 컴포넌트 페이지의 재사용 요소를 Svelte 컴포넌트로 이식하고, `/components` 라우트에 **이름·용도·가능한 상태(변형)** 메타와 함께 갤러리 전시.
- **작업** (각 요소 = 하나 이상 상태/변형 포함)
  - [x] 상태 배지 (완료·진행·대기·실패·없음)
  - [x] 상태 점(dot)
  - [x] 진행 스테퍼 (계층 진행 표시)
  - [x] 단계 노드 (계층·상태·문서 수) — xyflow 커스텀 노드로도 재사용
  - [x] 실행 이력 항목
  - [x] PII 유형별 카운트 표시
  - [x] 마스킹 전후 비교 요소
  - [x] 검색 결과 항목
  - [x] 구성 토글
  - [x] 예정(coming-soon) 배지
  - [x] 공통 상태 요소 — 로딩·빈 상태·오류·재시도
  - [x] 필터/세그먼트 컨트롤 — 검색 방식·보안분류·중요도·차종 등 옵션셋
- **검증**: `/components` 페이지에서 각 요소의 모든 변형이 한 화면에 렌더. 키보드 포커스 순서와 Svelte 5 runes 문법 사용 확인.

### Phase 4 — 페이지 이식 (Phase 3 후, 5개 페이지 병렬 위임 가능)
각 페이지는 design-prompt의 해당 "요구사항" 절을 계약으로 이식. 목 데이터로 채운다.

> **병렬 주의**: 5개 페이지는 라우트 파일이 분리되어 병렬 위임 가능. 단 **공유 편집**(`AppShell`, `pipescale-store`, mock 스토어)을 건드리는 Phase는 Phase 1·3 완료 후에만 시작.

- [x] **개요** — PipeScale 제목/도입(첫 등장 `PipeScale(파이프라인 에뮬레이터)` 병기), 전체 여정(투입→3계층 6단계→검색), 데모 내러티브, 현재 구성 요약(마스킹·검색서빙 등), 데모 시작 진입, 원본↔대체 구성 대응표, 파이프라인·검색·설정 이동, 모바일 우선 한 화면 요약
- [x] **파이프라인**
  - 실행 조작: 샘플 투입(규모·PII 밀도 조건 UI), 시작·전체/특정단계 재실행·중지, 상태별 버튼 활성/비활성, 완료/실패 알림
  - 투입·실행 전 상태 구분 + "다음에 할 일" 안내
  - `@xyflow/svelte` flow: 6처리단계 + 흐름 끝 **검색 단계(예정)** 노드, 3계층 구분·방향·전체 진행도·줌/팬
  - 단계 노드: 이름·계층·상태·문서 수·마지막 처리 시각·짧은 설명·선택→세부
  - 단계 세부: 입/출력 문서 수, 최근 실행 시각·소요·성공/실패·실패 사유, 문서 목록 이동
  - PII 마스킹(실버 선택 시): 마스킹/비마스킹 수, PII 유형별 건수, 현재 방식, 미적용 유형 예정 표시
  - 실행 이력: 회차 목록(식별자·시작·소요·결과·당시 구성), 선택→단계별 결과, **두 실행 단계별 비교**
  - 실시간 갱신: mock 타이머/수동 갱신으로 진행 상태 시뮬레이션(SSE stub 연결 지점 표시)
  - URL 상태: 선택 단계·선택 실행·비교 실행 2개가 query로 복원
- [x] **문서** — 목록(식별자·중요도·도달단계·보안분류·마스킹여부·필터) + 단계별 변화: 브론즈 원본, fan-out(문제→부품·차종), 구조화, **마스킹 전후 비교**(가려진 PII 위치·유형), 정규식 시 이름·주소 미가려짐 노출, 청킹·엔리치먼트, **필드매핑(es_field_info·라우팅·보안분류)**, URL의 `doc`/`stage` query로 선택 복원
- [x] **검색** — 서빙 off 시 예정 안내·켜는 경로(설정 링크); on 시 질의(키워드·의미·하이브리드), 결과(제목·요약·중요도·보안·관련도·하이브리드 기여·하이라이트·필터·문서 이동·없음 안내); **(예정) 권한별 결과 제한 시연** UI placeholder; 질의·필터는 URL query로 복원
- [x] **설정** — 7축 토글 + 이름·현재값·선택지·설명, 예정 축 비활성, 검색노드는 검색서빙 on 시만 조작; **feature-flag 스토어**(`config.ts`)와 UI 양방향 바인딩(compose profile 연동은 Week 2); 변경 시 다른 페이지의 예정/활성 상태가 즉시 반영
- **검증**: design-prompt 각 절 항목 체크리스트 대조. 예정 요소는 예정 배지. UI 노출 영문 잔존 없음(한국어 원칙).

### Phase 5 — 검증 (직렬, 최종)
design-port 6단계 체크리스트 + 정적 검증 + (가능 시) 시각 대조.
- [ ] 레이아웃이 소스와 시각적으로 일치
- [ ] 간격(padding/margin/gap) 정확 재현
- [ ] 타이포그래피(크기/두께/행간) 일치
- [ ] 색상 정책(Lovable 팔레트 채택) 올바르게 적용
- [ ] 보더/그림자 재현
- [ ] 호버/포커스 인터랙션 동작
- [ ] 반응형(모바일 우선) 정상 — 좁은 화면에서 전체 흐름 파악 가능
- [ ] 아이콘 라이브러리 교체(lucide-react → lucide-svelte)
- [x] Svelte 5 runes 문법 사용
- [x] `npm run check`(svelte-check) 0 error
- [x] `npm run build` 무에러
- [ ] Playwright smoke: 6라우트 이동, 주요 탭/토글/필터/선택/비교 조작, 콘솔 에러 0
- [ ] Playwright screenshot: 390px/768px/1440px에서 주요 화면 캡처 후 Phase 0 기준선과 육안 대조(소스 미기동 시 타겟 baseline + design-prompt 대조)
- [ ] 접근성 smoke: 키보드만으로 6탭·주요 조작 접근 가능, focus 표시 누락 없음, 주요 icon-only 버튼 aria-label 존재
- [ ] mock 정합성 검사: 5→15 문서 수, PII 카운트, 실행 비교 값이 화면 간 불일치하지 않음

---

## 6.5 실행 시 필수 고려사항

> plan-run 위임 시 에이전트가 계획서만 읽으므로 여기 기록.

- **Phase 직렬/병렬**: `0→1→2→3→(4 개요·파이프라인·문서·검색·설정 병렬)→5`. Phase 4 병렬 시 `AppShell`·공유 스토어 동시 편집 금지(Phase 1·3 선행 필수).
- **xyflow + runes**: 커스텀 노드 내부는 순수 Svelte 컴포넌트로 격리(lodestar-reuse-assessment 단서).
- **xyflow SSR**: xyflow가 `window`/DOM에 의존하면 SSR 중 직접 import/render하지 않는다. client-only wrapper 또는 `browser` 조건을 적용하고 build에서 확인한다.
- **폰트 CDN**: 소스가 Google Fonts 등 CDN이면 타겟도 동일 링크 — 오프라인 시 폰트 폴백으로 시각 diff 오탐 가능.
- **소스 미확인 폴백**: `pipeline-explorer` 클론 실패 시 design-prompt + 부록 A만으로 mock UI 구현 후, 소스 확보 시 Phase 2·5에서 재대조.
- **회귀 범위**: 그린필드 — 기존 Svelte 코드 없음. Week 2 착수 시 mock→api 스왑만 추가 diff.
- **Node 정적 게이트 환경 전제**: `node_modules`는 gitignored이나 이 프론트엔드는 **그린필드 신규 스캐폴딩**이라 Phase 1에서 워크트리 안에 `npm create svelte` + `npm install`로 `node_modules`가 생성된다 → `npm run check`/`build`는 워크트리(Z-pre)에서도 실행 가능하다. 단 **권위 게이트(수치 근거 판정)는 머지 후 root main(Z-post)** 재실행분으로 확정한다(원본 main에 상주 `node_modules` 전제).
- **e2e 테스트 하네스 전제**: Playwright smoke는 `npm run dev`(또는 `npm run preview`) 기동 앱을 대상으로 하므로 앱 기동 환경이 필요 → **Z-post(머지 후)에 배치**. 워크트리에서는 실행하지 않는다. mock 데이터·읽기전용이라 테스트가 생성하는 영속 상태 없음 → teardown 불요.

---

## 7. 검증 기준 (완료 정의)

1. **빌드**: `pipeline-emulator/frontend`에서 `npm run build` 무에러.
2. **페이지 커버리지**: 6개 라우트가 design-prompt의 대응 요구사항 절 항목을 빠짐없이 렌더(예정 요소는 예정 배지).
3. **컴포넌트 커버리지**: §6-Phase3의 design-prompt 필수 10요소 + 공통 상태/필터 요소가 모두 `/components`에 상태별로 전시.
4. **flow 렌더**: 파이프라인 페이지가 `@xyflow/svelte`로 6처리단계 + 검색(예정) 노드를 계층 구분·방향·진행도와 함께 렌더.
5. **디자인 계약**: `frontend/DESIGN.md`가 Lovable 팔레트를 역캡처하고 `app.css @theme`와 일치.
6. **브랜드 표기**: 앱 헤더·`<title>`·개요 제목·DESIGN.md에 **PipeScale** 사용. UI 카피에 고유명사 "파이프라인 에뮬레이터" 단독 잔존 없음(병기는 허용).
7. **시각 일치**: Phase 5 체크리스트 전 항목 통과.
8. **정적 검증**: `npm run check` 0 error.
9. **Week 2 연계**: `src/lib/api/types.ts`가 Week 2 ui-backend 라우트 계약과 호환, mock adapter로 6페이지 렌더 가능.
10. **상태·접근성**: loading/error/empty/ready 상태와 키보드 접근성 smoke 통과.
11. **라우팅 복원**: 단계·문서·검색·실행 비교 선택이 URL에서 복원된다.

### TC (요약 — plan-review 확장 대상)

- **Happy**: 6라우트 렌더, `/components` 필수 10요소+공통 상태/필터 전 변형, 파이프라인 flow 6+1(검색 예정) 노드, 설정 7축 표시
- **Boundary**: 검색 off/on, 실행 전/중/후 버튼 상태, 문서 0건·결과 0건 빈 상태, adapter loading/error 상태
- **Inverse**: 예정 축 클릭 불가, 검색노드 off 시 비활성, 실행 취소 시 상태 불변(mock)
- **Cross-check**: mock 문서 수 5→15가 flow 노드·문서 목록·PII 카운트와 일치
- **A11y/Route**: 키보드만으로 주요 조작 가능, URL query로 선택 상태 복원

---

## 7.5 TC 상세 (Right-BICEP · CORRECT)

> 위 §7 TC 요약의 plan-review 확장분. Frontend-only design-port(그린필드·mock·읽기전용) — 자동 단위테스트보다 **렌더 커버리지·정적 게이트·e2e smoke**가 주 검증 축. 해당 없는 축은 "해당 없음" 명시. DB·백엔드 미사용 → DB 통합 테스트 비해당.

### Right-BICEP

- **Right (정상 결과)**
  - [ ] 6개 라우트(개요·파이프라인·문서·검색·설정·컴포넌트)가 각각 렌더되고 design-prompt 대응 요구사항 절 항목을 빠짐없이 표시
  - [ ] `/components`에 §6-Phase3의 design-prompt 필수 10요소 + 공통 상태/필터 요소가 전 변형(상태)으로 렌더
  - [ ] 파이프라인 페이지가 `@xyflow/svelte`로 6처리단계+검색(예정) 노드를 계층 구분·방향·진행도와 함께 렌더
- **B (경계 조건)**
  - [ ] off/빈 상태: 검색 서빙 off → 예정 안내+켜는 경로, 문서 0건 → 빈 안내, PII 0건 → "없음" 배지, 검색 결과 0건 → 없음 안내
  - [ ] 단계별 문서 수 5→15 fan-out 경계값이 flow 노드·문서 목록·PII 카운트에 일관 반영
  - [ ] 설정 "검색노드 축"은 검색서빙 켜짐 시에만 조작 가능(off일 때 비활성)
- **I (역 관계/역동작)**
  - [ ] 예정 축 클릭 불가, 검색노드 off 시 비활성, 실행 취소 시 상태 불변(mock) — §7 요약의 Inverse 항목 검증
- **C (교차 확인)**
  - [ ] `frontend/DESIGN.md` 토큰 ↔ `app.css @theme` 값 일치(grep/수동 대조)
  - [ ] mock 데이터 형식 ↔ `src/lib/api/types.ts` 응답 타입 일치(`npm run check`로 강제)
- **E (에러 조건)**
  - [ ] `pipeline-explorer` 클론 실패 → design-prompt+부록 A 폴백 경로로 mock UI 구현(§6.5)
  - [ ] xyflow 커스텀 노드 runes 호환 실패 → 노드 내부 순수 Svelte 컴포넌트 격리 폴백 동작
  - [ ] `real-adapter.ts`(stub) 호출 시 미구현(Week 2 경계)임이 드러남 — mock-adapter로만 데이터 공급
- **P (성능)**: 해당 없음 — mock·데모 규모. `npm run build` 무에러로 대체.

### CORRECT

- **Conformance (형식 준수)**: mock 스토어 각 레코드가 `types.ts` 스키마(식별자·중요도·보안분류·상태 열거값) 준수
- **Ordering (순서)**: 파이프라인 6단계 처리 순서(투입→브론즈 원본→구조화→마스킹→청킹→엔리치먼트→필드매핑) 고정, 실행 이력 회차 정렬 순서
- **Range (범위)**: 단계별 행 수 5→15 범위, PII 카운트 ≥0, 상태값은 5종(완료·진행·대기·실패·없음) 열거값만
- **Reference (참조/전제)**: 컴포넌트는 `src/lib/api/` adapter만 import(client/mock/real 경계 위반 없음), lodestar **도메인 코드 미참조**(chrome/유틸만)
- **Existence (존재/null)**: 문서 없음·검색 결과 없음·PII 없음·소스 미확인 각 케이스에서 빈 상태/폴백 UI 존재
- **Cardinality (개수)**: 라우트 6, design-prompt 필수 재사용 컴포넌트 10(+공통 상태/필터), 상태색 5, 설정 축 7 — 개수 일치
- **Time (시점/동시성)**: "새로고침 없이 반영"은 mock 타이머/수동 갱신으로 시뮬레이션, SSE 연동 지점(`subscribePipelineStatus`)은 stub만 선점(Week 2 활성화)

### e2e (Z-post 배치 — 앱 기동 전제)

- [ ] Playwright smoke spec 신규 작성(미존재 시 필수) — `frontend/e2e/smoke.spec.ts`
  - [ ] 6탭 네비게이션 이동 + 각 라우트 핵심 요소(제목·주요 컨테이너) 존재 단언
  - [ ] 파이프라인 라우트에서 `@xyflow/svelte` 노드 렌더 단언
  - [ ] 검색 off 시 예정 안내, 문서 목록 비어있지 않음 등 대표 빈/충전 상태 1개씩 단언
  - teardown: 해당 없음 — mock 데이터·읽기전용, 테스트가 생성하는 영속 DB 레코드/파일 없음

### DB 통합

해당 없음 — frontend-only, DB·백엔드 미사용. Week 2 ui-backend 연동 시 별도 계획에서 통합 테스트 도입.

---

## 8. 리스크·주의

- **소스 실체 미확인**: Lovable 결과물의 실제 스택(React Flow 사용 여부, shadcn/Radix 채택 여부)은 Phase 0 클론 후에야 확정된다. React Flow를 썼다면 `@xyflow/react`→`@xyflow/svelte` 노드/엣지 스키마 매핑이 추가되고, 안 썼다면 자체 마크업을 xyflow로 재구성한다 — **Phase 0 결과에 따라 Phase 4-파이프라인 공수 변동**.
- **xyflow Svelte 5 성숙도**: lodestar-reuse-assessment는 "읽기전용엔 충분"으로 결론. 우리는 읽기전용이라 리스크 낮음이나, 커스텀 노드 렌더에서 runes 호환 이슈 발생 시 노드 내부는 순수 Svelte 컴포넌트로 격리.
- **Tailwind 3→4 차이**: 소스가 Tailwind 3이면 `@theme`·opacity 표기·플러그인 차이를 Phase 2에서 흡수해야 한다(클래스 무단 복사 시 빌드 경고).
- **자산·라이선스 불명확**: Lovable 소스의 이미지/폰트/아이콘 출처가 불명확하면 그대로 복사하지 않는다. Phase 0에서 출처 확인 후, 불명확한 자산은 lucide/text/CSS로 대체한다.
- **SSR/브라우저 API 충돌**: xyflow 또는 소스 컴포넌트가 DOM API를 전제로 하면 SvelteKit build에서 실패할 수 있다. client-only wrapper를 Phase 1에 선점한다.
- **데이터 결합 범위 넘기 금지**: 이번 이식은 **UI + 목 데이터**까지다. `ui-backend` 실연동·WebSocket 스트리밍은 별도 계획으로 분리(API 어댑터 경계만 선점).
- **lodestar 도메인 코드 차용 금지**: chrome/유틸(셸·네비 패턴)만 차용. lodestar의 위협 전파·CRUD 등 도메인 로직은 우리 요구(읽기전용 모니터링)와 무관하므로 가져오지 않는다.
- **rename-to-pipescale 미실행**: 폴더·파일명은 `pipeline-emulator` 유지. 리네임 T2 실행 시 본 파일도 `pipescale-design-port-plan.md`로 함께 변경 필요(rename 계획 T2 목록에 **추가 등록** 권장).
- **Lovable ↔ design-prompt 괴리**: 소스에 없는 화면 요소는 이식하지 않고, design-prompt에만 있는 요소는 mock으로 보완 — Phase 0에서 갭 목록 작성.

---

## 9. 산출물

- `pipeline-emulator/frontend/` — SvelteKit 2 앱 (6개 라우트 + 컴포넌트 라이브러리 + 목 스토어 + API 어댑터 경계)
- `pipeline-emulator/frontend/DESIGN.md` — Lovable 팔레트 역캡처 디자인 시스템 계약
- Phase 0 산출: 소스 의존성·라우팅·컴포넌트 대응표·정적 자산/문자열 인벤토리·스크린샷 기준선 + Lovable↔design-prompt 갭 목록 (본 계획서에 갱신 기록)
- `src/lib/api/` — mock/real 어댑터 경계 + Week 2 연동 타입

---

## 10. 머지 전·후 게이트 (Z — plan-run 시 스킵 금지)

> frontend-only · DB/LLM 없음 → 마이그레이션·DB 통합 비해당.

### Z-pre (머지 전, worktree)

- [x] Phase 5 체크리스트 전항목 + `npm run check` 0 error + `npm run build` 성공
- [x] 6라우트·design-prompt 필수 10컴포넌트(+공통 상태/필터) 커버리지 육안 확인
- [ ] Playwright를 도입했다면 6라우트 smoke 및 주요 screenshot baseline 생성/확인(워크트리 실행 가능 시)

### Z-post (머지 후, root main)

- [x] root `pipeline-emulator/frontend`에서 `npm run check` · `npm run build` 재실행(수치 근거: 184 files 0 ERRORS, build 2.06s)
- [ ] root `pipeline-emulator/frontend`에서 Playwright smoke 재실행(6라우트·주요 조작·콘솔 에러 0)
- [ ] (Week 2 연계 전) `npm run dev`로 6탭 smoke — compose `ui` 서비스 편입은 Week 2 계획
