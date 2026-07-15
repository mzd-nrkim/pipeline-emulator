# `/real/*` 백엔드 연결 대기 stub 구현

> 상태: 미시작
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

## 작업 목록

### A. `+layout.ts` 헬스 체크 + error() 전파

- [ ] A-1. `[mode=mode]/+layout.ts` 수정
  - `error` import from `@sveltejs/kit`
  - `load()` → `async load()`
  - `params.mode === 'real'`이면 `realAdapter.fetchStages()` 시범 호출
  - 실패(`catch`) 시 `throw error(503, '백엔드 연결 대기')` 호출
  - 성공 시 기존과 동일하게 `{ adapter }` 반환
  - (path: `frontend/src/routes/[mode=mode]/+layout.ts`)

- [ ] A-2. `[mode=mode]/+page.ts` TODO 주석 제거
  - A-1로 해소됨 명시 (path: `frontend/src/routes/[mode=mode]/+page.ts`)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> 스키마 변경 없음(SvelteKit load 로직만) → 마이그레이션 항목 없음.

#### Z-pre. 머지 전 (정적)

- [ ] `svelte-check` 타입 에러 0 (`cd frontend && npm run check`)
- [ ] `npm run build` 성공

#### Z-post. 머지 후 (앱 기동 환경)

- [ ] `cd frontend && npm run test:e2e` — 28/28 통과
  - `route-split.spec.ts:25` (`/real` → `백엔드 연결 대기` 가시) 통과 확인
  - `route-split.spec.ts:30` (`/real/pipeline` → `백엔드 연결 대기` 가시) 통과 확인

## Verification

### Right (정상 결과)

- [ ] `/real` 접속 시 `'백엔드 연결 대기'` 텍스트와 "샘플 모드로 이동" 링크가 보인다.
- [ ] `/real/pipeline` 접속 시 동일 화면이 렌더된다.
- [ ] `/sample/pipeline` 접속 시 기존과 동일하게 DAG 캔버스가 정상 렌더된다(회귀 없음).

### B — Boundary

- [ ] `PUBLIC_UI_BACKEND_URL`이 설정되지 않은 상태(기본 `http://localhost:8001`)에서 `503` error boundary 노출.
- [ ] `/sample/*` 경로는 A-1 변경의 영향을 받지 않는다(mockAdapter 경로 불변).

### E — Error

- [ ] 헬스 체크 fetch가 timeout 없이 즉시 실패해 e2e 수행 시간이 크게 늘지 않는다(Playwright default 30s timeout 이내).

### 회귀

- [ ] 기존 통과 26건(sample 라우트·드로어 레이아웃·view toggle)이 28건 통과 후에도 그대로 통과.

## 참고 파일

- 수정 대상: `frontend/src/routes/[mode=mode]/+layout.ts`
- 수정 대상: `frontend/src/routes/[mode=mode]/+page.ts` (TODO 주석 제거)
- error boundary: `frontend/src/routes/[mode=mode]/+error.svelte`
- real adapter: `frontend/src/lib/api/real-adapter.ts`
- e2e 테스트: `frontend/e2e/route-split.spec.ts` (25·30번째 줄)
- 관련 계획: `done/frontend-route-split-sample-vs-real-plan.md` (route-split 원본, 통테통과-완료)
