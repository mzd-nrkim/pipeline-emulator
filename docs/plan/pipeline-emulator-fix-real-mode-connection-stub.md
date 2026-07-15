# `/real/*` 백엔드 연결 대기 stub 구현

> 상태: 통테통과-완료
> 작성일: 2026-07-15

`route-split` e2e에서 2건(`route-split.spec.ts:25,30`)이 항상 실패한다. `/real` 및 `/real/pipeline` 접속 시 `+error.svelte`의 "백엔드 연결 대기" 화면이 표시되어야 하는데, SvelteKit CSR 모드에서 `load()` 내 raw `throw`가 error boundary(`+error.svelte`)로 전파되지 않는 것이 원인이다. `+page.ts`에 TODO 주석으로 이미 원인과 수정 방향이 기록되어 있다.

---

## 목표

- `route-split.spec.ts:25` (`/real` → `'백엔드 연결 대기'` 가시) 통과
- `route-split.spec.ts:30` (`/real/pipeline` → `'백엔드 연결 대기'` 가시) 통과
- e2e 전체 28/28 통과 달성 (현재 26/28)
- 미래 호환: 백엔드가 실제로 연결될 때 `/real/*`가 정상 동작할 수 있는 구조 유지

## 접근 방법

**선택: `+layout.ts` 단일 진입점에서 real 모드 헬스 체크 후 `error()` 호출**

1. `[mode=mode]/+layout.ts`를 async 함수로 전환하고, `params.mode === 'real'`이면 real-adapter의 fetch를 시범 호출(또는 별도 헬스 엔드포인트)한다.
2. fetch 실패 시 `@sveltejs/kit`의 `error(503, '백엔드 연결 대기')`로 re-throw — SvelteKit이 이를 error boundary로 라우팅해 `+error.svelte`가 렌더된다.
3. 이 방식은 `/real/*` 모든 하위 경로에 일괄 적용되므로, 각 `+page.ts`를 개별 수정할 필요가 없다(단일 진입점).
4. `+page.ts`의 TODO 주석 제거(A-1로 해소됨을 명시).

> 대안(각 `+page.ts`에서 try-catch + `error()`)은 파일이 늘어날 때 누락 위험이 있어 미채택.

## 실행 시 필수 고려사항

### ① 성공 케이스에서 중복 fetch
layout.ts에서 헬스 체크로 `realAdapter.fetchStages()` 1회 + `/real/pipeline` 등 하위 `+page.ts`에서 `fetchStages()` 1회 추가 → 백엔드 가동 시 총 2회. 현재 stub 목적(항상 실패 → page.ts 미실행)에서는 문제 없음. 미래 호환 목표 달성 시 layout에서 fetch 결과를 캐시하거나 별도 헬스 엔드포인트를 사용하는 리팩터링 필요.

### ② fetch AbortController 없음 (네트워크 timeout 의존)
`real-adapter.ts`의 `fetchStages()`에 `AbortController`가 없어 timeout은 OS/브라우저 기본값에 위임됨. 로컬 `localhost:8001`에서는 TCP connection refused가 즉시 반환되나, 방화벽이 있거나 원격 URL인 경우 대기 시간이 길어질 수 있음. 현재 e2e는 로컬 환경 기준이므로 크리티컬하지 않음.

## 작업 목록

### A. `+layout.ts` 헬스 체크 + error() 전파

- [x] A-1. `[mode=mode]/+layout.ts` 수정
  - [x] `error` import 추가 (path: `frontend/src/routes/[mode=mode]/+layout.ts`, 앵커: 파일 상단 import 블록, 의도: SvelteKit `error()` 함수 import)
  - [x] `load()` → `async load()` 전환 (path: `frontend/src/routes/[mode=mode]/+layout.ts`, 앵커: `export function load` 선언부, 의도: await 사용 가능하게 async 전환)
  - [x] `params.mode === 'real'`이면 `realAdapter.fetchStages()` try 호출 (path: `frontend/src/routes/[mode=mode]/+layout.ts`, 앵커: `load()` body — `const adapter = ...` 결정 후, 의도: real 모드 backend 연결 여부 사전 확인)
  - [x] 실패(`catch`) 시 `throw error(503, '백엔드 연결 대기')` (path: `frontend/src/routes/[mode=mode]/+layout.ts`, 앵커: fetchStages() catch 블록, 의도: SvelteKit error boundary → `+error.svelte` 렌더 전파)
  - [x] 성공 시 `{ adapter }` 반환 유지 (path: `frontend/src/routes/[mode=mode]/+layout.ts`, 앵커: `load()` return 문, 의도: sample 모드 및 real 성공 케이스 기존 동작 보존)

- [x] A-2. `[mode=mode]/+page.ts` TODO 주석 제거 (path: `frontend/src/routes/[mode=mode]/+page.ts`, 앵커: 파일 상단 1–3번째 줄 TODO 블록, 의도: A-1 구현으로 layout.ts에서 처리되므로 TODO 불필요)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> 스키마 변경 없음(SvelteKit load 로직만) → 마이그레이션 항목 없음.

#### Z-pre. 머지 전 (워크트리에서 실행)

- 스키마 변경 없음 → 마이그레이션 항목 없음.
- 격리 단위테스트 없음 (SvelteKit load 로직 — 브라우저 런타임 의존) → 단위테스트 항목 없음.
- `npm run check` / `npm run build`는 node_modules gitignored → 아래 Node 정적 게이트(머지 직후)에서 실행.

#### Node 정적 게이트 (머지 직후 원본 main)

- [x] `cd frontend && npm run check` (svelte-check 타입 에러 0)
- [x] `cd frontend && npm run build` 성공

#### Z-post. 머지 후 (앱 기동 환경)

- [x] `cd frontend && npm run test:e2e` — 28/28 통과
  - [x] `route-split.spec.ts:25` (`/real` → `백엔드 연결 대기` 가시) 통과 확인
  - [x] `route-split.spec.ts:30` (`/real/pipeline` → `백엔드 연결 대기` 가시) 통과 확인

## Verification

### Right (정상 결과)

- [x] `/real` 접속 시 `'백엔드 연결 대기'` 텍스트와 "샘플 모드로 이동" 링크가 보인다.
- [x] `/real/pipeline` 접속 시 동일 화면이 렌더된다.
- [x] `/sample/pipeline` 접속 시 기존과 동일하게 DAG 캔버스가 정상 렌더된다(회귀 없음).

### B — Boundary

- [x] `PUBLIC_UI_BACKEND_URL`이 설정되지 않은 상태(기본 `http://localhost:8001`)에서 `503` error boundary 노출.
- [x] `/sample/*` 경로는 A-1 변경의 영향을 받지 않는다(mockAdapter 경로 불변).

### I — Inverse

백엔드가 실제 가동 중일 때(`http://localhost:8001` 응답 정상) `/real`이 에러 없이 정상 페이지를 렌더하는지 — 백엔드 미구현 상태이므로 현재 자동화 불가(해당 없음).

### C — Cross-check

e2e(`route-split.spec.ts`)에서 텍스트 가시성 확인이 SvelteKit error boundary 경로를 교차 검증함 — 별도 C 케이스 해당 없음.

### E — Error

- [x] 헬스 체크 fetch가 즉시 실패해 e2e 수행 시간이 크게 늘지 않는다(Playwright default 30s timeout 이내).
  - localhost:8001 TCP connection refused → 즉시 실패 예상. 네트워크 환경 의존(고려사항 ② 참조).

### 회귀

- [x] 기존 통과 26건(sample 라우트·드로어 레이아웃·view toggle)이 28건 통과 후에도 그대로 통과.

### CORRECT 체크

- C(Conformance): `error(503, '백엔드 연결 대기')` 호출 → `page.error.message`가 `+error.svelte` 내 `{page.error?.message}` 표현식에 정확히 전달됨 — Right TC에 포함.
- O(Ordering): 해당 없음 (순서 의존 없음).
- R(Range): 해당 없음 — `params.mode`는 SvelteKit 매처(`[mode=mode]`)로 이미 제한됨.
- R(Reference): 해당 없음 — error boundary(`+error.svelte`)는 SvelteKit이 자동 라우팅.
- E(Existence): 해당 없음 — null/undefined 에러는 SvelteKit이 처리.
- C(Cardinality): 해당 없음.
- T(Time): E-type에서 커버.

## 참고 파일

- 수정 대상: `frontend/src/routes/[mode=mode]/+layout.ts`
- 수정 대상: `frontend/src/routes/[mode=mode]/+page.ts` (TODO 주석 제거)
- error boundary: `frontend/src/routes/[mode=mode]/+error.svelte`
- real adapter: `frontend/src/lib/api/real-adapter.ts`
- e2e 테스트: `frontend/e2e/route-split.spec.ts` (25·30번째 줄)
- 관련 계획: `done/frontend-route-split-sample-vs-real-plan.md` (route-split 원본, 통테통과-완료)
