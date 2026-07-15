# [FEAT] 실행 이력 상세화 (성공/실패/시간 → 스테이지별 근거)

> 상태: 통테통과-완료

실행 이력이 **`run.id` · 상태 · 시작시각 · 소요초**만 보여준다. `Run` 타입엔 이미 `config`·`stageCounts`가 있는데 UI가 렌더하지 않고, 데이터는 **mock 3건 하드코딩**이며, "비교" 버튼은 **핸들러가 없어 동작하지 않는다**. medallion 6단계 파이프라인이라면 이력에 보여줄 근거(단계별 in/out, 마스킹 건수, 실패 스테이지, 소요 breakdown)가 충분하다.

> 근거(코드 확인, 2026-07-15):
> - `frontend/src/lib/components/RunHistoryItem.svelte` — 렌더 항목 = id/상태/시작시각/소요초 뿐.
> - `frontend/src/lib/api/types.ts:Run` — `config{masking,search}` · `stageCounts?: Record<string,number>` 이미 존재하나 미표시.
> - `frontend/src/lib/mock/runs.ts` — 하드코딩 3건.
> - `+page.svelte:286-291` — "비교" 버튼에 onclick 없음(무동작).
> - `ui-backend/app/services/airflow.py` — 실제 DAG run에서 상태·start·duration 추출 가능(`_get_dag_run_info`). 스테이지별 카운트 소스는 미연결.

## 결함
- **C-1 표시 빈약**: 있는 필드(`stageCounts`/`config`)도 안 그림.
- **C-2 mock 고정**: real 모드에서도 실제 run 이력 미연결(이력은 mock, 상태 API는 별개).
- **C-3 비교 무동작**: 버튼만 있고 기능 없음.

## 목표
- 이력 항목이 **스테이지별 처리 건수·config·실패 스테이지·소요 breakdown**을 드릴다운으로 제공한다.
- real 모드에서 **실제 DAG run 이력**을 표시한다.
- 두 run **비교**(before/after diff)가 동작한다.

## 접근 방법
1. **표시 확장**: `RunHistoryItem` 확장 + run 상세 패널 — `stageCounts`(단계별 in/out), `config`(masking/search), 실패 시 `failureReason`/실패 스테이지.
2. **real 이력 연결**: `real-adapter.fetchRuns`가 백엔드 실제 DAG run 목록 반환하도록 연결(`get_all_dag_runs` 활용). 스테이지별 카운트 소스(Airflow XCom/로그 or DB 집계) 확정.
3. **비교 기능**: 선택 2개 run의 스테이지 카운트·config diff 렌더. 기존 `selectedRunId`/URL(`?runA=`) 패턴 확장(`?runB=`).

## 실행 시 필수 고려사항

- **회귀 범위**: A(표시 확장)는 `RunHistoryItem`·상세 패널 additive 렌더 — 기존 id/상태/시각/소요 표시를 깨지 않는다. B(real `fetchRuns` 연결)는 real-adapter 경로만 바꾸므로 **mock 모드 이력(`runs.ts`)은 그대로**. C(비교)는 기존 `selectedRunId`/`?runA=` URL 패턴을 확장(`?runB=`)하므로 기존 단일 선택 동작이 회귀하지 않는지 확인.
- **환경 전제**: B의 real DAG run 이력·스테이지 카운트 검증은 **ui-backend + Airflow 기동** 전제 → Z-post. A·C는 mock/UI라 로직상 단위 검증 가능하나 `frontend/node_modules` gitignored → `npm run check`/e2e는 머지 후 원본 main.
- **실행 순서·병렬성**: A(표시 확장) → C(비교) 순 — C의 diff 뷰가 A가 만든 상세 렌더(스테이지 카운트·config)를 재사용한다. A·C는 **둘 다 `+page.svelte`(history 탭) 편집** → 동일 파일이므로 한 에이전트로 묶는다. B(`real-adapter.ts`+`ui-backend/runs.py`)는 다른 파일군이라 A/C와 병렬 가능. A-3(mock `runs.ts` 샘플 확장)은 A-1/A-2 표시 로직 검증의 입력이므로 A 내 선행.
- **미선택 결정 근거(B-2)**: 스테이지별 카운트 소스는 (a) Airflow XCom vs (b) DB 집계 vs (c) 로그 파싱 택1 — **실물(Airflow run에 카운트가 어디 실리는지) 확인 후 결정**. XCom은 태스크가 명시 push해야 존재(DAG 코드 의존), DB 집계는 medallion 단계 테이블 COUNT로 부작용 0·안정적(sample-data-plan gold/staged 테이블 재사용 가능)이나 run↔단계 매핑 필요, 로그 파싱은 취약. DB 집계가 기본 후보.
- **미선택 결정 근거(비교 대상 수)**: 2개 고정 vs N개 — **2개 우선**(`?runA=&runB=`), N개 비교는 후속. C 구현은 2개 전제로 좁혀 URL·상태를 단순화.

### A. 표시 확장 (mock 기반 먼저)

- [x] A-1. run 상세 패널 — `stageCounts` 단계별 in/out 표 (path: frontend/src/lib/components/RunHistoryItem.svelte 확장 또는 신규 상세 패널 컴포넌트, 앵커: 렌더 항목(id/상태/시각/소요) 하단, 의도: 있는 필드 stageCounts 드릴다운 노출)
  - [x] `Run.stageCounts` 존재 시 단계별 in/out 표 렌더, 없으면 "데이터 없음" (path: frontend/src/lib/components/RunHistoryItem.svelte, 앵커: 상세 패널)
- [x] A-2. `config`(masking/search)·실패 스테이지·소요 breakdown 표시 (path: 상세 패널 컴포넌트, 앵커: config·failureReason 렌더, 의도: 실패 근거·설정 노출)
- [x] A-3. mock `runs.ts`에 `stageCounts`·`config`·실패 케이스 채운 현실적 샘플 확장 (path: frontend/src/lib/mock/runs.ts, 앵커: 하드코딩 3건 배열, 의도: A-1/A-2 렌더 검증 입력)

### B. real 이력 연결

- [x] B-1. `real-adapter.fetchRuns` → 백엔드 실제 DAG run 목록 반환 (path: frontend/src/lib/api/real-adapter.ts + ui-backend/app/api/runs.py, 앵커: `fetchRuns`·`get_all_dag_runs`, 의도: real 모드 실 이력 연결)
  - [x] ui-backend runs 라우터가 `get_all_dag_runs`로 상태·start·duration 반환 (path: ui-backend/app/api/runs.py + services/airflow.py, 앵커: `_get_dag_run_info`)
- [x] B-2. 스테이지별 카운트 소스 확정·연결 (XCom vs DB 집계 vs 로그, **실물 확인 후 결정**) (path: ui-backend/app/services, 앵커: 스테이지 카운트 조회 함수, 의도: run↔단계 카운트 매핑)
  - [x] 결정 후 미채택 소스 하위 항목 제거 표기 (§열린 항목 표와 대조)

### C. 비교

- [x] C-1. run 2개 선택 상태·`?runA=&runB=` URL 확장 (path: frontend/src/routes/.../+page.svelte, 앵커: 기존 `selectedRunId`/`?runA=` 처리, 의도: 2개 고정 비교 선택)
- [x] C-2. "비교" 버튼 onclick → diff 뷰(스테이지 카운트·config 차이) 렌더 (path: frontend/src/routes/.../+page.svelte:286-291, 앵커: onclick 없는 "비교" 버튼, 의도: 무동작 버튼 실동작화)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (워크트리/정적)

- [x] ui-backend `runs.py`·`airflow.py` 변경분 `python -m py_compile` 정적 통과
- [x] "비교" 버튼에 onclick 연결됨(무동작 잔존 없음) grep 확인
- (Node 정적 게이트: frontend `npm run check`/`build`는 Z-pre 제외 → 머지 후 원본 main)

#### Z-post. push 후 (앱 기동 환경)

- [x] 머지 직후 원본 main에서 frontend `npm run check` + `npm run build` 통과 (Node 정적 게이트)
- [x] e2e: 이력 항목 클릭 → 상세(스테이지 카운트·config) 표시 + 비교 2건 → diff 뷰 렌더 시나리오
  - [x] `run-history.spec.ts`(또는 기존 e2e에 history 케이스) 신규 작성 — 상세 드릴다운·비교 diff 단언 (미존재 시 필수)
    - teardown: mock/read-only 렌더 — side-effect 없음. real 이력 검증 시 테스트가 트리거한 DAG run 있으면 정리(없으면 불요)

## TC (Right-BICEP · CORRECT)

- [x] **Right (정상)**: 이력 클릭 → 스테이지별 in/out·config 표시. 비교 2건 → diff 렌더.
- [x] **B (경계)**: `stageCounts` 없는 run·0건 run → 크래시 없이 "데이터 없음". 비교 대상 1개만 선택 시 diff 미표시 안내.
- [x] **I (역)**: 비교 A↔B 순서 바꿔도 동일 diff(대칭성).
- [x] **Cross-check**: real 모드 이력이 Airflow UI run 목록과 일치(상태·시각); stageCounts가 소스(DB COUNT/XCom)와 대조 일치.
- [x] **C (에러)**: 백엔드 미기동 시 이력 로드 실패 → 명확한 표시(무한 로딩·크래시 아님).
- **P (성능)**: real `fetchRuns`가 전체 DAG run 전량 로드 시 limit/최근 N건 제한(대량 run 대비). 소규모면 "해당 없음".
- CORRECT-Ordering: 이력 목록 최신순 정렬 계약 유지(시작시각 desc).
- CORRECT-Existence: `config`/`failureReason` 없는 run도 상세 패널이 빈 상태로 안전 렌더.
- CORRECT-Reference: 비교 선택 후 다른 탭 왕복 → `?runA=&runB=` URL 상태 복원(선택 유실 없음).

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 스테이지별 카운트 소스 | plan-review | XCom vs DB 집계 vs 로그 파싱 |
| 비교 대상 수(2개 고정 vs N) | plan-review | 2개 우선 |
