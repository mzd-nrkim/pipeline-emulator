# 데이터 파이프라인 에뮬레이터 — 결정사항 & 할 일

> 작성일: 2026-07-13 / 상태: 진행 중 (팀 1차 시안 대기)

---

## 배경

- **기각**: lodestar 프로젝트
- **조건**: 공통 서비스 또는 다수 사용자가 쓸 수 있는 툴 (개인 목적 도구 기각)
- **대상·용도**: **데모 아티팩트** (경영진·고객·팀 시연용). 성공 기준은 "파이프라인이 흐르고, 최종적으로 검색까지 시연"되는 임팩트.
- **일정**: 구현 기한 2주

---

## 결정사항

### 1. 프로젝트 방향

**현대차 데이터 파이프라인을 로컬 PC에서 재현하는 에뮬레이터**

- 기반 프로젝트: `hyundaimotor-lllm` (현대차 LLM 플랫폼 데이터 파이프라인)
- 구성: Docker Compose 경량 스택 + 모니터링 UI
- 팀장 승인: 완료

### 2. 에뮬레이터 형태

둘 다:
- **경량 Docker Compose 스택** — 실제 도구를 단순화해 로컬에서 동작
- **모니터링 UI** — 각 단계(Bronze/Silver/Gold) 처리 현황 실시간 표시

> **범위 경계**: **MVP 종착은 Gold(MySQL) = 검색계 인수 준비 완료** 지점. 단 이 툴 목적이 데모 아티팩트이고 **검색 결과가 데모 클라이맥스**이므로, ES 인덱싱·임베딩·검색은 **MVP 직후 부가기능으로 데모에 반드시 포함**한다(아래 "다음 계획"의 검색 서빙(ES) 축). 즉 MVP는 Gold까지, 데모 확장에서 검색까지.

### 3. 원본 → 에뮬레이터 스택 대체

| 원본 | 에뮬레이터 대체 | 사유 |
|------|----------------|------|
| NiFi 3노드 클러스터 | Python 수집 스크립트 | 설정 공수 대비 데모 가치 낮음 |
| Airflow CeleryExecutor + Valkey 6노드 | Airflow LocalExecutor (단일 노드) | LocalExecutor는 브로커(Valkey) 불필요, 단일 노드로 데모 충분 |
| ES 3-master + ML 노드 (검색 서빙) | **MVP 제외 → 직후 데모 확장** | MVP는 Gold까지. 검색은 데모 클라이맥스라 MVP 직후 부가기능으로 추가 (다음 계획) |
| 청킹·엔리치먼트 고객사 API (미오픈) | Mock API (FastAPI, 규칙 기반) | 원본도 미오픈 상태 |
| HCloud S3 호환 스토리지 (현대클라우드) | SeaweedFS 단일 컨테이너 | 로컬 S3 호환, 단일 컨테이너로 충분 |
| MySQL (고객사 제공) | MySQL 컨테이너 | 동일 |
| Debezium CDC (원본 가동 중) | 미구현 | 실시간 CDC는 데모 범위 밖 — 배치 수집 스크립트로 충분 |

**최종 컨테이너 목록 (7개, 노트북에서 동작)**
```
seaweedfs     S3 호환 오브젝트 스토리지 (Bronze)
mysql         파이프라인 데이터 저장 (Silver/Gold, 원본과 동일)
airflow       웹서버 + 스케줄러 (LocalExecutor, 브로커 불필요)
mock-api      청킹·엔리치먼트 FastAPI 목서버
ui-backend    모니터링 백엔드 (FastAPI: Airflow REST+MySQL 집계·SSE, lodestar 재사용)
postgres      모니터링 앱 상태 저장 (서비스 DB, lodestar db/init.sql 변형)
ui            모니터링 대시보드 (SvelteKit)
```
> **DB 분리**: 파이프라인 데이터는 **MySQL**(원본 Silver/Gold와 동일), 모니터링 서비스 앱 상태는 **PostgreSQL**(lodestar 백엔드 재사용). 서비스 DB ↔ 파이프라인 DB를 분리한다. (pgvector는 ES 임베딩이 MVP 이후라 MVP 서비스 DB엔 불필요.)
> ES(elasticsearch)는 팀 범위 밖이라 MVP 컨테이너에서 제외. 검색 시연이 필요해지면 미래 개선기능으로 추가한다.
> LocalExecutor를 택하면 Celery 브로커(Valkey)가 불필요하다. 원본의 CeleryExecutor + Valkey 6노드 구성은 Worker 분산·CDC 큐잉 용도이며 로컬 데모에는 과함.

### 4. 데이터 흐름 (재현 대상)

```
샘플 데이터 (현대차 스키마 기반 더미)
    ↓ [Python 수집 스크립트]
SeaweedFS Bronze (Parquet)
    ↓ [Airflow DAG] bronze_0_registration
MySQL 메타 등록
    ↓ [Airflow DAG] silver_1_structuring
MySQL silver (JSON 변환)
    ↓ [Airflow DAG] silver_2_masking
MySQL silver (PII 마스킹 — MVP: 정규식 / 풀 Presidio는 다음 계획)
    ↓ [Airflow DAG] gold_3_chunking (Mock API)
MySQL gold (청킹: 문단 분할)
    ↓ [Airflow DAG] gold_4_enrichment (Mock API)
MySQL gold (엔리치먼트: 요약·키워드·개체명)
    ↓ [Airflow DAG] gold_5_field_mapping
MySQL gold (es_field_info 부여 = 검색계 인수 준비 완료) ← 에뮬레이터 종착
    ↓
모니터링 UI (각 단계 문서 수 + 처리 상태)
```
> DAG 6개(Bronze→Silver→Gold: bronze_0/silver_1/silver_2/gold_3/gold_4/gold_5). 원본의 `gold_6` `es_indexing` + ES 적재는 팀 범위 밖이라 제외. Gold의 `es_field_info`는 "검색계가 인수할 수 있는 payload를 만들어 두는" 단계까지의 의미로 유지한다(실제 인덱싱은 안 함).

### 5. 모니터링 UI 범위

최종 목표는 **SvelteKit + @xyflow/svelte 독립 커스텀 대시보드**이되, 2티어 일정에 맞춰 **2단계로 나눠 구현**한다(1단계=Week1 MVP, 2단계=Week2 확장). 팀 시안 범위와 무관하게 시뮬레이터 전용으로 독립 구현한다(외부 UI 임베드에 종속되지 않음).

**1단계 — 뼈대 (Week 1 MVP, 빠른 데모 확보)**
- Airflow UI(DAG 실행 현황)를 그대로 활용해 파이프라인이 도는 것을 시연
- 단계별 문서 수는 MySQL 조회 최소 표시로 보완
- 목적: 커스텀 UI 없이도 "파이프라인이 흐른다"를 먼저 증명 → 일정 리스크 헤지

**2단계 — 커스텀 통합 대시보드 (Week 2 확장)**
- SvelteKit + @xyflow/svelte 읽기전용 단계 그래프 (Bronze/Silver/Gold 3레이어 · DAG 6개 노드)
- ui-backend(FastAPI)가 Airflow REST API + MySQL을 집계하고, 대시보드는 ui-backend를 조회 (DAG 실행 현황·단계별 카운트). 앱 자체 상태는 postgres(서비스 DB)에 보관
- 실시간 갱신은 SSE 패턴(lodestar `api.ts` 참조) 재사용
- lodestar 컴포넌트(`StatusPill`·`ProgressTrack`)·`DESIGN.md` 토큰 재사용

> 1단계는 2단계로 버려지지 않는다 — Airflow REST 연동·MySQL 카운트 쿼리는 2단계 대시보드가 그대로 흡수한다. 즉 뼈대→살붙이기 증분이다.
> 기술 스택 근거·재사용 자산: [lodestar-reuse-assessment.md](./lodestar-reuse-assessment.md)
> ※ ES 제외로 Kibana는 스택에서 빠짐(원래 Kibana는 ES 전용 UI).

### 6. 모듈화(pluggable 노드) 설계

각 노드(수집기·CDC·Airflow executor·청킹/엔리치 API·PII 엔진)를 미래에 다른 구현으로 **갈아끼울 수 있게** 설계한다. 원본 코드 실증 결과 성립하며, 핵심은 **계약(입출력)을 고정하고 구현만 교체**하는 3층 분리다.

**3층 분리**

| 층 | 역할 | 구현 |
|----|------|------|
| **계약층(고정)** | 노드 입출력을 계약으로 못박아 다운스트림이 구현 변화를 모르게 | Bronze 경로·Parquet 스키마·`row_hash` 규칙 / MySQL 단계 테이블 DDL / `detect_and_mask(text)` 시그니처 / DAG 트리거 conf(`change_operation` 등) |
| **구현층(교체)** | 계약만 지키면 자유 교체 | NiFi↔Python · Local↔Celery · 정규식↔Presidio · Mock↔실 API |
| **스위칭층(이미 설계됨)** | 노드 교체 = 토글 | 환경변수 + Docker Compose **profile** (§다음 계획 "설정 메뉴"의 7토글) |

**경계별 교체 판정 (원본 코드 실증)**

| 노드 경계 | 판정 | 교체를 가능케 하는 계약 |
|----------|------|------------------------|
| 수집기 (NiFi↔Python) | ✅ 용이 | SeaweedFS Bronze 경로 규칙 + Parquet 스키마 + `hash_utils` 중앙화 |
| Executor (Local↔Celery+Valkey/MySQL) | ✅ 용이 | 환경변수 `AIRFLOW__CORE__EXECUTOR`+`CELERY__*` (DAG는 TaskFlow라 코드 수정 0) |
| PII 마스킹 (정규식↔Presidio 2-Layer) | ✅ 용이 | `detect_and_mask(text)` 단일 진입점, `_create_nlp_engine()`만 교체 |
| CDC (Debezium↔배치) | ⚠ 조건부 | Debezium `op`(c/u/d/r)→`change_operation` **변환 어댑터 필요** |
| 청킹·엔리치 API (고객사↔Mock) | ⚠ 조건부 | 원본은 SQL 카탈로그로 대체·API DAG 미구현 → **호출 어댑터 신설 필요** |

**약한 2곳 보완 — 어댑터 레이어**

- **CDC 어댑터**: Debezium `op` → `change_operation`(snapshot/insert/update/delete) 정규화 어댑터를 둔다. 그러면 실시간(Debezium)·배치(NiFi/Python)가 **같은 Silver-1 트리거 conf 계약**을 노출 → Silver-1 이하는 수집 방식을 모른다.
- **API 어댑터**: 청킹·엔리치를 Airflow `@task`(또는 `HttpOperator`)로 캡슐화하고 `CHUNKING_API_URL`/`ENRICH_API_URL` 환경변수로 주입 + 요청/응답 **Pydantic 스키마 고정**. Mock↔실 API 스위칭이 URL 교체로 끝난다. Mock API 인터페이스를 처음부터 원본 API 스펙에 맞춰 설계하는 것이 관건.

**MVP에서 미리 심는 것 (나중 재작성 방지)**

- **PII 엔진 래퍼**: 원본은 Layer1+Layer2를 **항상 함께** 실행(enable 플래그 없음). `MASK=regex` 토글이 실제로 동작하려면 **Layer2(spaCy NER) off 스위치 래퍼를 MVP에서 신설**해야 한다 — 모듈화에서 유일하게 원본에 없어 새로 만드는 부분.
- **API 어댑터 경계**: MVP의 Mock API 호출을 처음부터 환경변수 URL로 구성(위 어댑터 계약 선점).
- **CDC 계약 선점**: MVP 배치 수집이 `change_operation` 필드를 계약으로 채워두면, 향후 Debezium 어댑터가 같은 필드를 채우는 것으로 교체 완료.

---

## 할 일

> **2티어 구조**: **MVP = Week 1 (1주 베이스라인)** — 파이프라인 코어가 흐르는 최소 완성본. **Week 2 = 확장 데모 (2주 목표)** — MVP보다 기능이 명확히 많아야 한다(커스텀 대시보드·설정 메뉴, 여유 시 검색 등 스트레치). "동작하는 MVP"를 1주 안에 확보한 뒤, 2주차에 기능을 얹는다.

### 이번 주말 전 (팀 시안 대비)

- [ ] 샘플 데이터 스키마 정의 — 현대차 스키마 기반 더미 데이터셋 설계
- [ ] Docker Compose 컨테이너 목록 최종 확정
- [ ] 에뮬레이터 기능 범위 한 문장 정의 (팀 시안 발표용)

### Week 1 — MVP (1주 베이스라인)

파이프라인 코어가 end-to-end로 흐르는 최소 완성본. 이 자체로 "파이프라인이 흐른다"를 시연할 수 있어야 한다.

- [ ] Docker Compose 기본 골격 구성 (MySQL, SeaweedFS, Airflow LocalExecutor)
- [ ] Python 수집 스크립트 (샘플 데이터 → SeaweedFS Parquet)
- [ ] Airflow DAG 단순화 버전 6개 (Bronze→Silver→Gold 흐름, **마스킹은 정규식**)
- [ ] Mock API 구현 (FastAPI, 청킹·엔리치먼트 단순 규칙 기반)
- [ ] **PII 엔진 래퍼** — Layer2(spaCy NER) on/off 스위치. `MASK=regex`면 Layer1(정규식)만 실행 (원본은 항상 2-Layer라 이 래퍼는 신규). §6
- [ ] **API 어댑터 경계** — 청킹·엔리치 DAG(gold_3/gold_4)가 Mock API를 환경변수 URL(`CHUNKING_API_URL`/`ENRICH_API_URL`)로 호출 (Mock↔실 API 무비용 교체 대비). §6
- [ ] **CDC 계약 선점** — 배치 수집이 `change_operation` 필드를 계약으로 채움 (향후 Debezium 어댑터가 동일 필드 재사용). §6
- [ ] 최소 상태 표시 (Airflow UI + MySQL 카운트 조회)
- [ ] 샘플 데이터 end-to-end 흐름 통합 테스트 (Bronze→Gold)

### Week 2 — 확장 데모 (MVP + 추가 기능)

MVP보다 기능이 많아야 한다. 커스텀 대시보드·설정 메뉴가 기본 확장이고, 일정 여유 시 스트레치 항목을 얹는다.

- [ ] 커스텀 통합 대시보드 — SvelteKit + @xyflow/svelte 읽기전용 단계 그래프 (§5 2단계)
- [ ] 설정 메뉴 구현 (feature-flag 뼈대 + 토글 UI) — 미구현 축은 "다음 계획" 배지로 노출. 아래 "설정 메뉴" 노트 참조
- [ ] 데모 시나리오 작성 (투입 → 단계 통과 → Gold 적재까지)
- [ ] 발표 자료 준비
- [ ] (스트레치, 여유 시) ES 검색 시연 — 데모 클라이맥스. 무거우면 "다음 계획"에 그대로 둔다

---

## 다음 계획 (MVP 이후, 범위 밖)

MVP는 LocalExecutor 단일 노드로 확정. 아래는 확장이 필요할 때의 후속 과제이며, **막다른 결정이 아니라 원본 운영계로 수렴하는 경로**임을 문서화해 둔다.

### CeleryExecutor 분산 전환

원본 운영계 구성(CeleryExecutor + Valkey 6노드)을 로컬에서 시연할 필요가 생기면 전환한다. DAG 코드는 그대로이고 인프라만 추가한다.

| 요소 | MVP(LocalExecutor) | Celery 전환 시 |
|------|--------------------|----------------|
| 브로커 | 없음 | valkey 컨테이너 추가 |
| result backend | — | 기존 MySQL 재사용 (원본과 동일) |
| 워커 | scheduler가 직접 실행 | `airflow celery worker` 컨테이너 분리 |
| 설정 | `EXECUTOR=LocalExecutor` | `EXECUTOR=CeleryExecutor` + `CELERY__BROKER_URL` + `CELERY__RESULT_BACKEND` |
| DAG 코드 | — | 변경 없음 |

- 전환 트리거: "실제 분산 워커 동작"이 데모 요구사항이 될 때.
- 되돌리기 쉬운 변경(compose 서비스 2개 + 환경변수 3개)이므로 MVP에서 미리 감당하지 않는다.

### 원본 구조 근접 복원 항목

MVP가 데모 목적으로 단순화한 요소들을, 필요 시 원본에 가깝게 되돌리는 후속 축. **각 항목은 MVP 스택을 교체하지 않고 옆에 붙이거나 스위칭하는 방식**이라 되돌리기 쉽다.

| 축 | 원본 | MVP 단순화 | 근접 복원 (MVP 이후) | 전환 트리거 | 재사용 자산 |
|----|------|-----------|---------------------|------------|------------|
| **수집기** | NiFi 3노드 클러스터 | Python 수집 스크립트 | NiFi + ZooKeeper 단일 노드 도입 (수집 단계 실물 재현) | 수집 흐름 자체가 시연 대상이 될 때 | 개인 `scripts/nifi/docker-compose.yml` (NiFi 2.8 + ZK 3.9.4) |
| **실시간 CDC** | Debezium + Valkey Stream (가동 중, ~2.4M건) | 미구현 (배치만) | Debezium Server + Valkey Stream 실시간 감지, 배치 수집과 병행 | "소스 변경 → 실시간 반영" 시연 요구 | 개인 CDC 3방식 가이드(SQL 포함) `docs/study/test_pipeline_1/` |
| **검색 서빙(ES)** | ES 3-master + 내장 ML 임베딩(E5) + BM25·Vector RRF 하이브리드 | **미구현 (Gold까지가 종착)** | ES 단일 노드 도입 → 인덱싱 → 임베딩 → RRF 하이브리드 검색 순으로 단계적 재현 | 검색이 데모 범위로 들어오거나 팀 범위가 확장될 때 | 원본 `docs/기술검토확정/13_벡터_임베딩/`, Gold의 `es_field_info` payload |
| **청킹·엔리치먼트** | 고객사 API (미오픈) | Mock API (규칙 기반) | 고객사 API 오픈 시 Mock ↔ 실 API 스위칭 (인터페이스 동일 유지) | 고객사 API 실제 오픈 | Mock API 인터페이스를 원본 API 스펙에 맞춰 설계해 두면 무비용 교체 |
| **PII 마스킹** | Presidio 2-Layer (정규식 + spaCy 한국어 NER) | 정규식만 (Layer 1) | 풀 Presidio(NER Layer 2) 추가 — 이름·주소 등 비패턴 PII | 마스킹 정밀도가 시연 포인트가 될 때 | 원본 `services/airflow/libs/structuring/pii/engine.py`. spaCy `ko_core_news_lg` ~0.5GB |
| **ES 다중 노드** | 3-master 클러스터 | 단일 노드 | ES 3-master로 확장 (HA·부하 분산 시연) | 고가용성/부하가 시연 대상이 될 때 | 낮은 우선순위 — 노트북 리소스 부담 큼 |

- 공통 원칙: **Mock API 인터페이스·DAG 태스크 경계를 원본과 동일하게 유지**하면, 위 교체가 파이프라인 로직 재작성 없이 컴포넌트 스왑으로 끝난다.
- 우선순위(원본 근접도·시연 가치 기준): 검색 서빙(ES) ≈ 실시간 CDC > NiFi 수집기 > ES 다중 노드.

### 설정 메뉴 (설계 노트)

> **주의**: 설정 메뉴 *자체*는 MVP 범위(Week 2)다. 다만 메뉴가 토글하는 *축들*이 대부분 "다음 계획"이라 이 섹션에 함께 문서화한다.

위 확장 축들을 UI에서 켜고 끄는 **설정 메뉴**를 둔다. 각 단순화 축 = 토글 하나로, 위 두 표(CeleryExecutor + 근접 복원 5축)와 **1:1로 대응**한다.

| 토글 | 스위치(값) | 기본값 | 대응 축 |
|------|-----------|--------|---------|
| Executor | `PROFILE=local\|celery` | `local` | CeleryExecutor 분산 전환 |
| 수집기 | `COLLECTOR=script\|nifi` | `script` | NiFi 수집기 |
| 실시간 CDC | `CDC=off\|on` | `off` | Debezium + Valkey Stream |
| 검색 서빙 | `SEARCH=off\|lite\|hybrid` | `off` | ES 인덱싱·임베딩·하이브리드 (Gold 이후) |
| 청킹·엔리치먼트 | `ENRICH=mock\|real` | `mock` | 고객사 API 스위칭 |
| PII 마스킹 | `MASK=regex\|presidio` | `regex` | 정규식(MVP) ↔ 풀 Presidio 2-Layer(다음 계획) |
| ES 노드 | `ES=single\|cluster` | `single` | ES 3-master (검색 서빙 on일 때만 유효) |

- **구현 시점: MVP Week 2 (범위 내)**. 설정 메뉴 UI + feature-flag 뼈대를 2주 내 구현한다. 각 단순화를 처음부터 **환경변수 + Docker Compose profile**로 구조화하므로, 설정 메뉴는 이 스위치를 **화면에 노출·적용만** 하면 되고 나중에 코드 재작성 없이 축이 붙는다.
- **MVP 시점 UI 상태**: MVP 종착이 Gold(MySQL)이므로 실제로 켜지는 토글은 기본값들뿐이다. 미구현 축(검색·NiFi·CDC 등)은 **비활성 + "다음 계획" 배지**로 노출해, 로드맵 자체를 데모에서 보여주는 용도로 쓴다.

---

## 미결 사항

| 항목 | 기한 | 비고 |
|------|------|------|
| 팀 내 1차 시안 내용 | 이번 주말 | 범위 변경 가능성 있음 |
| 샘플 데이터 | Week 1 착수 전 | **별도 계획서: [pipeline-emulator-sample-data-plan.md](./plan/pipeline-emulator-sample-data-plan.md)** (현대차 실데이터 사용 불가) |
| ~~모니터링 UI 기술 스택~~ **(결정)** | ~~Week 2 착수 전~~ | **SvelteKit + @xyflow/svelte(읽기전용 단계 그래프), 2단계 구현. §5 참조. 근거: [lodestar-reuse-assessment.md](./lodestar-reuse-assessment.md)** |
| ~~경량 임베딩 모델 확정~~ **(제외)** | — | **ES·임베딩은 팀 범위 밖 → 미래 개선기능으로 이관("다음 계획")** |

---

## 참고 소스

- 원본 파이프라인: `/Users/mz01-risingnrkim/workspace_mzd/hyundaimotor-lllm`
  - DAG 실물: `services/airflow/dags/` (`bronze_0_pdis_hub_registration`, `silver_1_pdis_structuring`, `silver_2_pdis_masking`, `gold_5_pdis_field_mapping_v0_6`, `gold_6_pdis_cft_indexing`)
  - Presidio 2-Layer 마스킹 엔진: `services/airflow/libs/structuring/pii/engine.py`
  - 임베딩 설계(ES ML 노드 내장 모델 전환): `docs/기술검토확정/13_벡터_임베딩/`
- 개인 스크립트: `/Users/mz01-risingnrkim/workspace_mzd/2026-01-21_hyundai` — **로컬 재현 자산 다수**
  - NiFi + Zookeeper 로컬 compose: `scripts/nifi/docker-compose.yml`
  - S3 로컬 테스트(MinIO) compose: `scripts/s3-test/docker-compose.yml` (에뮬레이터는 SeaweedFS로 교체 — 아래 주 참조)
  - CDC 3방식 구현 가이드(SQL 포함): `docs/study/test_pipeline_1/docs/06_news_cdc_pipeline_plan.md`
  - Airflow DAG 템플릿·스키마: `docs/etc/archive/18_Airflow_구축_완료보고서.md`
- 팀장 제시 레이크하우스 검토자료(개인, 미확정 - 팀 내 1차 시안 이번주말 예정으로, 기다리면 늦음): `/Users/mz01-risingnrkim/Downloads/files`

> **스토리지 선택 정합성**: 개인 스크립트는 로컬 S3로 MinIO를 썼으나, 이 에뮬레이터와 팀장 레이크하우스 자료(`03-기술결정-근거.md` 2-1·2-4)는 모두 **SeaweedFS**를 택한다. 사유: MinIO CE는 2026.4 아카이브(사실상 종료), Garage는 AGPL, LocalStack/s3mock은 실제 구현체와 동작 차이. 에뮬레이터의 SeaweedFS 채택은 팀 방향과 일치한다.
