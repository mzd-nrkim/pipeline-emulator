# 프론트엔드 라우트 2분할 — 샘플(더미) vs 실제(DB) 실행 계획서

> 상태: 게이트통과-머지대기
> 작성일: 2026-07-14
> 근거: [pipeline-emulator-mvp-plan.md](./pipeline-emulator-mvp-plan.md) · 프론트엔드 현행 코드(`frontend/src`)
> 전제: ui-backend(실제 DB 어댑터의 붙일 대상)는 **아직 없음 — Week 2 예정**

---

## 1. 목표

현재 단일 라우트 트리를 **`/sample/*`(DB 없이 더미 데이터)** 와 **`/real/*`(실제 DB 연결)** 두 갈래로 분할해, 데모에서 "더미로 흐르는 그림"과 "실제 DB에 붙는 그림"을 **동시에 구분해 보여줄 수 있게** 한다.

- **핵심 원칙(재작성 방지)**: 페이지 컴포넌트는 **1벌만 유지**하고, 두 URL이 **어댑터만 다르게 주입**받는다. `/sample`은 `mockAdapter`, `/real`은 `realAdapter`.
- **이번 범위의 종착점**: `/sample/*`는 지금 그대로 동작, `/real/*`는 백엔드가 없으므로 **로딩/연결대기 스텁** 상태로 렌더된다. Week 2에 `realAdapter`만 실물로 채우면 `/real/*`가 살아난다.
- **네이밍 확정**: `real`(코드의 `real-adapter.ts`/`realAdapter`와 어휘 일치).

---

## 2. 현재 상태 (이 계획의 전제)

| 항목 | 현행 | 문제 |
|------|------|------|
| 데이터 소비 | 6개 페이지가 `$lib/mock/*`를 **동기 static import** (`stages.find(...)`, `$derived`) | 어댑터를 안 거침 → mock에 하드결합 |
| 어댑터 계약 | `mock-adapter.ts` / `real-adapter.ts` 인터페이스 동일 (`fetchStages/Runs/Documents/Search/Dimensions`, `subscribePipelineStatus`) | 계약은 맞음. 아무도 호출 안 함 |
| 전환 스위치 | `client.ts`의 `USE_MOCK = !PUBLIC_UI_BACKEND_URL` | 전역 1택 → 샘플·실제 동시 노출 불가 |
| 라우트 | `/` `/pipeline` `/documents` `/search` `/settings` `/components` (평면) | 모드 구분 없음 |
| 레이아웃 | `+layout.svelte`에 nav href 하드코딩 + "시뮬레이션 모드" 배지 고정 | 모드 인지 없음 |

> **결론**: "라우터 쪼개기"는 얇은 껍데기이고, **진짜 작업은 "페이지를 mock 직접 import에서 떼어내 어댑터/데이터 주입으로 바꾸는 리팩터"**(R1)다. 이게 없으면 `/real`도 mock을 보게 된다.

---

## 3. 범위 경계

| 포함 | 제외 |
|------|------|
| 데이터 구동 페이지 분할: `overview` · `pipeline` · `documents` · `search` | `realAdapter` 실물 구현(백엔드) — Week 2 |
| 어댑터를 `load`로 승격, 페이지가 `data`/context로 데이터 수신 | ES 검색·실 API 연동 |
| `/real/*` 연결대기 스텁(기존 `LoadingState`/`ErrorNotice`/`EmptyState` 재사용) | 인증·권한 |
| 모드 인지 네비게이션(샘플↔실제 전환 UI) | |
| 랜딩(`/`) → 기본 모드 라우팅 | |

**분할 대상 외 라우트 처리**:
- `/components` — 컴포넌트 갤러리(개발용). 분할하지 않고 mock 고정 유지.
- `/settings` — 설정 토글. 1차엔 **분할 대상에서 제외**(모드 무관 전역 설정으로 유지). 필요 시 후속 결정.

---

## 4. 설계 결정 — 라우트 구조

**채택: 동적 세그먼트 `[mode]` + param matcher** (페이지 파일 중복 0).

SvelteKit 라우트 그룹 `()`은 URL에 세그먼트를 안 남기므로 요구(`/sample/*`, `/real/*`)와 안 맞음 → **실 경로 세그먼트 + matcher**로 간다.

```
frontend/src/
  params/
    mode.ts                      # matcher: param === 'sample' || param === 'real'
  routes/
    +layout.svelte               # 셸(헤더/nav) — 모드 인지로 개편
    +page.svelte                 # 랜딩 → /sample(기본)로 redirect
    [mode=mode]/
      +layout.ts                 # params.mode → 어댑터 선택 → data/context 주입
      +layout.svelte             # (선택) 모드 배지 표시
      +page.svelte               # overview (기존 routes/+page.svelte 이식)
      pipeline/+page.svelte
      documents/+page.svelte
      search/+page.svelte
    components/+page.svelte       # 분할 대상 외 (mock 고정)
    settings/+page.svelte        # 분할 대상 외 (전역)
```

- `/sample/pipeline`과 `/real/pipeline`이 **같은 물리 파일** 하나로 서비스됨.
- 어댑터 선택은 `[mode=mode]/+layout.ts`에서 `params.mode === 'real' ? realAdapter : mockAdapter` 한 곳에서만 결정.
- **주입 방식**: `+layout.ts` load에서 어댑터를 골라 하위 `+page.ts`가 `fetch*`를 호출하도록 하거나(권장: load 반환 `data`), context로 어댑터를 내려 페이지가 직접 호출. → R1에서 방식 하나로 고정.

---

## 실행 시 필수 고려사항

> plan-review 발견 사항 — 구현 에이전트가 반드시 참조.

### ① 회귀 이유·범위
- R1은 4개 페이지(overview/pipeline/documents/search)를 **직접 mock import → 어댑터 load 수신**으로 바꾼다. 회귀 표면 = 4개 페이지의 데이터 렌더 전체.
- 데이터 출처 불일치 주의: 페이지는 `mockRuns`(`$lib/mock/runs`)·`stages`(`selectors`)를 직접 쓰지만, `mockAdapter.fetchRuns`는 `selectors`의 `runs`를 반환한다. `mockRuns`와 `runs`가 **동일 데이터인지 대조**하지 않으면 `/sample`이 기존과 미세하게 달라질 수 있다(R1-6).

### ② 테스트 하네스·환경 전제
- **e2e·vitest 인프라 현재 없음** — Playwright(e2e)·vitest(matcher 단위) 둘 다 이번에 신규 도입해야 한다(devDependency 추가).
- e2e는 `npm run dev`(SvelteKit 개발 서버) 기동 전제 → Z-post(앱 기동 환경)에서 실행.
- `node_modules`는 gitignored → `svelte-check`/`build`는 워크트리에서 신뢰 불가 → **머지 후 원본 main에서 실행**(Node 정적 게이트).
- `real-adapter.ts`의 `subscribePipelineStatus`는 `EventSource(localhost:8000)`를 연다. 백엔드 부재 시 `/real` 진입이 재연결 폭주를 일으키지 않는지 확인 필요(R4·TC Time).

### ③ 실행 순서·동일 파일 편집 충돌
- **R1 → R2 순서 고정**: R1(어댑터 승격) 없이 R2(분할)를 먼저 하면 `/real`도 mock을 본다. R1과 R2는 **같은 4개 페이지 파일을 순차 편집·이동**하므로 병렬 불가 — 한 에이전트(또는 직렬)로 묶는다.
- R2-3의 파일 이동(`git mv`)은 **메인 담당**(Phase 에이전트 git 금지, CLAUDE.md §서브에이전트 위임).
- R3(루트 `+layout.svelte`)은 페이지 파일과 다른 파일이나, R2 완료 후 mode 프리픽스가 존재해야 nav href가 성립 → R3는 R2 뒤.

### ④ 미선택 결정 근거
- SvelteKit 라우트 그룹 `()`은 URL에 세그먼트를 안 남겨 요구(`/sample/*`)와 불일치 → 실 경로 세그먼트 `[mode=mode]` + matcher 채택(§4).
- `staging` 등 3번째 모드 확장은 이번 범위 밖 — matcher 토큰 추가로 후속 대응(§7).
- 주입 방식(load `data` vs context)·search 필터 매핑은 **미결 → R1-0·R1-4에서 실물 확인 후 확정**.

---

## 5. 작업 항목

### R1. 어댑터를 데이터 소스로 승격 (선행 리팩터 — 핵심)

- [x] R1-0. **주입 방식 확정** (load 반환 data 방식 채택) — `+page.ts`가 mockAdapter를 직접 import해 `fetch*` 결과를 `data`로 반환; R2에서 `[mode=mode]/+layout.ts`가 adapter를 선택해 하위 `+page.ts`가 `parent()` 경유로 수신하는 구조로 전환
  - [x] `client.ts`의 `api` 전역 대신 어댑터 인스턴스를 라우트별로 주입하는 지점 결정 (`[mode=mode]/+layout.ts` 후보)
- [x] R1-1. 각 페이지의 `$lib/mock/*` 동기 import 제거, 데이터는 `load` 경유로 수신하도록 변경
  - [x] `routes/+page.svelte`(overview): `stages`·`mockDimensions` import 제거 → `data.stages`·`data.dimensions`
  - [x] `routes/pipeline/+page.svelte`: `stages`·`mockRuns` import 제거 → `data.stages`·`data.runs`
  - [x] `routes/documents/+page.svelte`: `mockDocuments` import 제거 → `data.documents`
  - [x] `routes/search/+page.svelte`: `mockSearchResults`·`mockDimensions` import 제거 → 어댑터 경유 (search 필터 매핑은 R1-4 결정 따름)
- [x] R1-2. `overview`/`pipeline`/`documents`/`search`에 대응하는 `+page.ts`(또는 상위 `+layout.ts`) `load` 작성 — 어댑터의 `fetch*` 호출 결과를 `data`로 반환
- [x] R1-3. 페이지 `<script>`를 `let { data } = $props()` 기반으로 리팩터, `$derived`가 `data.*`를 참조하도록 수정
- [x] R1-4. **search 필터 매핑 결정** — 옵션 A 채택: `load`에서 query 기반 `fetchSearch(query)` 결과 반환, security/priority/vehicle 다중 필터는 클라이언트 유지
- [x] R1-5. `subscribePipelineStatus`(실시간) 소비 지점 정리 — routes에 소비처 없음(grep 0건) 확인, 이번 범위 no-op 유지
- [x] R1-6. 이 단계만으로 **기존 단일 트리가 어댑터 경유로 동일하게 동작**하는지 회귀 확인 — selectors.ts가 mock/*.ts의 mock* 데이터를 그대로 재export하고 mock-adapter.ts도 동일 selectors 사용 → 데이터 동일성 성립

### R2. `[mode]` 세그먼트 + matcher 도입

- [x] R2-1. `src/params/mode.ts` 작성 — `match(param): boolean`이 `sample`·`real`만 `true` 반환 (그 외 `false` → 404)
  - [x] `src/params/mode.test.ts` 작성 (vitest) — TC C-1 항목 커버 (`'sample'`/`'real'` → true, `'Sample'`/`'reals'`/`''`/`'admin'` → false)
- [x] R2-2. `routes/[mode=mode]/+layout.ts` 작성 — `params.mode`로 `mockAdapter`/`realAdapter` 선택해 하위에 공급 (R1-0 확정 방식과 동일 주입 경로)
- [x] R2-3. R1에서 만든 페이지들을 `routes/[mode=mode]/` 하위로 이동 (overview는 `[mode=mode]/+page.svelte`) — 파일 이동은 `git mv`로 히스토리 보존 (메인 담당, Phase 에이전트 git 금지)
- [x] R2-4. 이동한 페이지의 하드코딩 `goto('/pipeline'...)`·`goto('/documents'...)` 등 경로를 **mode-aware**(`/${params.mode}/...` 또는 상대경로)로 수정 — 안 고치면 `/real/pipeline`에서 URL 갱신이 `/sample` 트리로 튐
- [x] R2-5. 이동 후 `/sample/pipeline` 등 경로가 mockAdapter로 정상 렌더되는지 확인

### R3. 레이아웃·네비게이션 모드 인지

- [x] R3-1. 루트 `+layout.svelte` nav href를 모드 프리픽스 기준으로 생성
  - [x] 분할 대상 경로(`/pipeline`·`/documents`·`/search`·`/`) → `/${params.mode}/...` 형태로 수정
  - [x] 분할 제외 경로(`/settings`·`/components`) → 모드 프리픽스 없이 절대경로 유지 (모드 무관 항목)
- [x] R3-2. **모드 전환 UI** 추가 — 헤더에 "샘플 / 실제" 토글
  - [x] 현재 하위경로 유지한 채 프리픽스만 `sample`↔`real` 스왑 (`$page.params.mode`·`$page.url.pathname` 활용)
- [x] R3-3. "시뮬레이션 모드" 고정 배지를 모드 반영형으로 변경 (`샘플=더미` / `실제=DB`)

### R4. `/real/*` 연결대기 스텁 (백엔드 없음 대응)

- [x] R4-1. `realAdapter.fetch*`가 백엔드 부재를 명확히 신호 (에러 또는 빈 결과 + 사유)
- [x] R4-2. `/real/*` 페이지가 기존 `LoadingState`/`ErrorNotice`/`EmptyState`로 "백엔드 연결 대기(Week 2)" 상태를 렌더
- [x] R4-3. `/real`에서 앱이 깨지지 않고(무한로딩·크래시 없이) 안내 상태로 안착하는지 확인

### R5. 랜딩·기본 라우팅

- [x] R5-1. `routes/+page.ts`에서 기본 모드(`/sample`)로 redirect (`throw redirect(307, '/sample')`)
- [x] R5-2. 잘못된 모드(`/foo/pipeline`)는 matcher 미통과 → 404로 처리됨을 확인

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> 스키마/DB 변경 없음(순수 프론트 라우팅) → 마이그레이션 항목 없음. DB 통합테스트 해당 없음.

#### Z-pre. 머지 전 (워크트리에서 실행)

- [x] matcher 단위테스트 — `mode.test.ts` 작성 완료(7 TC) + 정적 심볼 확인 통과. node_modules 부재로 vitest 실행은 Z-post로 강등
  - (Node 정적 게이트: `npm run check`(svelte-check)·`npm run build`는 Z-pre에서 실행하지 않고 **머지 직후 원본 main**에서 실행 — `node_modules` gitignored)
- [x] 정적 검증: `$lib/mock/*` 직접 import grep 0건 확인 (분할 대상 4페이지), match 심볼·redirect·error.svelte 존재 확인

#### Z-post. push 후 (앱 기동 환경에서 실행)

- [ ] Node 정적 게이트 — 원본 main에서 `npm run check`(svelte-check) + `npm run build` 통과 확인
- [ ] e2e 라우트 스모크 통과 확인 (`npx playwright test`, `npm run dev` 기동 전제)
  - [ ] `e2e/route-split.spec.ts` 신규 작성 (미존재 필수) — Playwright 신규 도입 포함
    - `/sample/pipeline`·`/sample/documents`·`/sample/search`·`/sample` 더미 렌더, `/real/*` "연결 대기" 스텁(크래시 없음), 헤더 토글 시 하위경로 유지 프리픽스 스왑, `/` → `/sample` redirect, `/foo/pipeline` → 404
    - teardown: 읽기 전용 네비게이션 — DB·파일 생성 없음 → teardown 불필요 (spec 파일은 repo 상주)

---

## TC (테스트 케이스)

> 대상: `[mode]` matcher·어댑터 주입·라우트 분할 동작. 라우트 행위 검증은 대부분 Z-post e2e로 수행하고, matcher 순수 로직만 vitest 단위로 분리.

### Right-BICEP

- [ ] **Right**: `match('sample')`·`match('real')` → `true`; `/sample/*` 4개 페이지가 더미 데이터로 기존과 동일 렌더 (e2e)
- [ ] **Boundary**: search 어댑터 빈 query(`''`) → `[]` 반환; matcher 빈 문자열·미지정 param → `false`
- [ ] **Inverse**: 모드 토글 왕복 — `/sample/pipeline` → 토글 → `/real/pipeline` → 토글 → `/sample/pipeline` 로 하위경로 보존 복원 (e2e)
- [ ] **Cross-check**: `/sample` 렌더 결과가 R1 이전 직접 import 시점과 동일함을 대조 — 분할 대상 페이지 `<script>`에 `$lib/mock/*` 직접 import 0건(`grep`)로 교차 확인
- [ ] **Error**: `realAdapter.fetch*` throw 시 `/real/*`가 `ErrorNotice`/`EmptyState`("연결 대기(Week 2)")로 안착, 크래시·무한로딩 없음 (e2e); `/foo/pipeline` → 404
- [ ] **Performance**: 해당 없음 (정적 라우팅·소량 픽스처 — 성능 임계 없음)

### CORRECT

- [ ] **C-1 Conformance**: `match(param)`이 정확히 `'sample'|'real'` 토큰만 통과, `'Sample'`·`'reals'`·`''`·`'admin'` 등은 거부 (vitest 단위 — `mode.test.ts`)
- [ ] **Ordering**: stage 표시 순서가 어댑터 경유 후에도 기존 순서 유지 확인 (overview/pipeline)
- [ ] **Range**: 해당 없음 (숫자·날짜·길이 범위 도입 없음)
- [ ] **Reference**: `params.mode === 'real'` → `realAdapter`, `'sample'` → `mockAdapter` 로 올바른 어댑터가 주입되는지 확인 (mock/real 주입 교차)
- [ ] **Existence**: 미지정 하위경로·없는 mode·어댑터 빈 결과(`null`/`[]`)가 안전 처리 — `/real`(빈/에러)에서 `EmptyState` 렌더
- [ ] **Cardinality**: search 결과 0개 → EmptyState, documents 0/1/N개 각각 렌더; 어댑터 빈 배열 처리
- [ ] **Time**: `/real` 진입 시 `subscribePipelineStatus`의 `EventSource(localhost:8000)`가 재연결 폭주/누수 없이 처리(구독 정리 또는 no-op)됨을 확인 (R1-5·R4 결정 반영)

---

## 6. 검증 기준 (완료 게이트)

- [ ] `/sample/pipeline`·`/sample/documents`·`/sample/search`·`/sample`(overview)가 **더미 데이터로 기존과 동일하게** 렌더
- [ ] `/real/*` 동일 경로가 **크래시 없이** "연결 대기" 스텁으로 렌더
- [ ] 페이지 컴포넌트 파일이 **모드당 중복되지 않음**(`[mode]` 단일 파일 확인)
- [ ] 페이지 `<script>`에 `$lib/mock/*` 직접 import가 **남아있지 않음**(분할 대상 페이지 기준) — `grep` 0건
- [ ] 헤더 모드 토글이 현재 하위 경로를 유지한 채 `/sample`↔`/real` 프리픽스만 전환
- [ ] `/` 접속 시 기본 모드로 redirect, 잘못된 모드는 404
- [ ] `npm run build`(및 `svelte-check`) 통과

---

## 7. Week 2 인계

- **`realAdapter` 실물화 지점**: R4 스텁을 실제 ui-backend 호출로 교체하면 `/real/*`가 자동 동작(페이지·라우팅 변경 0).
- **모드 세그먼트 구조**: 향후 `staging` 등 3번째 모드가 필요하면 matcher에 토큰만 추가.
- **`USE_MOCK` 전역 스위치 정리**: 라우트 기반 분할로 대체되므로 `client.ts`의 역할 재정의(또는 제거) 여부를 Week 2에 결정.

---

## 8. 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| R1 리팩터가 실제 작업량(동기→async load 전환) | 분할(R2) 전에 R1만으로 단일 트리 회귀 확인 → 리스크 선격리 |
| 실시간 구독(`subscribePipelineStatus`) 모드별 처리 누락 | R1에서 구독 지점을 명시적으로 어댑터 경유로 정리 |
| `/real` 스텁이 에러로 오인될 소지 | "백엔드 연결 대기(Week 2)" 문구를 `EmptyState`로 명확화(에러 아님) |
| `settings`/`components` 분할 제외의 일관성 혼란 | nav에서 모드 무관 항목으로 분리 표기 |
