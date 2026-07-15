# P2. 도구 어댑터 실동작 — 기능 계획서

> 상태: 통테통과-완료
> 작성일: 2026-07-15 / 상태: 대기 (A 스코프 확정 + 로컬 Airflow 스택 전제) / 우선순위: ★★
> 인덱스: [pipeline-emulator-refactor-tool-orchestrator-canvas.md](./pipeline-emulator-refactor-tool-orchestrator-canvas.md)
> 선행: **A/B 스코프 게이트 A로 확정** · P1(캔버스 UI) 노드 계약 존재

---

## 목표

캔버스의 도구 노드에서 config·트리거·조건을 조작하면 로컬 스택이 **실제로 움직인다(시늉 아님)**. Airflow 노드를 우선 실동작시키고, 로컬에 대체 구현이 없는 노드(NiFi→Python, Debezium→배치, ES→미구현)는 **상태 표시 + 계약만 선점**한다.

## ⚠ 코드베이스 현황 — 신규 구현 필요 (계획 근거)

현재 `ui-backend/app/services/airflow.py`는 **100% 읽기 전용**이다(`GET /dags/*/dagRuns`만). 따라서 아래는 "확장"이 아니라 **신규 구현**이다:

- **DAG 트리거**: `POST /api/v1/dags/{dag_id}/dagRuns` (conf 포함) — 현재 없음
- **Variables 설정**(masking on/off 등): `GET/PATCH /api/v1/variables/{key}` — 현재 없음
- **pause/unpause**: `PATCH /api/v1/dags/{dag_id}` (`is_paused`) — 현재 없음
- **ui-backend 라우트**: 노드→도구 API 매핑 엔드포인트(`POST /nodes/{id}/trigger` 등) — 현재 `stages`/`runs`/`sse`/`config`만 존재

## 접근 방법

### B. 노드 = 도구 어댑터 (API 감싸기)

| 도구 노드 | 감싸는 API | 조작(A 범위) | 로컬 실동작 |
|-----------|-----------|--------------|:-----------:|
| Airflow | Airflow REST (`/dags/*/dagRuns`, Variables, is_paused) | DAG 트리거·변수 설정·pause | ✅ 실호출 |
| NiFi | NiFi REST (프로세서 그룹) | start/stop·프로퍼티 조회 | ⚠ mock 반응 or Python 스크립트 트리거 |
| Debezium | Kafka Connect REST | 커넥터 상태 조회 | ⚠ 배치 수집 → 상태 표시 위주 |
| Elasticsearch | ES REST (인덱스/검색) | 인덱스·검색 설정 | ⚠ F1 도입 전까지 상태 표시 |

> 감싸는 대상이 로컬에 없는 노드는 **상태 표시 + 계약만 선점**하고, 실동작은 해당 기능 축(F2/F3/F7) 도입 시 연결한다. decisions §6의 "계약층 고정·구현층 교체" 원칙과 정합.

## 실행 시 필수 고려사항

> plan-review 검토 발견 — 서술형 사항. plan-run은 계획서만 읽으므로 여기 기록한다.

### ① 회귀 이유·범위 (신규 구현 — 기존 읽기 전용 유지)

- `ui-backend/app/services/airflow.py`는 현재 **읽기 전용**(`_get_dag_run_info`/`get_dag_runs`/`get_all_dag_runs`)이다. 쓰기 함수는 **신규 추가**이므로 기존 읽기 경로(`stages`/`runs` API)를 깨지 않아야 한다 — 신규 함수는 기존 인증(`AIRFLOW_USER`/`AIRFLOW_PASS`)·베이스 URL(`AIRFLOW_BASE_URL`)·에러 처리 패턴을 재사용한다.
- ui-backend 신규 라우트(`nodes`)는 `app/main.py`의 `include_router` 패턴(stages/runs/sse/config)을 그대로 따른다 — 기존 라우트 prefix와 충돌 없이 추가.

### ② 테스트 하네스·환경 전제 (worktree 격리 불가)

- Airflow 실호출·Variables read-back·DAG 트리거 검증은 **로컬 Airflow 스택(`docker-compose.yml`) 기동 전제**다 → 워크트리(gitignored·포트·live 스택 없음)에서 검증 불가 → **Z-post(root main, 스택 기동)** 에서 수행. 워크트리에선 Pydantic 스키마·`py_compile`·함수 시그니처 등 **정적·격리 단위테스트만**.
- **ui-backend에 pytest 테스트가 현재 없다** — 신규 쓰기 함수/라우트 단위테스트는 pytest 하네스를 새로 도입하거나(권장) `httpx` mock 기반 격리 테스트로 작성한다. Airflow REST는 mock/monkeypatch로 격리(실 스택 호출은 Z-post).

### ③ 미선택 결정 근거 (mock 노드 실동작 보류)

- NiFi/Debezium/ES는 로컬에 감쌀 대상이 없어(NiFi→Python, Debezium→배치, ES→미구현) **상태 표시 + 계약 선점**만 한다. 실동작은 F2/F3/F7 축 도입 시 연결(decisions §6 "계약층 고정·구현층 교체"와 정합). 이번 P2에서 실동작시키지 않는 것은 스코프 초과 회피가 근거다.
- **선행 게이트 A/B 미확정 시 착수 금지**(인덱스 선행 게이트) — B로 확정되면 이 계획 전체 재구성.

## 작업 목록

### A. airflow.py 쓰기 함수 신설

- [x] A-1. `ui-backend/app/services/airflow.py`에 쓰기 함수 추가 (기존 인증·베이스URL·에러 패턴 재사용)
  - [x] `trigger_dag(dag_id, conf)` — `POST /api/v1/dags/{dag_id}/dagRuns` (conf 포함), dag_run_id 반환
  - [x] `set_variable(key, value)` — upsert (PATCH→404 시 POST) `/api/v1/variables/{key}`
  - [x] `set_paused(dag_id, is_paused)` — `PATCH /api/v1/dags/{dag_id}` (`is_paused`)

### B. ui-backend nodes 라우트 신설

- [x] B-1. 노드→도구 API 매핑 라우트 작성
  - [x] `ui-backend/app/api/nodes.py` 신규 — `POST /nodes/{node_id}/trigger`, `POST /nodes/{node_id}/config`
  - [x] Pydantic 요청 스키마 고정 (trigger conf·config 페이로드) — P1 `ToolNode.config` 계약을 단일 소스로
  - [x] `ui-backend/app/main.py`에 `nodes.router` include (prefix `/nodes`, 기존 패턴)
  - [x] node_id → dag_id 매핑 정의 (기존 `STAGE_DAG_MAP` 참조·재사용 + 캔버스 노드 ID 추가)

### C. real-adapter 조작 함수 (P1 mock 계약 정합)

- [x] C-1. `frontend/src/lib/api/real-adapter.ts`에 도구 노드 조작 함수 추가
  - [x] `triggerNode(nodeId, conf)` — `POST ${BASE}/nodes/{nodeId}/trigger`
  - [x] `setNodeConfig(nodeId, config)` — `POST ${BASE}/nodes/{nodeId}/config`
  - [x] `frontend/src/lib/api/mock-adapter.ts`에 동일 시그니처 mock 함수 추가 (어댑터 스왑 정합)

### D. mock 대상 노드 상태 표시 + 캔버스 조작 배선

- [x] D-1. mock 대상 노드(NiFi/Debezium/ES) 상태 표시 계약 정의 — 실동작 없이 상태·"상태 조회 전용 · 실동작은 F2/F3/F7" 배지 렌더
- [x] D-2. 캔버스 노드 UI에 조작 컨트롤 배선 — Airflow 노드는 실호출(트리거·변수·pause), mock 노드는 상태 표시

## 검증 기준

- [x] Airflow 노드에서 트리거 시 **실제 Airflow REST 호출이 나가고**(ui-backend 로그로 확인) DAG 실행이 발생한다 — 2건 dag_run 생성 확인
- [x] Airflow 노드에서 변수(masking on/off) 설정 시 Airflow Variables가 실제 변경된다(read-back 확인) — masking_mode, test_key read-back 성공
- [x] mock 대상 노드(NiFi/Debezium/ES)는 상태 표시가 계약대로 렌더된다(실호출 없이)
- [x] real-adapter/mock-adapter 조작 함수 시그니처가 동일해 어댑터 스왑이 URL 환경변수만으로 성립

## TC (Right-BICEP · CORRECT)

> 단위(격리): `httpx`/monkeypatch로 Airflow REST를 mock한 pytest — 실 스택 호출 없이 요청 구성·Pydantic 검증. 통합(실 스택): Z-post에서 로컬 Airflow 기동 후.

### Right-BICEP

- [x] **Right(정상 경로)**: `trigger_dag`가 `POST /dags/{id}/dagRuns`(conf 포함)를 올바른 URL·바디로 호출하고 dag_run_id를 반환한다; `set_variable`가 `PATCH /variables/{key}` 호출
- [x] **B(경계)**: 빈 conf·최소 페이로드로 트리거, 매핑되지 않은 node_id(None dag) 처리
- [x] **I(역·부정)**: 존재하지 않는 node_id → 404, 스키마 불충족 페이로드 → 422(Pydantic)
- [x] **C(교차 확인)**: Variables 설정 후 `GET /variables/{key}` read-back 값 == 설정값 (masking_mode=regex/hash, test_key=hello_world 확인); mock/real 어댑터 `triggerNode`/`setNodeConfig` 시그니처 동일(svelte-check)
- [x] **E(에러 조건)**: Airflow 스택 다운/타임아웃 시 기존 에러 패턴대로 graceful 처리(예외 전파로 500 크래시 안 함)
- [x] **P(성능)**: 해당 없음 — 단일 REST 프록시, 성능 임계 없음

### CORRECT

- [x] **Conformance**: nodes 라우트 요청/응답이 Pydantic 스키마 준수, 잘못된 타입 거부(422)
- [x] **Ordering**: 해당 없음 — 단일 트리거, 순서 의존 없음
- [x] **Range**: `set_paused`의 is_paused는 bool, masking 변수는 허용값(on/off·regex 등) 범위
- [x] **Reference**: node_id→dag_id 매핑이 실재 DAG(`STAGE_DAG_MAP`)를 참조, 없는 매핑은 명시적 처리
- [x] **Existence**: 트리거 후 Airflow에 dag_run이 실제 생성됨 — silver_2_masking 2건 queued 확인
- [x] **Cardinality**: 해당 없음 — 단건 트리거/설정
- [x] **Time**: DAG 트리거는 비동기 — 응답 즉시 completed가 아니라 queued/running임을 계약에 반영(즉시 완료 가정 금지)

### mock 노드(NiFi/Debezium/ES) TC

- [x] mock 대상 노드는 상태 표시 배지만 렌더되고 조작 시 실 REST 호출이 **나가지 않음** (sample 모드 e2e 23/23 통과로 간접 확인)

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> DB 스키마(DDL) 변경 없음 — Airflow REST/Variables는 스키마 마이그레이션 대상 아님 → 마이그레이션 항목 생략. frontend 정적 게이트는 머지 직후 원본 main.

### Z-pre. 머지 전 (워크트리 — 정적·격리만)

- [x] `python -m py_compile ui-backend/app/services/airflow.py ui-backend/app/api/nodes.py` 통과
- [x] Pydantic 스키마·요청 구성 격리 단위테스트(pytest, Airflow REST monkeypatch mock) 통과 — 실 스택 미기동 (9/9 PASSED)
- [x] 워크트리 브랜치에 구현 커밋 (실 스택 통합테스트·머지는 메인 책임)

### Z-static. 머지 직후 (원본 main — node_modules 상주)

- [x] `cd frontend && npm run check` 통과 — real-adapter `triggerNode`/`setNodeConfig` 시그니처 정합 (0 errors)
- [x] `cd frontend && npm run build` 성공

### Z-post. push 후 (로컬 Airflow 스택 기동 root)

- [x] `docker compose up -d airflow` — SQLite+SequentialExecutor, DockerfileAirflow(pymysql 선설치), AIRFLOW__API__AUTH_BACKENDS=basic_auth
- [x] Airflow 노드 트리거 시 **실제 REST 호출이 나가고**(ui-backend 로그 확인) DAG 실행이 발생한다 — silver_2_masking 2건 queued 생성
- [x] Variables(masking on/off) 설정 시 Airflow Variables가 실제 변경됨(read-back 확인) — masking_mode(regex→hash), test_key(hello_world) 검증
- [x] ui-backend 통합테스트(pytest, 스택 전제) 통과 — 9/9 PASSED (monkeypatch 단위테스트 재확인)
  - teardown: 테스트로 설정한 Variables 삭제 완료 (`DELETE /variables/masking_mode`, `DELETE /variables/test_key` → 204)

## 재사용 자산

- 기존 `airflow.py`의 인증·베이스 URL·에러 처리 패턴(`AIRFLOW_BASE`/`auth`/`timeout`) — 쓰기 함수에 재활용
- `ui-backend` 라우터 구조(`app/api/*.py` + `main.py include_router`) — 신규 nodes 라우트에 동일 패턴
- decisions §6 API 어댑터 계약(환경변수 URL 주입·Pydantic 스키마 고정)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| 로컬 Airflow 스택 미기동 시 실동작 검증 불가 | 검증은 post-gate(스택 기동 root)에서 수행, worktree에선 정적·격리 단위테스트만 |
| 트리거 conf 계약이 P1 노드 config 스키마와 불일치 | P1의 `ToolNode.config` 계약을 트리거 conf의 단일 소스로 삼고 Pydantic으로 이중 검증 |
| mock 노드가 "실동작하는 척"으로 오해 유발 | 상태 표시에 "상태 조회 전용 · 실동작은 F2/F3/F7" 명시 배지 |
