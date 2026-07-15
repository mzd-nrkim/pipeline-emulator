# [FEAT] 실행 이력 상세화 (성공/실패/시간 → 스테이지별 근거)

> 상태: 초안

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

## 작업 목록

### A. 표시 확장 (mock 기반 먼저)
- [ ] A-1. run 상세 패널 — `stageCounts` 단계별 in/out 표 (path: 신규 컴포넌트 or +page.svelte history 탭)
- [ ] A-2. `config`(masking/search)·실패 스테이지·소요 breakdown 표시
- [ ] A-3. mock `runs.ts`에 `stageCounts` 채운 현실적 샘플 확장

### B. real 이력 연결
- [ ] B-1. `real-adapter.fetchRuns` → 백엔드 실제 DAG run 반환 (path: real-adapter.ts + ui-backend runs.py)
- [ ] B-2. 스테이지별 카운트 소스 확정·연결(XCom/DB 집계 중 택1)

### C. 비교
- [ ] C-1. run 2개 선택 상태·`?runA=&runB=` URL (path: +page.svelte)
- [ ] C-2. "비교" 버튼 onclick → diff 뷰(스테이지 카운트·config 차이) (path: +page.svelte:286-291)

### Z. 게이트
- [ ] Z-pre. `npm run check` 통과
- [ ] Z-post. e2e: 이력 항목 상세 표시·비교 뷰 렌더 시나리오

## Verification (Right-BICEP)
- [ ] **Right**: 이력 클릭 → 스테이지별 in/out·config 표시. 비교 2건 → diff 렌더.
- [ ] **B**: `stageCounts` 없는 run·0건 run → 크래시 없이 "데이터 없음".
- [ ] **Inverse**: 비교 A↔B 순서 바꿔도 동일 diff.
- [ ] **Cross-check**: real 모드 이력이 Airflow UI run 목록과 일치(상태·시각).
- [ ] **Error**: 백엔드 미기동 시 이력 로드 실패 → 명확한 표시.

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 스테이지별 카운트 소스 | plan-review | XCom vs DB 집계 vs 로그 파싱 |
| 비교 대상 수(2개 고정 vs N) | plan-review | 2개 우선 |
