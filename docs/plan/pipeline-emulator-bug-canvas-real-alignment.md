# [BUG] 캔버스 topology ↔ 실제 파이프라인 정합 + real 트리거 404 해소

> 상태: 초안

캔버스 topology(`mockTopology`)가 실제 시스템(`dags/` 6개 DAG · `docker-compose` 서비스)에서 **유도되지 않고 하드코딩**돼 있고, 노드 ID·구조·이름이 실제와 불일치한다. 그 결과 **real 모드 트리거가 404로 실패**한다. 서로 얽힌 3개 결함(손그림 / 이름·구조 불일치 / 404)을 근본 원인(캔버스가 현실과 단절) 관점에서 함께 해소한다.

> 근거(코드 확인, 2026-07-15):
> - `frontend/src/lib/mock/topology.ts` — 노드 13개 하드코딩. 노드 ID: `node-debezium/nifi/dam/s3-bronze/airflow/presidio/docling/kure/valkey/es/kibana/mysql/mysql-container`.
> - `dags/` 실제 DAG 6개: `bronze_0_registration · silver_1_structuring · silver_2_masking · gold_3_chunking · gold_4_enrichment · gold_5_field_mapping`.
> - `ui-backend/app/services/airflow.py:STAGE_DAG_MAP` — 캔버스 노드 키가 `"masking-task" · "chunking-task"` **둘뿐**. `node-airflow` 없음.
> - `frontend/src/lib/api/real-adapter.ts:41` — real 모드도 `mockTopology` 반환. `triggerNode`는 `POST /nodes/{nodeId}/trigger`.
> - 결과: `node-airflow` 트리거 → `STAGE_DAG_MAP.get("node-airflow")` = None → **HTTP 404**.

---

## 결함 분해 (독립 3건)

| ID | 결함 | 근본 원인 | 증상 |
|----|------|-----------|------|
| **B-A** | 손그림 topology | 캔버스가 실제 시스템에서 유도 안 됨 | 실제가 바뀌어도 캔버스 불변 |
| **B-B** | 이름·구조 불일치 | 노드가 실제 DAG 이름/단계와 무관하게 명명 | `airflow` 단일 노드 vs 실제 6개 stage DAG |
| **B-C** | real 트리거 404 | 노드 ID ↔ `STAGE_DAG_MAP` 계약 불일치 | real 모드 실행 불가 |

> B-A와 B-B는 별개다: 손그림이어도 실제 이름을 썼다면 B-C는 안 났을 것. 셋을 한 번에 정합한다.

## 목표

- real 모드에서 캔버스 노드 트리거가 **실제 DAG를 기동**하고 `dag_run_id`를 반환한다(404 소멸).
- 캔버스 노드 ID·라벨·구조가 **실제 `dags/` DAG와 1:1 추적 가능**해진다(이름·구조 정합).
- topology가 하드코딩 상수여도 **실제 DAG 목록을 SSOT로 파생**되도록 매핑 계층을 명시화한다(손그림→근거 있는 그림).

## 접근 방법

1. **캔버스↔DAG 매핑 SSOT 확정**: 실제 6개 DAG를 캔버스의 어느 노드에 대응시킬지 결정.
   - medallion 6단계를 **6개 노드로 펼칠지**(구조 정합 우선), 현 노드 집합을 유지하되 **각 노드에 `dagId` 부여**할지(변경 최소) 택1 — plan-review에서 확정.
   - `airflow` 단일 노드가 6개 DAG 전체를 표현하는 현 구조는 B-B의 핵심 → **오케스트레이터(airflow)는 trigger 노드로 두되, 실제 실행 대상 stage DAG는 각 transform 노드에 `dagId` 매핑** 권장.
2. **노드 ID 규약 정합**: `node-*` ID를 백엔드 `STAGE_DAG_MAP` 키와 일치시키거나, 백엔드 매핑을 `node-*` 규약으로 확장(양방향 중 SSOT 하나 선택). 레거시 stage ID 호환은 유지.
3. **real 트리거 경로 실검증**: `docker-compose up` 후 `/real/pipeline`에서 트리거 → Airflow REST 실제 기동 → `dag_run_id` 반환 확인.
4. **topology 파생 근거 문서화**: `topology.ts` 주석에 "각 노드 ↔ DAG ID ↔ docker 서비스" 대응표를 명시(추후 자동 파생 시 기준).

## 작업 목록

### A. 캔버스↔DAG 매핑 설계 (SSOT 확정)
- [ ] A-1. 6개 DAG ↔ 캔버스 노드 대응표 확정 (path: docs/plan, 산출물: 대응표) — 6노드 전개 vs 현구조+dagId 부여 택1
- [ ] A-2. 노드 ID 규약 정합 방향 확정 (`node-*` ↔ `STAGE_DAG_MAP` 키 SSOT 단일화)

### B. topology.ts 정합 (B-A·B-B)
- [ ] B-1. 각 실행 대상 노드에 `dagId` 필드 부여 (path: frontend/src/lib/mock/topology.ts) — 실제 DAG ID 값 사용
- [ ] B-2. 노드 라벨·ID를 실제 DAG 이름과 추적 가능하게 정합 (path: frontend/src/lib/mock/topology.ts)
- [ ] B-3. 노드↔DAG↔docker서비스 대응 주석 명시 (path: frontend/src/lib/mock/topology.ts 상단)

### C. 백엔드 매핑 정합 (B-C)
- [ ] C-1. `STAGE_DAG_MAP`에 캔버스 노드 ID 전부 등록 or 규약 통일 (path: ui-backend/app/services/airflow.py) — 트리거 대상 노드 404 소멸
- [ ] C-2. 미매핑 노드 트리거 시 명확한 4xx 메시지(현재는 매핑 부재=404) 유지·문구 개선

### D. real 트리거 실검증
- [ ] D-1. `docker-compose up` 후 `/real/pipeline` 트리거 → `dag_run_id` 반환 확인(수치 근거: HTTP 200 + run id 존재)
- [ ] D-2. Airflow UI에서 해당 DAG run 생성 read-back 확인

### Z. 게이트
- [ ] Z-pre. `npm run check`(타입) 통과 — 노드 스키마에 `dagId` 추가 반영
- [ ] Z-post. e2e: **real 경로 스모크 추가**(현재 mock 경로만 존재) — 최소 "트리거 → 200/유효 run id" 단언
- [ ] Z-post. 회귀: mock 경로 e2e 유지, `/sample/pipeline` 트리거 정상

## Verification (Right-BICEP)
- [ ] **Right**: real 모드 `node-airflow`(및 매핑된 노드) 트리거 → 200 + `dag_run_id`.
- [ ] **B**: 미매핑 노드 트리거 → 명확한 404/422 메시지(무한대기·500 아님).
- [ ] **Cross-check**: 캔버스 각 실행 노드의 `dagId`가 `dags/` 실제 파일명과 일치(수기 대조).
- [ ] **Error**: Airflow 미기동 시 트리거 → UI에 명확한 에러 표시(현 `triggerError` 경로).

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 6-DAG 6-노드 전개 vs 현구조+dagId | plan-review 확정 | 구조정합 vs 변경최소 트레이드오프 |
| topology 자동 파생(런타임 DAG 목록 fetch) | 후속 | 이번엔 하드코딩+매핑 명시까지 |
| e2e real 경로 커버리지 범위 | plan-review | Airflow 기동 전제 CI 비용 |
