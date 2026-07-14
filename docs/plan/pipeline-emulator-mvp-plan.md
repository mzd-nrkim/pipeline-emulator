# 파이프라인 에뮬레이터 — MVP 실행 계획서 (Week 1)

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

## 5. 작업 항목 (Week 1)

### T1. 샘플 데이터 생성 (착수 전 선행)

> 상세: [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md)

- [ ] Python 생성 스크립트 (`scripts/sample_data/`) — `faker(ko_KR)` + 고정 시드로 결정적 생성
- [ ] 원천 더미 → Parquet(pyarrow) → SeaweedFS 업로드(boto3, S3 호환)
- [ ] 볼륨: CFT 문제 5건 · 문제당 부품 3 · 단계 2 · 청크 3 (Bronze 5 → Gold 15행)
- [ ] PII 시드: 패턴형 4종(전화·주민번호·이메일·계좌)으로 4건 임계 충족, is_masked TRUE/FALSE 혼합
- [ ] 중요도 S/A/B/C/D/E 골고루 (pclrty_class 3분류 모두 출현)

### T2. Docker Compose 골격

- [ ] compose 파일 작성 — seaweedfs · mysql · airflow(LocalExecutor) · mock-api 4서비스
- [ ] healthcheck / depends_on 기동 순서 (lodestar 골격 차용)
- [ ] MySQL 초기 스키마 — Bronze 메타 / Silver / Gold 단계 테이블 DDL (원본 PDIS DDL 기준)
- [ ] Airflow 환경변수 뼈대: `AIRFLOW__CORE__EXECUTOR=LocalExecutor`, `CHUNKING_API_URL` / `ENRICH_API_URL` (어댑터 경계 선점)

### T3. Python 수집 스크립트 (Bronze 투입)

- [ ] 더미 Parquet를 SeaweedFS Bronze 경로 규칙으로 업로드
      (`bronze/pdis/pcqlty/rdb/cft_problem_history_b/{batch_id}/part-00000.parquet`)
- [ ] `row_hash`(MD5) 규칙 중앙화 (수집기 교체 시 계약 유지)
- [ ] **CDC 계약 선점**: `bronze_rdb_events.change_operation="snapshot"` 채움 (향후 Debezium 어댑터가 동일 필드 재사용)

### T4. Airflow DAG 6개 (단순화)

TaskFlow API 기반, 단계별 MySQL 적재.

- [ ] `bronze_0_registration` — Parquet 메타 → `bronze_document_hub` / `bronze_rdb_events` / `bronze_document_rdb_link` / `bronze_document_assembly_sat`
- [ ] `silver_1_structuring` — 표준 JSON 스키마(`data` + `display`)로 구조화 → `silver_structured_documents` (SCD Type2)
- [ ] `silver_2_masking` — 정규식 마스킹 → `silver_masked_documents` (`pii_detection_count`, `pii_pattern_types`, `is_masked`(≥4), `masking_method="regex"`)
- [ ] `gold_3_chunking` — Mock API 호출(환경변수 URL) → `gold_chunked_documents`
- [ ] `gold_4_enrichment` — Mock API 호출 → `gold_enriched_documents` (keywords·entities·summary·category)
- [ ] `gold_5_field_mapping` — `es_field_info`·`role_ids`·`metadata_tags`·`pclrty_class`(중요도→보안분류) → `gold_staged_documents` (`indexing_status="staged"`)

### T5. Mock API (FastAPI 규칙 기반)

- [ ] 청킹 엔드포인트 — 섹션별 분할(문제/대책/부품), 요청/응답 **Pydantic 스키마 고정**(원본 API 스펙 지향)
- [ ] 엔리치 엔드포인트 — 규칙 기반(키워드=빈도 상위, 요약=첫 문장, 개체명=심어둔 이름/차종)
- [ ] 인터페이스를 처음부터 원본 API 스펙에 맞춰 설계 (Mock↔실 API 무비용 교체 대비)

### T6. PII 엔진 래퍼 (신규 — 모듈화 유일 신규 코드)

- [ ] `detect_and_mask(text)` 단일 진입점 유지
- [ ] **Layer2(spaCy NER) on/off 스위치 래퍼** 신설 — 원본은 Layer1+2 항상 동시 실행이므로 `MASK=regex`면 Layer1(정규식)만 실행하도록 off 스위치 추가
- [ ] `_create_nlp_engine()`만 교체 가능하게 캡슐화 (Presidio 2-Layer는 다음 계획에서 스위치 on)

### T7. 최소 상태 표시

- [ ] Airflow UI로 DAG 실행 현황 그대로 시연
- [ ] 단계별 문서 수 MySQL 조회 쿼리 (Week 2 대시보드가 그대로 흡수)

### T8. end-to-end 통합 테스트

- [ ] 더미 투입 → 6개 DAG 전부 성공 확인
- [ ] 각 단계 MySQL 테이블 행 수 = 기대치(Bronze 5 → Silver 5 → 마스킹 5 → 청킹 15 → 엔리치 15 → staged 15)

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

- [ ] Parquet 스키마가 원본 컬럼명과 일치 (필수 컬럼 누락 0)
- [ ] Bronze 등록 후 `bronze_document_hub` 행 수 = 투입 문제 수(5)
- [ ] Silver 1 `structured_content` JSON이 표준 스키마(data+display) 파싱 통과
- [ ] Silver 2에서 패턴형 PII(전화·주민번호·이메일·계좌)가 정규식으로 마스킹, `pii_pattern_types` 카운트 = 기대치
- [ ] is_masked=TRUE/FALSE 레코드가 모두 존재 (정책 분기 시연)
- [ ] Gold 청킹 후 행 수 = 문서 수 × 청크 수 (15)
- [ ] Gold 5 `pclrty_class` 3분류(RESTRICTED/INTERNAL/PUBLIC) 모두 출현
- [ ] `indexing_status="staged"`에서 정지 (ES 미구현 확인)
- [ ] **end-to-end**: 투입 → Gold staged까지 6개 DAG 전부 성공, 상태 표시로 단계별 카운트 확인
- [ ] `MASK=regex` 토글이 실제로 Layer2를 비활성화함 (래퍼 동작 검증)
- [ ] Mock API가 환경변수 URL로 호출됨 (어댑터 경계 동작 검증)

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
