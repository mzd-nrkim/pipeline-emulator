# [BUG] 캔버스 topology ↔ 실제 파이프라인 정합 + real 트리거 404 해소

> 상태: 머지완료-통테대기

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

## 실행 시 필수 고려사항

- **회귀 범위**: `STAGE_DAG_MAP` 확장·`node-*` ID 정합은 real 트리거 경로만 활성화 — mock/sample 트리거 경로는 별도 유지(Z-post 회귀로 보장). 레거시 stage ID(`"masking-task"`·`"chunking-task"`)는 삭제하지 않고 병존.
- **환경 전제**: D(real 트리거 실검증)·Z-post e2e는 `docker-compose up`으로 **Airflow 실기동** 전제 → 워크트리 불가, 머지 후 앱 기동 환경(Z-post)에서만 유효. CI Airflow 기동 비용은 real 스모크 1건으로 최소화.
- **실행 순서·동일 파일 편집**: B-1·B-2·B-3은 **모두 `topology.ts` 편집** → 반드시 한 에이전트로 묶는다. C(백엔드 `airflow.py`)는 독립 파일이라 B와 병렬 가능. A(설계 확정)는 B·C의 선행.
- **미선택 결정 근거(A-1)**: "6노드 전개" vs "현구조+`dagId` 부여" 중 **현구조 유지 + 각 transform 노드에 `dagId` 부여**를 채택(변경 최소·다운스트림 영향 0, 접근 방법 §1 권장과 일치). 6노드 전개는 캔버스 레이아웃 대수술이라 이번 스코프 밖.
- **미선택 결정 근거(A-2)**: 노드 ID SSOT는 **`node-*` 규약**으로 단일화하고 백엔드 `STAGE_DAG_MAP`을 `node-*` 키로 확장(프론트가 SSOT). 실제 `dagId` 값은 `dags/` 파일명(`bronze_0_registration` 등)을 **실물 확인 후** 매핑.

## 작업 목록

### A. 캔버스↔DAG 매핑 설계 (SSOT 확정)
- [x] A-1. 6개 DAG ↔ 캔버스 노드 대응표 작성 (path: frontend/src/lib/mock/topology.ts 주석, 앵커: 노드↔dagId 표, 의도: **확정=현구조 유지+각 transform 노드 dagId 부여**, 실제 dagId 값은 dags/ 파일명 실물 확인 후 기입)
- [x] A-2. 노드 ID SSOT 단일화 = **`node-*` 규약** (path: ui-backend/app/services/airflow.py, 앵커: STAGE_DAG_MAP, 의도: 백엔드 맵을 node-* 키로 확장, 레거시 stage ID 호환 유지)

### B. topology.ts 정합 (B-A·B-B)
- [x] B-1. 각 실행 대상 노드에 `dagId` 필드 부여 (path: frontend/src/lib/mock/topology.ts) — 실제 DAG ID 값 사용
- [x] B-2. 노드 라벨·ID를 실제 DAG 이름과 추적 가능하게 정합 (path: frontend/src/lib/mock/topology.ts)
- [x] B-3. 노드↔DAG↔docker서비스 대응 주석 명시 (path: frontend/src/lib/mock/topology.ts 상단)

### C. 백엔드 매핑 정합 (B-C)
- [x] C-1. `STAGE_DAG_MAP`에 캔버스 노드 ID 전부 등록 or 규약 통일 (path: ui-backend/app/services/airflow.py) — 트리거 대상 노드 404 소멸
- [x] C-2. 미매핑 노드 트리거 시 명확한 4xx 메시지(현재는 매핑 부재=404) 유지·문구 개선

### D. real 트리거 실검증
- [ ] D-1. `docker-compose up` 후 `/real/pipeline` 트리거 → `dag_run_id` 반환 확인(수치 근거: HTTP 200 + run id 존재)
- [ ] D-2. Airflow UI에서 해당 DAG run 생성 read-back 확인

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (정적)
- [x] `topology.ts` 노드 스키마 `dagId` 필드 추가가 타입 정의와 정합하는지 정적 확인(grep/구조) — `config: Record<string, unknown>` 확인, dagId 허용
- (Node 정적 게이트: `npm run check`는 Z-pre 제외 → 머지 후 원본 main에서 실행 — node_modules 상주)

#### Z-post. push 후 (앱 기동 환경)
- [x] 머지 직후 원본 main에서 `npm run check`(타입) 통과 — 노드 스키마 `dagId` 반영 (Node 정적 게이트)
- [ ] e2e: **real 경로 스모크 추가**(현재 mock 경로만 존재) — 최소 "트리거 → 200/유효 `dag_run_id`" 단언
  - [ ] real 트리거 스모크 spec 신규 작성 (Airflow 기동 전제)
    - teardown: 스모크가 생성한 Airflow `dag_run` 삭제(REST `DELETE dagRuns`) 또는 일회용 볼륨 `docker compose down -v`
- [x] Z-post. 회귀: mock 경로 e2e 유지, `/sample/pipeline` 트리거 정상 (47/50 pass, 3 skipped 기존)

## Verification (Right-BICEP)
- [ ] **Right**: real 모드 `node-airflow`(및 매핑된 노드) 트리거 → 200 + `dag_run_id`.
- [ ] **B**: 미매핑 노드 트리거 → 명확한 404/422 메시지(무한대기·500 아님).
- [ ] **Cross-check**: 캔버스 각 실행 노드의 `dagId`가 `dags/` 실제 파일명과 일치(수기 대조).
- [ ] **Error**: Airflow 미기동 시 트리거 → UI에 명확한 에러 표시(현 `triggerError` 경로).
- [ ] **CORRECT-Conformance**: `node-*` ID ↔ `STAGE_DAG_MAP` 키 양방향 일치(미매핑 0).
- [ ] **CORRECT-Existence**: 레거시 stage ID(`masking-task`·`chunking-task`) 트리거도 여전히 동작(호환 회귀).
- Time/Ordering: 6-DAG 트리거 순서 계약은 이 버그 범위 밖 → "해당 없음".

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 6-DAG 6-노드 전개 vs 현구조+dagId | ✅ 확정: 현구조+dagId | 변경 최소·다운스트림 영향 0 (접근 §1 권장) |
| 노드 ID SSOT 방향 | ✅ 확정: `node-*` 규약 | 백엔드 STAGE_DAG_MAP을 node-* 로 확장 |
| topology 자동 파생(런타임 DAG 목록 fetch) | 후속 | 이번엔 하드코딩+매핑 명시까지 |
| e2e real 경로 커버리지 범위 | ✅ 확정: real 스모크 1건 | Airflow 기동 전제 CI 비용 최소화 |
