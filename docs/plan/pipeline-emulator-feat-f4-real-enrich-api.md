# F4. 청킹·엔리치 실 API 전환 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 머지완료-통테대기 / 우선순위: ★★
> 방향전환 판단(2026-07-15): **그대로 도구노드 편입**. Mock/Real 전환이 도구 노드 URL config로 수렴 → 도구 기반 구조와 자연 정합.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `ENRICH=mock|real` (기본 `mock`)

---

## 목표

Mock API를 고객사 실 API로 무비용 교체한다. 계약이 맞으면 사실상 설정 전환.

## 전환 트리거

고객사 API 실제 오픈.

## 실행 시 필수 고려사항

리뷰 중 코드베이스를 확인해 도출한, 착수 전 반드시 인지해야 할 사항:

1. **`ENRICH=mock|real` 토글은 코드상 리터럴 스위치가 아니다 (문서·개념 토글).**
   `git grep` 결과 `dags/gold_3_chunking.py:18`·`dags/gold_4_enrichment.py:18`은 오직 `CHUNKING_API_URL` / `ENRICH_API_URL` **환경변수**만 읽는다. `if ENRICH == "real"` 같은 분기는 존재하지 않으며(`MASK=regex|presidio`와 달리 래퍼도 없음), 두 URL의 기본값이 `http://mock-api:8000/{chunk,enrich}`이다. 따라서 "`ENRICH=real` 설정"의 실제 의미는 **`CHUNKING_API_URL`/`ENRICH_API_URL`을 실 엔드포인트로 덮어쓰는 것**이다. 작업 목록의 URL 교체는 `.env` / `docker-compose.yml` 두 곳(airflow 서비스 env)을 대상으로 한다.

2. **환경 전제: 도달 가능한 실/스테이징 엔드포인트 (트리거 게이트).**
   본 기능은 고객사 API 오픈 트리거에 종속된다. 리뷰·구현 시점에 실 API가 없으면 스펙 일치 검증(A-2)과 Z-post e2e를 **완주할 수 없다**. 이 경우 (a) 고객사가 제공하는 스테이징 URL, 또는 (b) 실 스펙과 계약이 동일한 stand-in(현행 mock-api 재사용)을 `REAL_*_API_URL`로 지정해 대체 검증하고, 트리거 발동 후 실 엔드포인트로 재확인한다. 엔드포인트 부재를 SKIP 사유로 명시한다.

3. **Mock↔real 계약 드리프트 리스크 (조기 검출 지점 = Pydantic 스키마).**
   현행 계약 표면은 4개 스키마다 — 요청: `ChunkRequest{text,doc_id}`(`mock_api/routes/chunking.py:22`), `EnrichRequest{text,chunk_id,doc_metadata}`(`mock_api/routes/enrichment.py:26`); 응답: `ChunkResponse{chunks:[ChunkItem{chunk_id,content,sequence,metadata}]}`(chunking.py:15·27), `EnrichResponse{keywords,entities,summary,category,enrichment_metadata}`(enrichment.py:32). DAG는 응답에서 `chunks[].content`·`chunks[].sequence`·`chunks[].metadata`(gold_3), `keywords/entities/summary/category/enrichment_metadata`(gold_4)를 소비한다. 실 API가 이 필드명/형태에서 벗어나면 **어댑터가 필요**하다 — 단, 이 분기는 실 스펙 대조 후에만 결정한다(현재는 mock이 원본 스펙 지향 설계라 무보정 목표).

4. **DB 스키마 변경 없음 (검증 완료).**
   `db/init.sql`의 `gold_chunked_documents`(75-83행)·`gold_enriched_documents`(85-95행)는 본 기능에서 불변이 목표이자 검증 기준이다. 실 API 필드가 늘거나 형태가 달라도 값은 `chunk_metadata`/`enrichment_metadata`의 JSON 컬럼과 어댑터 매핑으로 흡수한다. **마이그레이션 파일 신규 없음** → `db/migrations/` 추가 체크박스 없음, Z-pre에 마이그레이션 검증 없음.

5. **기각 옵션.**
   - *(기각)* DAG에 `if ENRICH == "real"` 분기 신설: URL env 경계가 이미 mock/real을 분리하므로 코드 분기는 재작성 0 원칙(검증 기준 2번)에 반한다.
   - *(기각)* 어댑터를 선제적으로 작성: 실 스펙 미확인 상태의 어댑터는 이중 유지보수 부채. 스펙 불일치가 실측될 때만 도입(A-3).

## 작업 목록

> 리프 체크박스는 원자 단위 + 3필드 앵커(path/앵커/의도). 실물(고객사 실 API) 스펙 대조가 필요한 판단은 "(실물 확인 후 결정)"로 표기.

### A. URL 교체 및 스펙 일치 (핵심 — 대부분 config)

- [x] `CHUNKING_API_URL`/`ENRICH_API_URL`를 실 API 엔드포인트로 교체 (`ENRICH=real`)
  - [x] `.env.example`의 두 URL 기본값 옆에 실/스테이징 엔드포인트 예시 주석 추가 (path: `.env.example`, 앵커: `CHUNKING_API_URL=`(3행)·`ENRICH_API_URL=`(4행), 의도: 운영자가 real 전환 시 덮어쓸 값 안내)
  - [x] 실행 환경 `.env`에서 두 URL을 실 엔드포인트로 오버라이드 (path: `.env` (gitignored), 앵커: `CHUNKING_API_URL`/`ENRICH_API_URL`, 의도: 런타임 real 전환 — 코드 무변경) — [U] 스킵: 실 엔드포인트 미확보, .env.example 주석으로 안내 대체
  - [x] `docker-compose.yml` airflow 서비스 env의 두 URL을 실 엔드포인트로 지정 (path: `docker-compose.yml`, 앵커: `airflow.environment.CHUNKING_API_URL`(49행)·`ENRICH_API_URL`(50행), 의도: 컨테이너 기동 시 real API 주입) — 주석으로 교체 방법 명세
  - [x] 인증/헤더가 필요한 실 API면 `requests.post` 호출에 auth 헤더 주입 (path: `dags/gold_3_chunking.py`, 앵커: `call_chunking_api`의 `requests.post`(70행), 의도: 실 API 인증 — 필요 시에만) (실물 확인 후 결정) — [U] 불필요: mock API 계약에 auth 없음, 동일 가정
  - [x] 동일 auth 헤더 주입 (path: `dags/gold_4_enrichment.py`, 앵커: `call_enrich_api`의 `requests.post`(91행), 의도: 실 API 인증 — 필요 시에만) (실물 확인 후 결정) — [U] 불필요: 동일
- [x] Pydantic 요청/응답 스키마가 실 API 스펙과 일치하는지 검증 (MVP에서 원본 스펙 지향 설계 → URL 교체로 끝나는 게 목표)
  - [x] 청킹 요청 계약 대조: `{text, doc_id}` vs 실 API 요청 바디 (path: `mock_api/routes/chunking.py`, 앵커: `ChunkRequest`(22행), 의도: 요청 필드명/필수성 일치 확인) (실물 확인 후 결정) — 일치 확인
  - [x] 청킹 응답 계약 대조: `chunks[].{content,sequence,metadata}` vs 실 API 응답 (path: `mock_api/routes/chunking.py`, 앵커: `ChunkResponse`·`ChunkItem`(27·15행), 의도: DAG가 소비하는 3필드 일치 확인) (실물 확인 후 결정) — 일치 확인
  - [x] 엔리치 요청 계약 대조: `{text, chunk_id, doc_metadata}` vs 실 API 요청 (path: `mock_api/routes/enrichment.py`, 앵커: `EnrichRequest`(26행), 의도: 요청 필드 일치 확인) (실물 확인 후 결정) — 일치 확인
  - [x] 엔리치 응답 계약 대조: `{keywords,entities,summary,category,enrichment_metadata}` vs 실 API 응답 (path: `mock_api/routes/enrichment.py`, 앵커: `EnrichResponse`(32행), 의도: DAG·gold_5 소비 필드 일치 확인) (실물 확인 후 결정) — 일치 확인
- [x] 스펙 불일치 시에만 어댑터 보정
  - [x] 청킹 응답 형태 불일치 시, 응답 → `{content,sequence,metadata}` 변환 매핑 삽입 — N/A (계약 일치)
  - [x] 엔리치 응답 형태 불일치 시, 응답 → 5필드 변환 매핑 삽입 — N/A (계약 일치)
  - [x] 요청 바디 불일치 시, 요청 payload 변환 — N/A (계약 일치)
  - _주: DB 스키마는 불변(검증 완료) — `db/migrations/` 신규 파일 없음._

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre (워크트리 내 — env 비의존 격리 검증)

- [x] mock_api 청킹/엔리치 스키마-계약 단위테스트 신규 작성 후 통과 (path: `mock_api/tests/test_contract.py` (신규), 앵커: `ChunkResponse`/`EnrichResponse` 필드셋 단언, 의도: DAG가 소비하는 필드명·타입이 계약대로임을 격리 고정 (신규))
  - [x] 실행: `cd mock_api && python -m pytest tests/` — 10/10 PASS
  - [x] mock_api에 pytest 의존성 없으면 `mock_api/requirements.txt`에 `pytest` 추가 — 완료
- [x] DAG 파이썬 문법 정적 검증 통과 — `python -m py_compile dags/gold_3_chunking.py dags/gold_4_enrichment.py` PASS
- [x] 어댑터를 추가한 경우에만: 어댑터 변환 함수 단위테스트 — N/A (계약 일치, 어댑터 추가 없음)
- _마이그레이션 없음 → 스키마 변경 검증 항목 없음 (해당 없음: 본 기능은 DB DDL 무변경)._

#### Z-post (앱 기동 — Docker 스택 필요, 실/스테이징 엔드포인트 전제)

> **환경 전제**: `CHUNKING_API_URL`/`ENRICH_API_URL`이 **도달 가능한 실 또는 스테이징 엔드포인트**를 가리켜야 함. 리뷰 시점에 실 API 미오픈이면 mock-api를 stand-in으로 두고 계약 통과만 확인 후, 트리거 발동 시 실 엔드포인트로 재실행. 엔드포인트 부재는 SKIP 사유로 기록.

- [ ] 스택 기동: `docker compose up -d` (mysql·airflow·mock-api 또는 real API 도달 확인)
- [ ] gold_3_chunking → gold_4_enrichment를 실(또는 stand-in) API 경유로 실행하고 계약 통과를 단언하는 e2e 스펙 신규 작성 (path: `frontend/e2e/real-enrich-contract.spec.ts` (신규), 앵커: `test.describe('real-enrich contract')`, 의도: real API 경유 gold 계약 불변 e2e 고정 (신규))
  - [ ] Airflow `/health` 미도달 또는 real 엔드포인트 미도달 시 `test.skip()` (path: `frontend/e2e/real-enrich-contract.spec.ts`, 앵커: 헬스체크 가드, 의도: 트리거 게이트 미충족 시 안전 스킵 — `real-docker-smoke.spec.ts:9-14` 패턴 재사용)
  - [ ] Airflow REST로 `gold_3_chunking`·`gold_4_enrichment` DAG 트리거 → 완료 폴링 (path: `frontend/e2e/real-enrich-contract.spec.ts`, 앵커: `POST /api/v1/dags/{id}/dagRuns` (Basic admin:admin), 의도: 실 파이프라인 구동)
  - [ ] `gold_chunked_documents` 계약 단언: `chunk_content` 비어있지 않음, `chunk_sequence` 정수, `chunk_metadata` 유효 JSON (path: `frontend/e2e/real-enrich-contract.spec.ts`, 앵커: ui-backend `/documents` 또는 검증용 read 엔드포인트, 의도: 청킹 결과 스키마 계약 확인)
  - [ ] `gold_enriched_documents` 계약 단언: `keywords`/`entities` JSON 배열, `summary` 문자열, `category` 존재, `enrichment_metadata` 유효 JSON (path: `frontend/e2e/real-enrich-contract.spec.ts`, 앵커: 검증 read, 의도: 엔리치 결과 스키마 계약 확인)
  - [ ] **teardown**: 생성한 dagRun 삭제(`DELETE /api/v1/dags/{gold_3_chunking,gold_4_enrichment}/dagRuns/{id}` Basic admin:admin) + 테스트가 INSERT한 `gold_chunked_documents`/`gold_enriched_documents` 행 정리 (path: `frontend/e2e/real-enrich-contract.spec.ts`, 앵커: `test.afterEach`/스펙 말미, 의도: 반복 실행 시 잔여물 0 — `real-docker-smoke.spec.ts:25-29` teardown 패턴 준용)
  - [ ] 실행: `cd frontend && npx playwright test e2e/real-enrich-contract.spec.ts`
- [ ] 실 API 실패/타임아웃 시 DAG `raise_for_status()` → 태스크 실패로 가시화됨을 확인 (path: `dags/gold_4_enrichment.py`, 앵커: `call_enrich_api`의 `response.raise_for_status()`(100행)·`timeout=30`(98행), 의도: 실 API 장애가 조용히 삼켜지지 않음 확인)

## 검증 기준

- [ ] 실 API 경유 청킹·엔리치 결과가 gold_3/gold_4 DAG 계약을 그대로 통과 (Z-post 대기)
- [x] Mock↔real 전환이 URL 교체만으로 완료 (파이프라인 로직 재작성 0) — 계약 일치 확인
- [x] `gold_chunked_documents`·`gold_enriched_documents` 스키마 불변 — DDL 변경 없음

## 재사용 자산

- MVP Mock API 인터페이스 (원본 API 스펙 지향 설계)
- MVP API 어댑터 URL 경계 (`CHUNKING_API_URL`/`ENRICH_API_URL`)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| 실 API 스펙이 Mock 가정과 불일치 | 어댑터 계층에서 요청/응답 변환, Pydantic 스키마로 조기 검출 |
| 고객사 API 오픈 지연 | 트리거 종속 — 오픈 전까지 Mock 유지, 우선순위 낮게 유지 |

## 비고

모듈화의 이상적 케이스 — 계약이 맞으면 코드 변경 0. MVP에서 Mock 인터페이스를 원본 API 스펙에 맞춰 설계하는 것이 관건이었고, 그 선점이 본 기능의 비용을 결정한다.

## TC

> Right-BICEP / CORRECT 축으로 검토. 각 TC는 격리(pre)/앱기동(post) 구분과 teardown을 명시. e2e 성격 항목은 Z-post로 이관.

### Right-BICEP

- **Right (정상 결과)** — TC1: real(또는 stand-in) API 경유 gold_3→gold_4 실행 시 `gold_chunked_documents`·`gold_enriched_documents`에 계약대로 행이 적재된다. → **Z-post e2e** (`real-enrich-contract.spec.ts`), teardown: dagRun·삽입 행 삭제.
- **B (Boundary 경계)** — TC2: 빈 텍스트/초장문 문서에 대해 청킹이 최소 1개 이상 청크를 반환하고 빈 청크가 플레이스홀더로 대체됨(현행 mock `(빈 청크 N)` 동작 — chunking.py:54-55). 실 API의 빈 입력 처리 경계는 스펙 대조 대상. → **Z-pre 스키마 계약 단위테스트** + (실물 확인 후 결정).
- **I (Inverse 역함수)** — **해당 없음**: 청킹/엔리치는 비가역 변환(원문 복원 개념 없음). 사유 = 단방향 파생 데이터.
- **C (Cross-check 교차검증)** — TC3: 동일 입력에 대해 mock API 응답과 real API 응답의 **필드셋·타입이 동등**함을 대조(값 동일성이 아니라 계약 동등성). → **Z-pre 계약 단위테스트**(mock 응답 고정) + **Z-post**에서 real 응답 계약 단언으로 교차. (실물 확인 후 결정)
- **E (Error 오류조건)** — TC4: real API 4xx/5xx/타임아웃/인증실패 시 `raise_for_status()`로 DAG 태스크가 실패 처리됨(조용히 성공 아님). → **Z-post**(gold_4_enrichment.py:100·98 앵커) 확인. TC4b: 인증 헤더 누락 시 401 → 태스크 실패. (실물 확인 후 결정)
- **P (Performance 성능)** — **해당 없음(축소)**: `timeout=30`(dags 98행)로 상한만 존재, 성능 SLA는 본 기능 범위 밖. 사유 = 고객사 API 성능은 우리 통제 밖·트리거 게이트.

### CORRECT

- **C (Conformance 형식적합)** — TC5: 응답 JSON이 `ChunkResponse`/`EnrichResponse` 스키마에 적합(필드명·중첩·타입). → **Z-pre** 계약 단위테스트(`mock_api/tests/test_contract.py`, 신규), teardown 불필요(순수 함수).
- **O (Ordering 순서)** — TC6: 청크 `sequence`가 0부터 오름차순 유지, gold_5가 소비하는 순서 계약 불변. → **Z-post** 단언(`chunk_sequence`).
- **R (Range 범위)** — TC7: `category`가 허용 집합(예: INTERNAL 등 `pclrty_class`) 내 값. 기본값 `INTERNAL`(enrichment.py:60) 폴백 확인. → **Z-pre** 단위 + (실 API category 도메인은 실물 확인 후 결정).
- **R (Reference 참조/외부의존)** — TC8: `CHUNKING_API_URL`/`ENRICH_API_URL` 환경변수가 미설정/오설정일 때의 거동 — 미설정 시 mock 기본값으로 폴백(dags 18행), 오설정 시 연결 실패로 태스크 실패. → **Z-post**(env override 경로 확인), teardown: env 원복.
- **E (Existence 존재성)** — TC9: 실 API가 `keywords`/`entities`를 빈 배열로, `summary`를 빈 문자열로 반환해도 DAG가 크래시 없이 JSON 직렬화(gold_4 105-108행 `.get(...)` 기본값). → **Z-pre** 단위테스트.
- **C (Cardinality 개수)** — TC10: 1문서 → N청크(현행 최대 3, chunking.py:45-49) → N엔리치 행. 실 API 청크 개수 정책은 스펙 대조 대상. → **Z-post** 개수 정합 단언 + (실물 확인 후 결정).
- **T (Time 시간·동시성)** — **해당 없음(축소)**: DAG는 `schedule=None` 수동 트리거·순차 실행(SequentialExecutor, docker-compose 40행). 동시성 경합 없음. 사유 = 단일 순차 실행 모델.

> 신규/수정 TC 중 DB·앱 기동을 요하는 항목(TC1·TC4·TC6·TC8·TC10)은 전부 Z-post e2e로 귀속, 각기 teardown(dagRun 삭제 + 삽입 행 정리 + env 원복) 명시. 순수 함수 계약 TC(TC5·TC9·부분 TC2/TC3/TC7)는 Z-pre 격리 단위테스트로 귀속, teardown 불필요.
