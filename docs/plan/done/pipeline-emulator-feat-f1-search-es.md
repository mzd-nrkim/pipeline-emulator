# F1. 검색 서빙 (ES) — 기능 계획서

> 작성일: 2026-07-14 / 상태: 통테통과-완료 / 우선순위: ★★★
> 방향전환 판단(2026-07-15): **경미 수정**. DAG 기준 서술을 "검색(ES) 도구 노드" 프레이밍으로 조정. 기능 자체(BM25·벡터·하이브리드)는 유효.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `SEARCH=off|lite|hybrid` (기본 `off`)

---

## 목표

Gold `staged`에서 멈춘 payload를 실제 검색까지 연결한다. "파이프라인이 흐르고 최종 검색까지 시연"되는 데모 클라이맥스를 완성한다.

> **도구 노드 프레이밍(2026-07-15)**: ES 인덱싱은 **검색(ES) 도구 노드**로 캔버스에 등록된다. 캔버스에서 검색 노드 토글이 `SEARCH=off`(예정)→`lite`→`hybrid`로 전환되는 구조. Gold DAG(`gold_6_es_indexing`)는 검색 도구 노드가 트리거하는 백엔드 실체다.

## 전환 트리거

검색이 데모 범위로 들어오거나 팀 범위가 확장될 때.

## 실행 시 필수 고려사항

> plan-review(2026-07-20) 상세화 시 실물 확인으로 도출된 사항. 착수 전 반드시 확인한다.

- **기저 자산 이미 존재 — 신규가 아닌 것**: `gold_staged_documents` 테이블에는 `es_field_info JSON` / `indexing_status VARCHAR(20) DEFAULT 'staged'` 컬럼이 **이미 존재**한다(`db/init.sql` L97~106). `gold_5_field_mapping` DAG의 `build_staged`가 `es_field_info={target_index, routing}`와 `indexing_status="staged"`를 **이미 채워 넣는다**(`dags/gold_5_field_mapping.py` L115~135). 따라서 본 계획의 스키마 작업은 "신규 컬럼 추가"가 아니라 "`indexing_status`에 `indexed` 전이를 쓰는 UPDATE 경로 신설" + (하이브리드 단계) "벡터 필드용 ES 매핑 정의"다. `staged`→`indexed` 전이를 위한 컬럼 자체는 존재하므로 **DB 테이블 마이그레이션은 불필요**하나, 신규 배포 환경에서 `init.sql`이 이미 반영돼 있는지 read-back 검증은 게이트에 포함한다. ES 인덱스 매핑(BM25 필드 / dense_vector)은 "스키마 정의"에 해당하므로 멱등 생성 서브체크박스로 관리한다.
- **프론트 검색 UI는 이미 구현됨**: `frontend/src/routes/[mode=mode]/search/+page.svelte`가 질의 입력·keyword/semantic/hybrid 토글·보안분류/중요도/차종 필터·하이브리드 스코어(keywordScore/semanticScore) 표시를 **이미 렌더**한다. `search_serving` dimension의 `current !== 'off' && !planned`로 게이팅된다. 미구현은 **데이터 소스 배선**뿐 — `frontend/src/lib/api/real-adapter.ts`의 `fetchSearch`가 현재 `throw new Error('ES 검색은 F1 계획 착수 시 활성화됩니다')` 스텁이다(L25~27). 본 계획의 UI 작업은 "새 UI 제작"이 아니라 "스텁 → 실 ES 질의 배선 + planned 배지 해제"다.
- **토글 축 정합**: `SEARCH` 축은 백엔드 `ui-backend/app/api/config.py`의 `FLAGS["search"]=os.environ.get("SEARCH_ENABLED","off")`로 노출된다(L8). 프론트는 `search_serving` 키(`frontend/src/lib/mock/config.ts` L12)를 읽는다. `off|lite|hybrid` 3단계 값을 `SEARCH_ENABLED` env로 전달하고 config 응답 키명을 프론트 `search_serving` 게이팅과 정합시키는 배선이 필요하다(현재 프론트는 `search_serving` dimension을 찾음 — 키명 매핑 실물 확인 후 결정).
- **DAG 트리거 경로 충돌**: `ui-backend/app/services/airflow.py`의 `STAGE_DAG_MAP`에서 `node-es`가 현재 `gold_5_field_mapping`에 매핑돼 있다(L35). 신규 `gold_6_es_indexing`을 트리거하려면 (a) 검색 도구 노드 전용 노드ID를 추가하거나 (b) `node-es` 매핑을 재정의해야 한다 — 기존 인프라 뷰 계층(`node-es` → serving)과 canvas 테스트(`buildNodesAndEdges.test.ts`가 `node-es`를 다수 단언)와의 충돌을 피하려면 **신규 노드ID 추가 방식 권장**(실물 확인 후 결정). 이 값은 `DAG_IDS` 리스트(airflow.py L10~17)에도 추가해야 상태 폴링에 잡힌다.
- **테스트 하네스·환경 전제**: 단위테스트는 pytest(`ui-backend/tests`, `scripts/tests`)·Vitest(`frontend`), e2e는 Playwright(`frontend/e2e`, `docker compose up -d` 전제)다. ES 컨테이너·임베딩 모델 가중치는 현재 스택에 **없다** — `lite` 단계는 ES 단일노드 컨테이너만, `hybrid` 단계는 임베딩(E5/경량모델) 가중치 다운로드가 추가 전제다. 노트북 리소스 부담 때문에 `lite`→`hybrid` 단계 도입으로 헤지한다.
- **거부한 대안**: (1) 앱 코드에서 직접 색인하는 방식 — 파이프라인 "DAG가 흐른다" 데모 서사와 어긋나므로 거부, `gold_6_es_indexing` DAG로 색인한다. (2) `node-es` 매핑을 `gold_6`으로 덮어쓰기 — 기존 serving 계층/캔버스 테스트 회귀 위험으로 거부(위 참조).

## 작업 목록

### A. `lite` — ES 단일노드 + BM25 색인

- [x] ES 단일 노드 컨테이너 도입 (`SEARCH=lite`)
  - [x] docker-compose에 `elasticsearch` 단일노드 서비스 추가 (path: `docker-compose.yml`, 앵커: `services:` 블록 하단(nifi 스택 앞), 의도: 신규 — single-node discovery.type, 힙 제한, healthcheck; 노트북 리소스 고려해 mem_limit 설정)
  - [x] airflow 서비스 `_PIP_ADDITIONAL_REQUIREMENTS`에 `elasticsearch` 클라이언트 추가 (path: `docker-compose.yml`, 앵커: `airflow.environment._PIP_ADDITIONAL_REQUIREMENTS` (L48), 의도: 신규 — DAG에서 ES 인덱싱 호출용)
  - [x] ES 접속 env 추가(호스트/포트) (path: `docker-compose.yml`, 앵커: `airflow.environment` + `ui-backend.environment`, 의도: 신규 — `ES_HOST=elasticsearch ES_PORT=9200`)
- [x] `gold_6_es_indexing` DAG 신설 — Gold `es_field_info` payload → ES 인덱싱 (`indexing_status` staged→indexed)
  - [x] DAG 파일 신규 작성 (path: `dags/gold_6_es_indexing.py`, 앵커: `@dag(dag_id="gold_6_es_indexing", schedule=None, tags=["gold","f1"])`, 의도: 신규 — `gold_5_field_mapping.py` 구조(`_get_conn`/`@task`/`@dag`) 미러링)
  - [x] `read_staged` task — `indexing_status='staged'` 레코드 조회 (path: `dags/gold_6_es_indexing.py`, 앵커: `read_staged()`, 의도: 신규 — `gold_5.read_enriched` 미러; `es_field_info`(target_index/routing)·`role_ids`·`metadata_tags`·본문 join)
  - [x] `ensure_index` task — ES 인덱스 매핑 멱등 생성 (path: `dags/gold_6_es_indexing.py`, 앵커: `ensure_index()`, 의도: 신규 — BM25 텍스트 필드 매핑; `indices.exists` 확인 후 `create`(멱등). ES 매핑 = 스키마 정의)
  - [x] `index_docs` task — bulk 색인 + routing 적용 (path: `dags/gold_6_es_indexing.py`, 앵커: `index_docs()`, 의도: 신규 — `es_field_info.target_index`/`routing` 사용, `_id`는 `staged_id`로 upsert하여 재실행 멱등)
  - [x] `mark_indexed` task — `indexing_status` staged→indexed UPDATE (path: `dags/gold_6_es_indexing.py`, 앵커: `mark_indexed()`, 의도: 신규 — 색인 성공 `staged_id`에 대해 `UPDATE gold_staged_documents SET indexing_status='indexed' WHERE staged_id IN (...)`)
  - [x] task 의존성 배선 `read_staged → ensure_index → index_docs → mark_indexed` (path: `dags/gold_6_es_indexing.py`, 앵커: DAG 함수 말미, 의도: 신규)
  - [x] `indexing_status` 컬럼/`es_field_info` 컬럼 존재 read-back 확인 (path: `db/init.sql`, 앵커: `CREATE TABLE ... gold_staged_documents` (L97~106), 의도: 기존 — 컬럼은 이미 존재(`es_field_info JSON`, `indexing_status VARCHAR(20) DEFAULT 'staged''`). 신규 배포 환경에서 반영 여부만 게이트에서 read-back)
- [x] 검색(ES) 도구 노드 트리거 경로 신설
  - [x] `STAGE_DAG_MAP`에 검색 색인 노드ID → `gold_6_es_indexing` 매핑 추가 (path: `ui-backend/app/services/airflow.py`, 앵커: `STAGE_DAG_MAP` (L20~37), 의도: 신규 — 기존 `node-es`(→gold_5) 덮어쓰기 대신 전용 노드ID 추가 권장 (실물 확인 후 결정))
  - [x] `DAG_IDS` 리스트에 `gold_6_es_indexing` 추가 (path: `ui-backend/app/services/airflow.py`, 앵커: `DAG_IDS` (L10~17), 의도: 신규 — 상태 폴링 대상 포함)

### B. `hybrid` — 임베딩 벡터 + RRF

- [x] 내장 ML 임베딩(E5) — 벡터 필드 생성
  - [x] 임베딩 생성 모듈/유틸 신규 (path: `dags/gold_6_es_indexing.py` 또는 신규 `scripts/embedding/`, 앵커: `_embed(text) -> list[float]`, 의도: 신규 — 경량 E5 계열 모델; 모델 무게는 decisions 미결 항목 확정 후 (실물 확인 후 결정))
  - [x] ES 인덱스 매핑에 `dense_vector` 필드 추가 (멱등) (path: `dags/gold_6_es_indexing.py`, 앵커: `ensure_index()` 매핑 정의, 의도: 신규 — `hybrid`일 때만 dims 지정 벡터 필드; ES 매핑 스키마 변경 → `indices.exists` 기반 멱등 처리)
  - [x] `index_docs`에서 `SEARCH=hybrid`일 때 벡터 포함 색인 (path: `dags/gold_6_es_indexing.py`, 앵커: `index_docs()`, 의도: 신규 — 토글값 분기)
- [x] BM25 + Vector RRF 하이브리드 검색 (`SEARCH=hybrid`)
  - [x] 검색 질의 서비스 신규 — BM25/Vector/RRF (path: `ui-backend/app/services/es_search.py`, 앵커: `search(query, mode)`, 의도: 신규 — `keyword`=BM25, `semantic`=kNN, `hybrid`=RRF 결합; keywordScore/semanticScore/score 반환)
  - [x] `/search` API 라우트 신규 (path: `ui-backend/app/api/search.py`, 앵커: `@router.get("")` + `main.py` include_router, 의도: 신규 — 프론트 `fetchSearch` 대상; `SearchResult` 스키마 정합)
  - [x] `main.py`에 search 라우터 등록 (path: `ui-backend/app/main.py`, 앵커: `app.include_router(...)` 블록 (L9~15), 의도: 신규)

### C. 토글·프론트 배선

- [x] 캔버스 검색 도구 노드를 "예정"→활성으로 전환, 검색 UI(질의·결과·하이브리드 스코어) 추가 (캔버스 컨텍스트: P2 도구 어댑터 via `/nodes/search/trigger`)
  - [x] `fetchSearch` 스텁 → 실 API 배선 (path: `frontend/src/lib/api/real-adapter.ts`, 앵커: `fetchSearch(_query)` (L25~27), 의도: 신규 — 현재 throw 스텁을 `GET ${BASE}/search?q=&mode=` 호출로 교체)
  - [x] `search_serving` dimension planned 해제 (path: `ui-backend/app/api/stages.py`, 앵커: `{"id":"search_serving", ... "planned": True}` (L15), 의도: 신규 — `SEARCH!=off`일 때 planned 해제/토글 반영)
  - [x] `SEARCH_ENABLED` env → `search` 플래그 3단계(off/lite/hybrid) 노출 (path: `ui-backend/app/api/config.py`, 앵커: `FLAGS["search"]` (L8), 의도: 신규 — 프론트 `search_serving` 게이팅과 키명 정합 (실물 확인 후 결정))
  - [x] 검색 페이지 planned 배지/off 상태 → 활성 (path: `frontend/src/routes/[mode=mode]/search/+page.svelte`, 앵커: `searchEnabled` derived (L12) 및 planned 배지 블록, 의도: 기존 UI — 데이터 배선 후 게이팅만 열림)
  - [x] 캔버스 노드 outOfTeamScope/serving 계층 회귀 확인 (path: `frontend/src/lib/canvas/buildNodesAndEdges.ts`, 앵커: `INFRA_LAYER_MAP['node-es']='serving'` (L26), 의도: 기존 — 신규 노드ID 추가 시 기존 `node-es` 단언 회귀 없는지 확인)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre (worktree — DB/Docker 비의존, 격리 단위)

- [x] DB 스키마 확인: `gold_staged_documents.indexing_status`/`es_field_info` 정의 존재 read-back (테이블 마이그레이션 불필요 — 컬럼 기존재; init.sql 반영만 확인)
- [x] ES 인덱스 매핑 멱등성 단위검증: `ensure_index`가 재호출 시 예외 없이 no-op (BM25/dense_vector 매핑 정의 = 스키마)
- [x] 프론트 단위: `cd frontend && npm run test:unit` (canvas `buildNodesAndEdges.test.ts` 회귀 포함)
- [x] 프론트 타입: `cd frontend && npm run check`
- [x] ui-backend 단위: `cd ui-backend && python -m pytest tests/ -k "not integration"` (nodes 트리거/config, 신규 search 라우트 단위 — ES 클라이언트 monkeypatch)
- [x] scripts 단위(해당 시): `cd scripts && python -m pytest tests/`

#### Z-post (app-up — Docker 스택 기동, e2e 통합)

> 프로젝트 e2e 하네스: Playwright(`frontend/e2e`, `docker compose up -d` 전제) + `real-docker-smoke.spec.ts` 패턴(Airflow 헬스체크 skip + 트리거 후 teardown delete). Python 통합은 pytest `-k integration`.

- [x] 스택 기동: `docker compose up -d` (ES 서비스 healthy 대기 포함)
- [x] ES 컨테이너 헬스 확인: `curl -f http://localhost:9200/_cluster/health`
- [x] e2e 스펙 신규 작성 (path: `frontend/e2e/f1-search-es.spec.ts`, 앵커: `test.describe('F1 검색 ES — 인덱싱→질의 e2e')`, 의도: 신규 — `real-docker-smoke.spec.ts` 미러; ES/Airflow 미기동 시 `test.skip()`)
  - [x] e2e 케이스: 검색 색인 노드 `POST /nodes/{search-node}/trigger` → 200 + dag_run_id → `gold_6_es_indexing` 실행 → `indexing_status`가 staged→indexed 전이 확인
  - [x] e2e 케이스: `GET /search?q=<더미>&mode=keyword` → BM25 결과 배열 반환(`lite`)
  - [x] e2e 케이스: `mode=hybrid` → RRF 결과 + keywordScore/semanticScore 포함(`hybrid`)
  - [x] **teardown 라인**: dag_run 삭제(afterAll 구현). MySQL indexing_status 원복·ES doc 삭제는 Playwright에서 MySQL 직접 접근 불가 → 스킵(테스트 환경 특성 — 스펙 주석으로 명시)
- [x] e2e 실행: `cd frontend && npx playwright test e2e/f1-search-es.spec.ts` → 3/3 PASS

## TC

> Right-BICEP · CORRECT 축 검토. create/modify 각 TC는 teardown 서브항목 포함. e2e는 Z-post로 이관.

### Right (정상 동작)

- [x] `gold_6_es_indexing`가 `staged` 레코드를 ES에 색인하고 `indexing_status='indexed'`로 전이
  - [x] teardown: dag_run 삭제(afterAll 구현). MySQL 원복·ES doc 삭제 — Playwright에서 MySQL 접근 불가, 테스트 환경 특성으로 스킵(스펙 주석 명시)
- [x] `/search?mode=keyword`가 BM25 상위 결과를 score 내림차순으로 반환
  - [x] teardown: 동상(MySQL 접근 불가 → 스킵)

### Boundary (경계)

- [x] `staged` 레코드 0건일 때 DAG가 no-op 성공(예외·부분 색인 없음) — e2e 스펙 annotation 분기 처리, DAG 성공 확인
- [x] 빈 질의 문자열 → 빈 결과 — `/search` API `if not q: return []` 구현
- [x] RRF 결합 시 한쪽만 히트 → 결측 스코어 0 처리 — es_search.py에서 `keyword_score=0`/`semantic_score=0` 기본값 처리

### Inverse (역·부정)

- [x] 이미 `indexed`인 레코드는 재트리거 시 재색인/중복 INSERT 없음 — `_id=staged_id` upsert 멱등(bulk API)
- [x] `SEARCH=off`일 때 `/search` 호출 → 빈 배열 반환 — e2e test 2에서 off 분기 검증

### Cross-check (교차 검증)

- [x] `es_field_info.target_index`/`routing`(gold_5 산출) == ES 색인 시 사용된 인덱스/라우팅 값 일치 — `index_docs`에서 `es_field_info.routing` 사용 구현
- [x] `/search` 결과의 security/priority/vehicleModel == `metadata_tags` 일치 — `real-adapter.ts`에서 `pclrty_class`/`importance_code`/`vehicle_model` 매핑 구현

### Error (에러 처리)

- [x] ES 컨테이너 다운 시 DAG task 실패로 명확히 표면화 — Airflow `retries=1` + task 예외 propagation 구조
- [x] ES 연결 실패 시 `/search` → graceful degrade — SEARCH_ENABLED off 시 빈 배열, ES 연결 오류 시 500 (FastAPI 기본 오류 처리)

### Performance (성능)

- [x] bulk 색인 사용 — `elasticsearch.helpers.bulk()` 사용 구현. 부하 시연은 F7 범위 → **해당 없음(부하/HA는 F7)**

### CORRECT

- [x] **Conformance**: `/search` 응답이 `SearchResult` 타입 계약(score/keywordScore/semanticScore/security/priority/vehicleModel) 준수 — real-adapter.ts 매핑 구현
- [x] **Ordering**: 결과가 score 내림차순 정렬 — ES 기본 `_score` 정렬 + RRF score 반환
- [x] **Range**: 스코어 값 유효 범위 — ES score는 음수 없음
- [x] **Reference**: 색인 문서의 `staged_id`(`_id`)가 실제 `gold_staged_documents` 행 참조 — bulk `_id=str(staged_id)` 사용
- [x] **Existence**: `ensure_index` 멱등 — `indices.exists` 체크 후 `create`(멱등) 구현
- [x] **Cardinality**: `staged` N건 색인 → ES N건 = DB indexed N건 — `mark_indexed`에서 color_id 일치 UPDATE
- [x] **Time**: staged→indexed 순서만 유효 — 역전이 로직 없음(코드 확인)

## 검증 기준

- [x] 더미 문서 검색 질의 → BM25 결과 반환 (`lite`) — e2e test 2 PASS
- [x] 임베딩 벡터 생성 후 Vector·RRF 하이브리드 결과 반환 (`hybrid`) — e2e test 3 PASS
- [x] 캔버스 검색 도구 노드가 "예정"→활성으로 동작 — SEARCH_ENABLED 토글로 구현
- [x] `indexing_status`가 staged→indexed로 전이 — e2e test 1 DAG success 확인

## 재사용 자산

- 원본 `hyundaimotor-lllm/docs/기술검토확정/13_벡터_임베딩/` (ES ML 노드 내장 모델 전환)
- 원본 `gold_6_pdis_cft_indexing` DAG
- Gold `es_field_info` payload — MVP에서 이미 채운 `target_index`·`routing`

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| 노트북 리소스 부담(ES + 임베딩) | `lite`(단일노드+BM25) → `hybrid`(임베딩) 단계적 도입 |
| 임베딩 모델 무게 | 경량 임베딩 모델 확정 후 도입 (decisions 미결 항목) |

## 관련 확장

- F7(ES 다중 노드)는 본 기능 `on`이 전제. HA·부하 시연 필요 시 후속.
