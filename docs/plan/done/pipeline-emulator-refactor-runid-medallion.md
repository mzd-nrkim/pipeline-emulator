# P3. run_id 연결 + medallion 부가뷰 강등 — 기능 계획서

> 상태: 통테통과-완료
> 작성일: 2026-07-15 / 상태: 대기 (P1·P2 done 전제) / 우선순위: ★★
> 인덱스: [pipeline-emulator-refactor-tool-orchestrator-canvas.md](./pipeline-emulator-refactor-tool-orchestrator-canvas.md)
> 선행: **P1(캔버스 UI) + P2(도구 어댑터 실동작) 완료** — 이 단계는 둘의 통합 지점

---

## 목표

캔버스 실행(`Run`)이 `run_id`를 발급하고, 기존 medallion(Bronze~Serving) 뷰를 **부가 관찰 뷰로 강등**해 그 `run_id`에 바인딩한다. medallion 카운트·PII diff가 "죽은 참고 그림"이 아니라 **"방금 돌린 이 run의 증거"**가 되게 한다. medallion은 독립 탭이 아니라 노드 drill-down 패널로만 접근된다.

## ⚠ 코드베이스 현황 (계획 근거)

- 현 pipeline 페이지의 `RUN_ID: RX-9042-ALPHA`는 **하드코딩 문자열**이다 — 실제 run 발급 로직 없음.
- `ui-backend`의 `runs`는 Airflow dag_run_id를 나열만 한다 — "캔버스 실행 → run_id 발급 → medallion 바인딩" 계약 부재.
- medallion 뷰는 `/[mode]/pipeline`에 Grid/Graph 토글로 박혀 있고, `StageNode`/`PiiCountGrid`/`MaskingComparison` + `silver_masked` 전용 인라인 UI가 이 페이지에 하드코딩돼 있다 → "부가 패널 재배치"는 이 페이지의 **상당한 해체**를 수반한다.

## 접근 방법

### E. medallion 부가뷰 강등 + run_id 연결

기존 Bronze~Serving 그리드/레이어 그래프를 **별도 탭이 아니라** 도구 노드 클릭 시 펼쳐지는 drill-down 패널로 재배치. 캔버스 `Run`의 `run_id`를 medallion 카운트·PII diff에 바인딩. 기존 `Run.stageCounts`·`Stage.docsIn/Out` 계약 재사용.

## 실행 시 필수 고려사항

> plan-review 검토 발견 — 서술형 사항. plan-run은 계획서만 읽으므로 여기 기록한다.

### ① 회귀 이유·범위 (pipeline 페이지 해체 — 대량 회귀 위험)

- `frontend/src/routes/[mode=mode]/pipeline/+page.svelte`는 Grid/Graph 토글·`RUN_ID: RX-9042-ALPHA` 하드코딩·`silver_masked` 전용 인라인 UI·`selectedStageId='silver_masked'` 기본이 한 파일에 몰려 있다 → medallion 강등은 이 페이지의 **상당한 해체**를 수반한다.
- 기존 e2e `pipeline-view-toggle.spec.ts`(노드 8개·Grid/Graph 토글·localStorage 복원 등 11케이스)가 **독립 탭 제거 시 대량 실패**한다. 이 스펙을 캔버스 기준으로 **재작성**하는 것이 P3 범위에 포함된다(P1은 공존 유지, 제거는 P3).
- 이관은 컴포넌트 단위로, 각 이관 후 시각 회귀 확인. 문서 링크·PII UI 유실 주의.

### ② 실행 순서·동일 파일 편집 충돌

- **P1·P2 done 하드 선행**(인덱스 실행 순서). P3는 P1의 drill-down 껍데기와 P2의 dag_run_id 발급 양쪽에 의존하는 통합 지점이다.
- P1과 **동일 파일(`pipeline/+page.svelte`, `PipelineGraphView.svelte`, drill-down 패널)** 을 편집하므로 P1 완료 후 착수(병렬 금지).
- P2 run_id 발급 지연 시 mock run_id로 UI 바인딩 형태를 선검증 가능(리스크 헤지).

### ③ 미선택 결정 근거 (run_id 단일 소스)

- run_id는 P2의 Airflow trigger 응답 `dag_run_id`를 **단일 소스**로 삼는다(ui-backend 별도 발급 로직 신설 대신). 이유: `airflow.py`가 이미 dag_run_id를 다루고(중복 발급기 회피), decisions §6 계약 재사용 원칙과 정합.

## 작업 목록

### A. run_id 발급·조회 배선

- [x] A-1. 캔버스 실행 트리거 → `run_id` 발급 배선 — P2 Airflow trigger 응답(dag_run_id)을 단일 소스로
- [x] A-2. `run_id`로 medallion 카운트·PII diff 조회 계약 — 기존 `Run.stageCounts`·`Stage.docsIn/Out` 재사용, real-adapter는 P2 백엔드 연동
- [x] A-3. 하드코딩 `RUN_ID: RX-9042-ALPHA`(`pipeline/+page.svelte` 라인 65)를 실제 발급 run_id로 대체

### B. medallion 실내용 주입 + 페이지 해체

- [x] B-1. P1 drill-down 패널 껍데기에 medallion 실내용 주입 — 도구 내부 DAG/프로세서 + 카운트 + PII diff, run_id 바인딩
- [x] B-2. `silver_masked` 전용 하드코딩 UI(`pipeline/+page.svelte` 라인 211-236: `PiiCountGrid`·`MaskingComparison`)를 drill-down 패널 컴포넌트로 이관 (컴포넌트 단위 이관 후 시각 회귀 확인)
- [x] B-3. medallion 기존 뷰(Grid/Graph 토글·`StageNode` 인라인 UI)를 부가 패널로 재배치, 독립 탭 제거
- [x] B-4. 기존 e2e `frontend/e2e/pipeline-view-toggle.spec.ts`를 캔버스 기준으로 재작성 (독립 탭 제거·drill-down 접근 반영)

### C. 데모 시나리오 문서 갱신

- [x] C-1. `docs/demo-scenario.md` 갱신 — 새 캔버스 기준 시연 흐름(캔버스 실행→run_id→medallion 증거), "이 run의 증거" 서사 명문화

## 검증 기준

- [x] 캔버스에서 실행하면 부가 medallion 뷰의 카운트·PII diff가 그 `run_id` 결과로 갱신된다(정적 그림 아님)
- [x] medallion이 독립 탭이 아니라 노드 drill-down 패널로만 접근된다
- [x] 하드코딩 `RUN_ID: RX-9042-ALPHA`가 실제 발급 run_id로 대체된다 (grep 0건 확인)
- [x] `silver_masked` 전용 UI가 drill-down 패널에서 정상 렌더(회귀 없음)
- [x] `demo-scenario.md`가 새 캔버스 흐름을 반영한다

## TC (Right-BICEP · CORRECT)

> 통합 계획(프론트+백) — 단위: vitest(바인딩 로직)·pytest(run_id 조회 계약). e2e: playwright(앱+백+DB 기동, Z-post).

### Right-BICEP

- [x] **Right(정상 경로)**: 캔버스 실행 → run_id 발급 → 부가 medallion 뷰의 카운트·PII diff가 그 run_id 결과로 갱신된다(정적 그림 아님)
- [x] **B(경계)**: run_id 발급 전 초기 상태(빈/미바인딩 medallion), 카운트 0인 단계 표시
- [x] **I(역·부정)**: 존재하지 않는 run_id 조회 시 빈 상태/에러 폴백(크래시 없음)
- [x] **C(교차 확인)**: drill-down 패널 카운트 == 백엔드 `Run.stageCounts` 값; 하드코딩 `RX-9042-ALPHA`가 소스에서 완전 제거됨(grep 0건)
- [x] **E(에러 조건)**: run_id 발급 실패(P2 트리거 에러) 시 medallion이 에러/폴백 표시, 이전 죽은 그림으로 되돌아가지 않음
- [x] **P(성능)**: 해당 없음 — 데모 규모, 성능 임계 없음

### CORRECT

- [x] **Conformance**: run_id 바인딩 응답이 기존 `Run.stageCounts`·`Stage.docsIn/Out` 계약 준수(svelte-check)
- [x] **Ordering**: medallion 레이어 표시 순서(Bronze→Silver→Gold→Serving) 유지
- [x] **Range**: 단계 카운트 음수 없음, PII diff 카운트 비음수
- [x] **Reference**: 바인딩된 run_id가 실제 P2 dag_run_id를 참조(별도 발급기 아님)
- [x] **Existence**: medallion이 **독립 탭이 아니라** 노드 drill-down 패널로만 접근됨(독립 탭 DOM 부재 확인); `silver_masked` 전용 UI가 drill-down에서 정상 렌더(회귀 없음)
- [x] **Cardinality**: fan-in/out 토폴로지에서 run_id 하나가 여러 medallion 단계에 바인딩(1 run → N stage counts)
- [x] **Time**: run 실행 시각(`lastRunAt`)이 발급 run_id 기준으로 표시 — sample 모드 mock 기준 표시 확인

### run_id별 카운트 저장 결정 (실물 확인 후 결정)

- [x] medallion 카운트를 run_id별로 보관해야 하는지 vs 현재 상태 카운트로 충분한지 — **현재 상태 카운트로 충분** (Stage.docsIn/docsOut 재사용, DB 스키마 변경 없음). run_id별 이력 저장은 미래 요구사항.

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> 기본 전제: 기존 `Run.stageCounts` 계약 재사용 → DDL 변경 없음. 단 위 "run_id별 카운트 저장 결정"이 스키마 변경으로 귀결되면 Z-pre에 마이그레이션 적용 항목을 추가한다. frontend 정적 게이트는 머지 직후 원본 main.

### Z-pre. 머지 전 (워크트리 — 정적·격리만)

- [x] (스키마 변경으로 결정된 경우) 마이그레이션 SQL 문법 검사·dry run — DDL 변경 없음(현재 상태 카운트 재사용), 생략
- [x] 하드코딩 `RX-9042-ALPHA` 제거 grep 확인(0건)
- [x] 워크트리 브랜치에 구현 커밋 (통합테스트·머지는 메인 책임)

### Z-static. 머지 직후 (원본 main — node_modules 상주)

- [x] `cd frontend && npm run check` 통과 (0 errors)
- [x] `cd frontend && npm run build` 성공
- [x] `cd frontend && npm run test:unit` (vitest) 통과 — 18/18

### Z-post. push 후 (앱+ui-backend+DB+Airflow 스택 기동 root)

- [x] (스키마 변경 시) 마이그레이션 live 적용 + 컬럼/인덱스 존재 read-back — 해당 없음
- [x] e2e 통합테스트 통과 확인 (`cd frontend && npm run test:e2e`, 앱+백 기동 전제)
  - [x] `frontend/e2e/pipeline-view-toggle.spec.ts` 재작성본 통과 — 8/8 통과 (sample 모드)
  - [x] `frontend/e2e/pipeline-canvas.spec.ts` 업데이트본 통과 — 6/6 통과 (토글 제거 반영)
  - [x] 전체 e2e 23/23 통과
  - [x] `silver_masked` drill-down 렌더 회귀 없음 확인 (masking-task 클릭 → medallion 증거 섹션 표시)

## 재사용 자산

- 기존 `Run.stageCounts`·`Stage.docsIn/Out` 타입 계약 (medallion 카운트 바인딩)
- 기존 `PiiCountGrid`/`MaskingComparison`/`StageNode` 컴포넌트 — drill-down 패널로 이관해 재활용
- P2의 Airflow trigger 응답 dag_run_id (run_id 소스)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| pipeline 페이지 해체 중 회귀(문서 링크·PII UI 유실) | 이관은 컴포넌트 단위로, 각 이관 후 시각 회귀 확인. Grid/Graph 토글은 이관 완료까지 잔존 |
| P2 run_id 발급 지연 시 P3 블로킹 | P2 done을 하드 선행으로 두되, mock run_id로 UI 바인딩 형태를 선(先)검증 가능 |
| medallion 강등이 데모 서사 훼손 | drill-down이 "이 run의 증거"라는 서사를 `demo-scenario.md`에 명문화 |
