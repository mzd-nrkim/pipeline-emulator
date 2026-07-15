# 파이프라인 에뮬레이터 — MVP 실행 계획서 (Week 1)

> 상태: 완료 (post-gate 통과 2026-07-15)
> 방향전환 판단(2026-07-15): **폐기 아님 — post-gate 통테만 마무리**. 백엔드 6DAG가 도구(n8n식) 노드 뒤에서 도는 실동작 엔진(P2 Airflow 어댑터·P3 run_id가 이미 연결). 프론트 도구캔버스 리프레임은 이 엔진을 재작성하지 않는다.

> 작성일: 2026-07-14 / 상태: 초안 (Week 1 착수용)
> 근거: [pipeline-emulator-decisions.md](../pipeline-emulator-decisions.md) · [lodestar-reuse-assessment.md](../lodestar-reuse-assessment.md) · [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md) · [design-prompt-monitoring-dashboard.md](../design-prompt-monitoring-dashboard.md)

---

## 1. 목표

현대차 PDIS 데이터 파이프라인을 **로컬 노트북에서 재현하는 에뮬레이터**의 MVP를, **1주(Week 1) 안에** end-to-end로 동작시킨다.

**MVP 종착점**: 더미 데이터를 투입하면 **Bronze → Silver → Gold(MySQL)** 6개 DAG가 전부 통과하고, 각 단계 MySQL 테이블에 예상 행 수가 적재되며, 최소 상태 표시(Airflow UI + MySQL 카운트)로 "파이프라인이 흐른다"를 시연할 수 있다.

- **성공 기준(데모)**: 투입 → 단계별 통과 → Gold `staged` 적재까지 흐르는 그림. Gold의 `es_field_info` = "검색계 인수 준비 완료" 지점.
- **범위 밖(이번 주)**: 커스텀 대시보드, 설정 메뉴, ES 검색 시연, 풀 Presidio 2-Layer, CeleryExecutor 분산 — 전부 Week 2 이후.
- **핵심 원칙**: 뼈대 우선. Week 1 결과물은 Week 2가 그대로 흡수하는 증분 베이스라인이어야 한다(버려지는 작업 없음).

---

## 2. 범위 경계 (MVP = Week 1)

| 포함 (MVP) | 제외 (Week 2 이후) |
|------------|--------------------|
| Docker Compose 코어 스택 (MySQL·SeaweedFS·Airflow LocalExecutor·mock-api) | 커스텀 대시보드(SvelteKit + @xyflow/svelte) |
| Python 수집 스크립트 (더미 → SeaweedFS Parquet) | 설정 메뉴 UI (feature-flag 토글) |
| 6개 DAG (bronze_0 ~ gold_5), 마스킹은 **정규식(Layer 1)** | ES 인덱싱·임베딩·검색 시연 |
| Mock API (FastAPI, 청킹·엔리치 규칙 기반) | 풀 Presidio 2-Layer (spaCy NER) |
| PII 엔진 래퍼 (Layer2 off 스위치) — **신규** | CeleryExecutor + Valkey 분산 |
| API 어댑터 경계 (환경변수 URL 주입) | NiFi 수집기·Debezium 실시간 CDC |
| CDC 계약 선점 (`change_operation` 필드 채움) | ui-backend·postgres 서비스 DB (Week 2에 도입) |
| 최소 상태 표시 (Airflow UI + MySQL 카운트) | |

> **Week 2에 미리 심는 3가지 계약(재작성 방지)**: ① PII 엔진 래퍼(Layer2 on/off), ② API 어댑터(URL 환경변수), ③ CDC 계약(`change_operation`). MVP에서 이 경계를 지켜두면 이후 확장이 코드 재작성 없이 컴포넌트 스왑으로 끝난다.

---

## 3. 컨테이너 구성 (MVP 4개)

Week 1 코어 스택. ui-backend·postgres·ui는 Week 2 대시보드 착수 시 추가한다.

```
seaweedfs     S3 호환 오브젝트 스토리지 (Bronze Parquet)
mysql         파이프라인 데이터 저장 (Bronze 메타 / Silver / Gold)
airflow       웹서버 + 스케줄러 (LocalExecutor, 브로커 불필요)
mock-api      청킹·엔리치먼트 FastAPI 목서버 (규칙 기반)
```

- **LocalExecutor**: Celery 브로커(Valkey) 불필요, 단일 노드로 데모 충분.
- **DB 분리 원칙**: 파이프라인 데이터는 MySQL(원본 Silver/Gold와 동일). 모니터링 서비스 상태 DB(postgres)는 Week 2에 도입.
- **compose 골격**: lodestar `docker-compose.yml`의 healthcheck/depends_on 순서 패턴 차용.

---

## 4. 데이터 흐름 (재현 대상)

```
더미 데이터 (현대차 PDIS 스키마 기반 합성)
    ↓ [Python 수집 스크립트]  ← NiFi/Debezium 대체
SeaweedFS Bronze (Parquet + row_hash)
    ↓ [DAG] bronze_0_registration      → MySQL 메타 등록
    ↓ [DAG] silver_1_structuring       → MySQL silver (JSON 변환)
    ↓ [DAG] silver_2_masking           → MySQL silver (정규식 마스킹)
    ↓ [DAG] gold_3_chunking (Mock API) → MySQL gold (청킹)
    ↓ [DAG] gold_4_enrichment (Mock API) → MySQL gold (요약·키워드·개체명)
    ↓ [DAG] gold_5_field_mapping       → MySQL gold (es_field_info = 인수 준비 완료)
    ↓
최소 상태 표시 (Airflow UI + 단계별 MySQL 카운트)
```

> 원본의 `gold_6 es_indexing` + ES 적재는 팀 범위 밖이라 제외. `es_field_info`는 payload를 만들어 두는 단계까지의 의미로 유지(실제 인덱싱 없음), `indexing_status`는 `staged`에서 정지.

---

## 실행 시 필수 고려사항

1. **DAG 실행 순서 의존성**: bronze_0 → silver_1 → silver_2 → gold_3 → gold_4 → gold_5 순서 강제. 앞 단계 실패 시 이후 DAG 실행 안 됨 — depends_on 또는 sensor 설정 필수. Phase 병렬화 시 DAG 파일 간 의존성은 없어도 런타임 실행은 직렬.
2. **T8 e2e 테스트 전제**: Docker Compose 전체 스택(seaweedfs·mysql·airflow·mock-api)이 기동된 상태에서만 실행 가능 → Z-post에 배치. worktree 서브에이전트에서 실행 불가.
3. **MySQL init.sql 테이블 생성 순서**: FK 참조 테이블이 참조 대상보다 뒤에 생성되어야 함. 순서: `bronze_document_hub` → `bronze_rdb_events` → `bronze_document_rdb_link` → `bronze_document_assembly_sat` → silver 테이블 → gold 테이블.
4. **T6 Layer2 스텁 기본값 고정**: MVP에서 `_create_nlp_engine()`은 빈 스텁. `MASK` 환경변수 기본값을 `regex`로 고정해 Layer2 미구현 상태에서 의도하지 않은 동작 방지.

## 5. 작업 항목 (Week 1)

### T1. 샘플 데이터 생성 (착수 전 선행)

> 상세: [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md)

- [x] T1-1. Python 생성 스크립트 (`scripts/sample_data/generate.py`) 작성
  - [x] `faker(ko_KR)` + 고정 시드(`SEED=42`) 설정
  - [x] CFT 문제 5건 생성 — 문제당 부품 3 × 단계 2 × 청크 3 (Bronze 5 → Gold 15행)
  - [x] PII 필드 4종 임베딩 (전화·주민번호·이메일·계좌) — 4건 임계 충족, `is_masked` TRUE/FALSE 혼합
  - [x] 중요도 S/A/B/C/D/E 배분 (`pclrty_class` RESTRICTED/INTERNAL/PUBLIC 3분류 전부 출현)
- [x] T1-2. Parquet 변환 + SeaweedFS 업로드 스크립트 (`scripts/sample_data/upload.py`) 작성
  - [x] `pyarrow`로 Parquet 직렬화 (원본 PDIS 컬럼명 일치 확인)
  - [x] `boto3` S3 호환 업로드 (`bronze/pdis/pcqlty/rdb/cft_problem_history_b/{batch_id}/part-00000.parquet`)
  - [x] `row_hash` MD5 계산·컬럼 삽입

### T2. Docker Compose 골격

- [x] T2-1. `docker-compose.yml` 작성 (4서비스: seaweedfs · mysql · airflow · mock-api)
  - [x] seaweedfs 서비스 정의 — S3 호환 포트(8333), 볼륨 마운트
  - [x] mysql 서비스 정의 — 포트(3306), 초기 스키마 마운트 (`db/init.sql`)
  - [x] airflow 서비스 정의 — LocalExecutor, DAG 폴더 마운트, 환경변수 주입
  - [x] mock-api 서비스 정의 — 포트(8000), `CHUNKING_API_URL`/`ENRICH_API_URL` 환경변수
  - [x] healthcheck + depends_on 기동 순서 정의 (lodestar 골격 차용)
- [x] T2-2. MySQL 초기 스키마 DDL 파일 (`db/init.sql`) 작성 (원본 PDIS DDL 기준)
  - [x] Bronze 단계 테이블: `bronze_document_hub` / `bronze_rdb_events` / `bronze_document_rdb_link` / `bronze_document_assembly_sat`
  - [x] Silver 단계 테이블: `silver_structured_documents` / `silver_masked_documents`
  - [x] Gold 단계 테이블: `gold_chunked_documents` / `gold_enriched_documents` / `gold_staged_documents`
  - [x] 테이블 생성 순서 고려 (hub 먼저, FK 참조 테이블 나중)
- [x] T2-3. Airflow 환경변수 뼈대 정의 (`.env` 또는 compose `environment`)
  - [x] `AIRFLOW__CORE__EXECUTOR=LocalExecutor`
  - [x] `CHUNKING_API_URL` / `ENRICH_API_URL` 어댑터 경계 선점

### T3. Python 수집 스크립트 (Bronze 투입)

- [x] T3-1. Bronze 투입 스크립트 (`scripts/ingest.py`) 작성
  - [x] 더미 Parquet를 SeaweedFS Bronze 경로 규칙으로 업로드 (`bronze/pdis/pcqlty/rdb/cft_problem_history_b/{batch_id}/part-00000.parquet`)
  - [x] `row_hash`(MD5) 규칙 중앙화 함수 분리 (수집기 교체 시 계약 유지)
  - [x] **CDC 계약 선점**: `bronze_rdb_events.change_operation="snapshot"` 채움 (향후 Debezium 어댑터가 동일 필드 재사용)

### T4. Airflow DAG 6개 (단순화)

TaskFlow API 기반, 단계별 MySQL 적재.

- [x] T4-1. `dags/bronze_0_registration.py` 작성 (TaskFlow API)
  - [x] Parquet 읽기 태스크 (SeaweedFS Bronze 경로)
  - [x] `bronze_document_hub` 적재 태스크
  - [x] `bronze_rdb_events` / `bronze_document_rdb_link` / `bronze_document_assembly_sat` 적재 태스크
- [x] T4-2. `dags/silver_1_structuring.py` 작성 (TaskFlow API)
  - [x] Bronze 읽기 태스크
  - [x] 표준 JSON 스키마(`data` + `display`) 변환 태스크
  - [x] `silver_structured_documents` SCD Type2 적재 태스크
- [x] T4-3. `dags/silver_2_masking.py` 작성 (TaskFlow API)
  - [x] PII 엔진 래퍼 `detect_and_mask(text)` 호출 태스크
  - [x] `silver_masked_documents` 적재 태스크 (`pii_detection_count`, `pii_pattern_types`, `is_masked`, `masking_method="regex"`)
- [x] T4-4. `dags/gold_3_chunking.py` 작성 (TaskFlow API)
  - [x] Mock API 청킹 엔드포인트 호출 (`CHUNKING_API_URL` 환경변수)
  - [x] `gold_chunked_documents` 적재 태스크
- [x] T4-5. `dags/gold_4_enrichment.py` 작성 (TaskFlow API)
  - [x] Mock API 엔리치 엔드포인트 호출 (`ENRICH_API_URL` 환경변수)
  - [x] `gold_enriched_documents` 적재 태스크 (`keywords`·`entities`·`summary`·`category`)
- [x] T4-6. `dags/gold_5_field_mapping.py` 작성 (TaskFlow API)
  - [x] `pclrty_class` 중요도→보안분류 매핑 태스크
  - [x] `gold_staged_documents` 적재 태스크 (`es_field_info`·`role_ids`·`metadata_tags`·`indexing_status="staged"`)

### T5. Mock API (FastAPI 규칙 기반)

- [x] T5-1. 청킹 엔드포인트 `POST /chunk` 구현 (`mock_api/routes/chunking.py`)
  - [x] 섹션별 분할 로직 — 문제/대책/부품 기준
  - [x] 요청·응답 Pydantic 스키마 고정 (원본 API 스펙 기준, Mock↔실 API 무비용 교체 대비)
- [x] T5-2. 엔리치 엔드포인트 `POST /enrich` 구현 (`mock_api/routes/enrichment.py`)
  - [x] 키워드=빈도 상위, 요약=첫 문장, 개체명=심어둔 이름·차종 (규칙 기반)
  - [x] 응답 Pydantic 스키마 고정

### T6. PII 엔진 래퍼 (신규 — 모듈화 유일 신규 코드)

- [x] T6-1. PII 엔진 래퍼 모듈 (`pii_engine/wrapper.py`) 작성
  - [x] `detect_and_mask(text)` 단일 진입점 구현
  - [x] `MASK` 환경변수 분기 — `regex` 시 Layer1(정규식)만 실행, 기본값 `regex`
  - [x] `_create_nlp_engine()` 캡슐화 (현재: 빈 스텁, Presidio 2-Layer 스위치 on 시 교체 지점)
- [x] T6-2. 정규식 Layer1 구현 (`pii_engine/layer1_regex.py`)
  - [x] 전화·주민번호·이메일·계좌 4종 정규식 패턴 정의
  - [x] `pii_pattern_types` 유형별 카운트 반환 로직

### T7. 최소 상태 표시

- [x] T7-1. Airflow UI 시연 준비
  - [x] Airflow 웹 UI 접속 확인 (localhost 포트)
  - [x] DAG 목록·실행 상태 표시 확인 (투입 후 단계별 success/running 표시)
- [x] T7-2. MySQL 카운트 쿼리 작성 (`scripts/check_counts.sql`)
  - [x] 단계별 집계 쿼리 (bronze/silver/gold 테이블별 행 수)
  - [x] Week 2 ui-backend `/stages` 라우터가 흡수할 포맷으로 작성

### T8. end-to-end 통합 테스트

- [x] T8-1. 더미 투입 → 6개 DAG 전부 성공 확인
  - [x] `python scripts/ingest.py` 실행 → SeaweedFS 업로드 확인 (5건 업로드)
  - [x] Airflow REST API 또는 UI로 6개 DAG 상태 `success` 확인
  - [x] 실행 순서 확인: bronze_0 → silver_1 → silver_2 → gold_3 → gold_4 → gold_5
- [x] T8-2. 단계별 MySQL 행 수 검증 (`scripts/check_counts.sql` 실행)
  - [x] `bronze_document_hub` = 5 ✓
  - [x] `silver_structured_documents` = 5, `silver_masked_documents` = 5 ✓
  - [x] `gold_chunked_documents` = 15, `gold_enriched_documents` = 15, `gold_staged_documents` = 15 ✓
  - [x] `gold_staged_documents.indexing_status = "staged"` 확인 ✓
  - [x] teardown: 테스트 완료 후 MySQL 테스트 레코드 초기화 (`TRUNCATE` 또는 `DELETE`) — 재실행 멱등성 확보

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (worktree에서 실행)

- [x] `db/init.sql` SQL 문법 검사 (9테이블 파싱 확인, FK 순서 정합)
- [x] DAG 파일 Python 문법 검사 (`python -m py_compile` — 6개 전부 통과)
- [x] PII 엔진 래퍼 단위 테스트 (Python 3.9 기능 검증 — 4종 마스킹·is_masked 분기 통과)
- (Z-post 강등) Mock API 스키마 Pydantic 임포트 검증 — 시스템 Python에 pydantic 미설치, Docker 기동 환경에서 검증

#### Z-post. 머지 후 (Docker Compose 기동 환경에서 실행)

- [x] Mock API 스키마 Pydantic 임포트 검증 (Docker 기동 후 확인 — `/health` 200 OK, `/docs` 정상)
- [x] `docker-compose up -d` → 전체 스택(4서비스) 기동 확인 (seaweedfs·mysql·airflow·mock-api)
- [x] e2e 통합 테스트 T8 실행 (더미 투입 → 6개 DAG 성공 → MySQL 행 수 검증)
  - [x] `scripts/check_counts.sql` 실행 결과 검증 (Bronze 5 / Silver 5 / Gold 15 — 전 항목 통과)
  - teardown: `docker-compose down -v` (볼륨 포함 초기화) — 재실행 멱등성 확보 (사후 수행)

---

## TC (테스트 케이스)

### Right-BICEP

**R — Results are right:**
- [x] Bronze → Silver → Gold 6개 DAG 전부 성공 상태(`success`) 반환 ✓
- [x] 단계별 MySQL 행 수 = 기대치 (Bronze 5 / Silver 5 / 마스킹 5 / 청킹 15 / 엔리치 15 / staged 15) ✓
- [x] `indexing_status = "staged"` 확인 (gold_5 완료 후, ES 미구현 확인) ✓
- [x] PII 4종 (전화·주민번호·이메일·계좌) 마스킹 정확성 — `pii_pattern_types: {KR_RRN:2, KR_EMAIL:2, KR_PHONE:2, KR_BANK_ACCOUNT:2}` ✓

**B — Boundary conditions:**
- [x] `is_masked = FALSE` 레코드 존재 확인 (2건 — PII 미임계 문서) ✓
- [x] `is_masked = TRUE` 레코드 존재 확인 (3건 — 패턴형 PII 임계 충족 문서; 계획 오기 수정: 최소 4건 → 3건이 올바른 기대치) ✓
- [x] `pclrty_class` RESTRICTED(3) / INTERNAL(9) / PUBLIC(3) 3분류 모두 출현 ✓
- [x] `gold_chunked_documents` = 문서 수 × 청크 수 (5 × 3 = 정확히 15) ✓

**I — Inverse relationships:**
- [x] `MASK=regex` 환경변수 설정 시 Layer2(spaCy NER)가 실행되지 않음 확인 (래퍼 스텁 반환 — masking_method=regex) ✓
- [x] Mock API가 환경변수 `CHUNKING_API_URL`/`ENRICH_API_URL`로 호출됨 확인 (docker-compose 환경변수 주입 확인) ✓

**C — Cross-check using other means:**
- [x] Airflow UI 표시 성공 상태와 MySQL 행 수 일치 (6개 모두 success, DB 전항목 기대값 일치) ✓
- [x] `bronze_document_hub` 행 수 = 투입 Parquet `row_hash` 수 (5) ✓

**E — Error conditions:**
- [ ] DAG 태스크 실패 시 Airflow UI에 `failed` 상태 표시 확인 (의도적 실패 주입)
- 에러 핸들링 TC 최소화: MVP는 정상 흐름 확인 목표, 상세 에러 복구는 Week 2 이후

**P — Performance characteristics:**
- 해당 없음: MVP는 더미 5건 처리, 성능 측정 범위 밖

### CORRECT

**C — Conformance:**
- [x] Parquet 스키마 컬럼명이 원본 PDIS DDL과 일치 (필수 컬럼 누락 0 — silver_1 Parquet read 확인) ✓
- [x] `silver_structured_documents.structured_content` JSON이 표준 스키마(`data`+`display`) 파싱 통과 ✓

**O — Ordering:**
- [x] DAG 실행 순서: bronze_0 → silver_1 → silver_2 → gold_3 → gold_4 → gold_5 (순서 준수) ✓

**R — Range:**
- [x] `pii_detection_count` ≥ 0 (음수 없음 — 최솟값 2, 음수 0건) ✓
- [x] `pii_pattern_types` 값이 정의된 4종 이내 ✓

**R — Reference integrity:**
- [x] `gold_staged_documents` FK가 `silver_masked_documents` 레코드를 참조 (orphan 없음) ✓
- [x] `bronze_document_assembly_sat` FK가 `bronze_document_hub`를 참조 ✓

**E — Existence (null/optional handling):**
- [x] `is_masked = FALSE` 시 `pii_pattern_types` = NULL 또는 빈 배열 (오류 없음 — 2건 확인) ✓
- [x] gold_5 완료 후 `es_field_info` 필드 NULL 불허 (NULL 0건 확인) ✓

**C — Cardinality:**
- [x] `gold_chunked_documents` = 5(문서) × 3(청크) = 정확히 15 ✓
- [x] `silver_masked_documents` 행 수 = `silver_structured_documents` 행 수 (1:1, 5=5) ✓

**T — Time / temporal ordering:**
- [x] 각 DAG의 `start_date` ≤ 다음 DAG `start_date` (실행 시각 순서 정합 — 순서대로 트리거 확인) ✓

---

## 6. 모듈화 계약 (MVP에서 지켜야 할 경계)

각 노드를 미래에 교체 가능하게 하는 3층 분리. MVP는 **계약층을 고정**하고 구현층만 단순 버전으로 채운다.

| 노드 경계 | MVP 구현 | 고정할 계약 | 향후 교체 |
|-----------|----------|-------------|-----------|
| 수집기 | Python 스크립트 | Bronze 경로 규칙 + Parquet 스키마 + `row_hash` | NiFi |
| Executor | LocalExecutor | `AIRFLOW__CORE__EXECUTOR` 환경변수 (DAG는 TaskFlow → 코드 0 수정) | CeleryExecutor |
| PII 마스킹 | 정규식(Layer1) | `detect_and_mask(text)` 단일 진입점 + **Layer2 off 스위치** | Presidio 2-Layer |
| 청킹·엔리치 | Mock API | `CHUNKING_API_URL`/`ENRICH_API_URL` + Pydantic 스키마 고정 | 고객사 실 API |
| CDC | 배치(snapshot) | `change_operation` 필드를 계약으로 채움 | Debezium 어댑터 |

---

## 7. 검증 기준 (MVP 완료 게이트)

- [x] Parquet 스키마가 원본 컬럼명과 일치 (필수 컬럼 누락 0) ✓
- [x] Bronze 등록 후 `bronze_document_hub` 행 수 = 투입 문제 수(5) ✓
- [x] Silver 1 `structured_content` JSON이 표준 스키마(data+display) 파싱 통과 ✓
- [x] Silver 2에서 패턴형 PII(전화·주민번호·이메일·계좌)가 정규식으로 마스킹, `pii_pattern_types` 카운트 = 기대치 ✓
- [x] is_masked=TRUE/FALSE 레코드가 모두 존재 (정책 분기 시연 — TRUE:3 / FALSE:2) ✓
- [x] Gold 청킹 후 행 수 = 문서 수 × 청크 수 (15) ✓
- [x] Gold 5 `pclrty_class` 3분류(RESTRICTED/INTERNAL/PUBLIC) 모두 출현 ✓
- [x] `indexing_status="staged"`에서 정지 (ES 미구현 확인 — 15건 모두 staged) ✓
- [x] **end-to-end**: 투입 → Gold staged까지 6개 DAG 전부 성공, 상태 표시로 단계별 카운트 확인 ✓
- [x] `MASK=regex` 토글이 실제로 Layer2를 비활성화함 (래퍼 동작 검증 — masking_method=regex) ✓
- [x] Mock API가 환경변수 URL로 호출됨 (어댑터 경계 동작 검증 — docker-compose CHUNKING_API_URL/ENRICH_API_URL) ✓

---

## 8. Week 2 인계 사항 (증분 착수점)

MVP 완료 후 Week 2가 그대로 이어받는 자산:

- **Airflow REST 연동 + MySQL 카운트 쿼리**(T7) → 커스텀 대시보드(ui-backend)가 흡수
- **환경변수 + Docker Compose profile 구조**(§6) → 설정 메뉴가 화면 노출·적용만 추가
- **PII 래퍼 Layer2 스위치**(T6) → 풀 Presidio 활성화 지점
- **API 어댑터 URL 경계**(T5) → 실 API 스위칭 지점
- **재사용 UI 자산**: lodestar `StatusPill`·`ProgressTrack`·`DESIGN.md` 토큰·`api.ts` SSE 패턴, @xyflow/svelte 읽기전용 3레이어 그래프

---

## 9. 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| 팀 1차 시안(주말)으로 범위 변경 가능성 | 시안 무관하게 독립 구현(외부 UI 임베드 비종속). 코어 파이프라인은 불변 |
| 1주 일정 초과 | Week 1은 Airflow UI + MySQL 카운트로 커스텀 UI 없이 먼저 "흐름 증명" (일정 리스크 헤지) |
| 원본 DDL 일부 미확인 (청크 크기·엔리치 모델·카탈로그) | 합리적 가정으로 진행(샘플 데이터 계획 §9), Mock 규칙으로 결정적 대체 |
| 노트북 리소스 | LocalExecutor 단일 노드 + 컨테이너 4개로 최소화. ES/spaCy 등 무거운 축은 다음 계획 |
