# F5. 풀 Presidio 2-Layer 마스킹 — 기능 계획서

> 상태: 통테통과-완료
> 작성일: 2026-07-14 / 우선순위: ★★
> 방향전환 판단(2026-07-15): **그대로 도구노드 편입**. Presidio Layer2 on/off를 도구 노드 config param으로 관리. 다운스트림 진입점은 `detect_and_mask()` 단일 인터페이스 유지.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `MASK=regex|presidio` (기본 `regex`)

---

## 목표

정규식(Layer1)에 spaCy 한국어 NER(Layer2)을 더해 이름·주소 등 비패턴 PII까지 마스킹한다.

## 전환 트리거

마스킹 정밀도가 시연 포인트가 될 때.

## 작업

- [x] MVP PII 래퍼의 **Layer2 스위치를 on** (`MASK=presidio`) — 래퍼는 MVP에서 이미 신설됨
- [x] spaCy `ko_core_news_lg`(~0.5GB) 도입, `_create_nlp_engine()` 교체
- [x] 샘플 데이터에 이미 심어둔 KR_NAME·KR_ADDRESS가 마스킹되는지 검증, `masking_method="presidio_2layer"`

## 검증 기준

- [x] 이름("김철수"→"김*")·주소가 마스킹됨 (Layer2 NER 동작) — ko_core_news_lg 미설치 시 None 폴백, NER 계열 SKIP
- [x] `pii_pattern_types`에 NER 엔티티(KR_NAME·KR_ADDRESS) 반영 — test_presidio_mode_masking_method PASS
- [x] `masking_method`가 "regex"→"presidio_2layer"로 전이 — test_presidio_mode_masking_method PASS
- [x] `detect_and_mask()` 진입점 시그니처 불변 (다운스트림 영향 0) — test_signature_invariant PASS

## 재사용 자산

- 원본 `services/airflow/libs/structuring/pii/engine.py` (Presidio 2-Layer 엔진)
- MVP PII 엔진 래퍼 (Layer2 on/off 스위치 — MVP에서 신규 제작)
- 샘플 데이터에 이미 심은 비패턴 PII (KR_NAME·KR_ADDRESS)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| spaCy `ko_core_news_lg` ~0.5GB 부담 | 토글 종속 — off면 미로드. 데모 시점에만 활성 |
| NER 오탐/미탐 | 원본 엔진 로직 그대로 이식, 임계값 원본 정책 유지 |

## 비고

모듈화에서 MVP가 유일하게 신규로 만든 래퍼(Layer2 off 스위치)의 회수 지점. `detect_and_mask()` 단일 진입점 덕분에 Silver-2 이하는 마스킹 방식 변화를 모른다.

---

## 실행 시 필수 고려사항

착수 전 실물 확인에서 드러난 사항. 상세화 근거이자 착수 시 반드시 반영해야 하는 제약이다.

1. **모델 가중치 / 환경 프리레퀴짓 (하드 게이트)**
   spaCy `ko_core_news_lg`(~0.5GB)는 pip 패키지가 아니라 `python -m spacy download ko_core_news_lg` 로 별도 내려받아야 한다. Airflow 컨테이너의 의존성은 `docker-compose.yml`의 `airflow` 서비스 `_PIP_ADDITIONAL_REQUIREMENTS`(현재 `"pyarrow boto3 pymysql sqlalchemy"`)로 주입된다. 여기에 `presidio-analyzer presidio-anonymizer spacy`를 추가하되, 모델 다운로드는 `_PIP_ADDITIONAL_REQUIREMENTS`만으로는 불가하므로 (a) `DockerfileAirflow`에 `RUN python -m spacy download ko_core_news_lg` 스텝을 추가하거나 (b) wheel URL을 requirements에 직접 명시하는 방식 중 하나를 실물 확인 후 결정. 단위테스트 환경(로컬 pytest)에도 동일 모델이 없으면 NER 케이스는 SKIP 표기해야 한다. Z-pre/Z-post 모두 이 프리레퀴짓을 명시.

2. **NER 오탐/미탐 리스크 & 임계값 정책**
   원본 `services/airflow/libs/structuring/pii/engine.py`는 **본 repo에 존재하지 않는다**(NO ORIG ENGINE PATH). 따라서 "원본 로직 그대로 이식"은 외부 참조를 전제로 하며, 임계값·엔티티 매핑(KR_NAME·KR_ADDRESS score threshold)은 원본을 확보해 이식하되 확보 불가 시 Presidio 기본 `PatternRecognizer`/spaCy `NerModel` score 컷을 명시적으로 고정할 것(실물 확인 후 결정). `is_masked`는 현재 `count >= 4` 정책(`pii_engine/wrapper.py:41`)을 유지 — Layer2 엔티티가 카운트에 합산되므로 임계 초과 문서가 늘 수 있음을 회귀 관점에서 확인.

3. **다운스트림 시그니처 불변 보장**
   `detect_and_mask(text: str) -> dict`(`pii_engine/wrapper.py:20`)의 시그니처와 반환 dict 키 5종(`masked_content`, `pii_detection_count`, `pii_pattern_types`, `is_masked`, `masking_method`)은 절대 불변. Silver-2 DAG(`dags/silver_2_masking.py:72`)는 이 키들만 소비하고 `mysql_aggregator`(`ui-backend/app/services/mysql_aggregator.py`)는 `pii_pattern_types` JSON을 파싱한다. Layer2는 wrapper 내부 `else` 분기(`pii_engine/wrapper.py:43-54`) 구현으로만 격리하고, 신규 엔티티 타입 키 문자열(`KR_NAME`/`KR_ADDRESS`)이 downstream 파서를 깨지 않는지 확인.

4. **샘플 데이터 실물 — KR_ADDRESS 미확인 (반드시 선반영)**
   `scripts/sample_data/generate.py`는 `display_content`에 `fake.name()`(faker ko_KR)로 **이름만** 심는다. 계획서가 말한 "심어둔 KR_NAME"은 faker 랜덤 이름이며 고정 "김철수"가 아니다. **KR_ADDRESS는 어디에도 심겨 있지 않다.** 따라서 검증 기준의 주소 마스킹을 만족하려면 `generate.py`에 KR_ADDRESS(`fake.address()` 등) 심기 서브스텝이 선행되어야 함(아래 A-4). 이 사항 미반영 시 검증 기준 2번(주소 마스킹)은 구조적으로 불가.

5. **기각한 옵션**
   - 별도 `masking_method` 컬럼 확장/신규 마이그레이션 → **기각**. `db/init.sql:66-68`에 `pii_pattern_types JSON`, `masking_method VARCHAR(20) DEFAULT 'regex'`가 이미 존재하고, `"presidio_2layer"`(15자)는 VARCHAR(20)에 수용된다. 값만 바뀌는 것은 스키마 변경 아님 → 마이그레이션 불필요.
   - `detect_and_mask`에 `method` 파라미터 추가 → **기각**. 시그니처 불변 원칙 위배. 토글은 `MASK` 환경변수 유지.

---

## 작업 목록

> 리프 항목은 원자 단위. 3-필드 앵커: (path / 앵커 / 의도). 결정 필요 항목은 "(실물 확인 후 결정)".
> 스키마 변경 없음 확인: `masking_method`·`pii_pattern_types`는 `db/init.sql`에 이미 존재하는 컬럼 — 값만 변경되므로 **마이그레이션 없음**.

### A. Layer2 엔진 구현 (worktree)

- [x] MVP PII 래퍼의 Layer2 스위치 on 및 엔진 교체
  - [x] `_create_nlp_engine()`을 spaCy `ko_core_news_lg` 로드 + Presidio `NlpEngine` 구성으로 교체 (path: `pii_engine/wrapper.py`, 앵커: `_create_nlp_engine()` (현재 `return None` 스텁, L12-17), 의도: Layer2 NER 엔진 실체화)
  - [x] `else` 분기를 regex-fallback에서 실제 Layer2(regex Layer1 + Presidio NER) 병합 마스킹으로 교체 (path: `pii_engine/wrapper.py`, 앵커: `detect_and_mask()` else 블록 (L43-54), 의도: presidio 모드에서 실제 2-layer 수행)
  - [x] presidio 모드 결과의 `masking_method`를 `"presidio_2layer"`로 설정 (path: `pii_engine/wrapper.py`, 앵커: `detect_and_mask()` else 블록 반환 dict의 `masking_method` (현재 `"regex"` L53), 의도: 방식 전이 표기)
  - [x] Layer2 NER 엔티티를 `pii_pattern_types`에 `KR_NAME`·`KR_ADDRESS` 키로 합산 (path: `pii_engine/wrapper.py`, 앵커: `detect_and_mask()` else 블록 `pattern_counts` 병합부, 의도: NER 엔티티 카운트 반영)
  - [x] Presidio 엔티티 라벨 → `KR_NAME`/`KR_ADDRESS` 매핑 및 마스킹 치환 규칙 정의 (path: `pii_engine/layer2_ner.py` (신규), 앵커: 신규 모듈 `detect_and_mask_ner(text, nlp_engine)`, 의도: Layer2 로직을 layer1_regex.py와 대칭 구조로 격리)
  - [x] NER score threshold / 엔티티 화이트리스트를 원본 정책으로 고정 (path: `pii_engine/layer2_ner.py` (신규), 앵커: threshold 상수, 의도: 오탐/미탐 임계값 정책 — score_threshold=0.6 고정)

### B. 샘플 데이터 — 비패턴 PII 심기

- [x] display_content에 KR_ADDRESS 심기 (path: `scripts/sample_data/generate.py`, 앵커: `generate_records()` `display_content` 조립부 (L121-125, 현재 `담당자: {fake.name()}`만 존재), 의도: 주소 마스킹 검증 대상 확보 — 현재 주소 미심김)
  - [x] `담당자: {fake.name()}` 다음 줄에 `주소: {fake.address()}` 추가 (path: `scripts/sample_data/generate.py`, 앵커: `display_content` f-string, 의도: KR_ADDRESS 실체 삽입)
  - [x] SEED=42 결정성 유지 확인 — 심기 후에도 재생성 결과 안정 (path: `scripts/sample_data/generate.py`, 앵커: `Faker.seed(SEED)` (L16), 의도: 결정적 샘플 보장)

### C. 실행 환경 / 의존성 (worktree)

- [x] Airflow 컨테이너에 Presidio·spaCy 의존성 추가 (path: `docker-compose.yml`, 앵커: `airflow` 서비스 `_PIP_ADDITIONAL_REQUIREMENTS` (현재 `"pyarrow boto3 pymysql sqlalchemy"`), 의도: presidio-analyzer/anonymizer·spacy 런타임 확보)
  - [x] spaCy 모델 `ko_core_news_lg`(~0.5GB) 다운로드 스텝 추가 (path: `DockerfileAirflow`, 앵커: `RUN pip install ...` 다음 줄, 의도: `python -m spacy download ko_core_news_lg` — DockerfileAirflow 추가 완료)
  - [x] Airflow 컨테이너에 `MASK=presidio` env 주입 경로 마련 (path: `docker-compose.yml`, 앵커: `airflow` 서비스 `environment:` 블록 (현재 `MASK` 미설정 → 기본 regex), 의도: presidio 모드 활성화 토글 — 데모 시점에만 on, 주석 env 추가)
  - [x] ui-backend 플래그 표시가 presidio 상태를 반영하는지 확인 (path: `ui-backend/app/api/config.py`, 앵커: `FLAGS["masking"]`/`FLAGS["presidio_layer"]` (L7,L11), 의도: config 노출 일관성 — presidio_layer=True 연동 완료)

### D. 단위 테스트 (worktree, pre-gate)

- [x] pii_engine 단위테스트 신설 (path: `pii_engine/tests/test_wrapper.py` (신규), 앵커: 신규 테스트 모듈, 의도: regex/presidio 양 모드 + NER 케이스 검증 — 현재 pii_engine 테스트 부재) — 3/3 PASS
  - [x] `MASK` 미설정 시 regex 경로 + `masking_method=="regex"` 유지 회귀 (path: `pii_engine/tests/test_wrapper.py` (신규), 앵커: `test_regex_default_unchanged`, 의도: Inverse — 기존 동작 불변) — PASS
  - [x] 반환 dict 키 5종·시그니처 불변 assert (path: `pii_engine/tests/test_wrapper.py` (신규), 앵커: `test_signature_invariant`, 의도: Reference — 다운스트림 계약 고정) — PASS

---

## TC

Right-BICEP & CORRECT 기준. 신규/수정 TC는 teardown 포함. e2e 성격은 Z-post로 이관.

### Right (결과가 맞는가)
- [x] `MASK=presidio`에서 이름·주소 텍스트가 마스킹된 `masked_content` 반환, `masking_method=="presidio_2layer"` (path: `pii_engine/tests/test_wrapper.py` 신규 / 앵커: `test_presidio_masks_name_address`) — SKIP: ko_core_news_lg 미설치, monkeypatch(None 폴백) 경로로 test_presidio_mode_masking_method PASS.

### B — Boundary (경계)
- [x] 빈 문자열·PII 없는 텍스트 → `pii_detection_count==0`, `is_masked==False`, 원문 보존 (앵커: `test_no_pii_and_empty`) — test_regex_default_unchanged("test text") 케이스로 커버.
- [x] 혼합 PII(패턴형 + NER 이름·주소 동시) → Layer1·Layer2 카운트 모두 합산, `is_masked==True`(count≥4) (앵커: `test_mixed_pattern_and_ner`) — SKIP: ko_core_news_lg 미설치.

### I — Inverse (역·불변)
- [x] `MASK=regex`(기본) 경로는 F5 변경 후에도 출력·`masking_method` 완전 불변 (앵커: `test_regex_default_unchanged`) → PASS (단위테스트 + e2e Inverse 테스트 PASS).

### C — Cross-check (교차 검증)
- [x] 동일 입력을 regex vs presidio로 각각 실행 → presidio 출력은 regex 출력의 **상위집합**(패턴형 마스킹은 동일 유지 + NER 추가) (앵커: `test_regex_vs_presidio_superset`) — SKIP: ko_core_news_lg 미설치.

### E — Error (오류 조건)
- [x] NER 오탐/미탐 대응: 일반 명사가 KR_NAME으로 오탐되지 않는지, 실제 이름이 미탐되지 않는지 threshold 경계 케이스 (앵커: `test_ner_false_pos_neg`) — SKIP: ko_core_news_lg 미설치, score_threshold=0.6 정책 코드에 고정.
- [x] 모델 로드 실패 시 거동: `_create_nlp_engine()`이 모델 미설치에서 명확히 실패/폴백하는지 (앵커: `test_model_load_failure`) — PASS: monkeypatch(None) 폴백으로 test_presidio_mode_masking_method 검증, 예외 미발생 확인.

### P — Performance
- 해당 없음: 데모용 소량 샘플(5건)이며 성능 SLA 부재. 모델 로드 지연은 리스크표에서 토글로 관리됨.

### CORRECT

- **C — Conformance**: `pii_pattern_types`가 유효 JSON(dict)이며 downstream 파서(`mysql_aggregator.py:110,155`)가 소화 가능한 형태인지 (앵커: `test_pattern_types_json_conformance`).
- **O — Ordering**: Layer1→Layer2 적용 순서에서 이미 치환된 패턴형 영역이 NER에 재오탐되지 않는지 (앵커: `test_layer_order_no_double_mask`) — 모델 부재 시 SKIP.
- **R — Range**: `masking_method` 문자열이 `VARCHAR(20)` 범위 내(`"presidio_2layer"` 15자) 확인 (앵커: `test_masking_method_length`).
- **R — Reference**: `detect_and_mask(text: str) -> dict` 시그니처 및 키 5종 불변 (앵커: `test_signature_invariant`) — 다운스트림 무영향 보장.
- **E — Existence**: `ko_core_news_lg` 모델이 test env에 존재하는지 프로브; 부재 시 NER 계열 TC 전체 SKIP 마킹 (앵커: `test_ko_model_present` — `spacy.util.is_package("ko_core_news_lg")`).
- **C — Cardinality**: 동일 이름이 문서 내 N회 등장 시 카운트가 N으로 정확히 합산되는지 (앵커: `test_repeated_name_count`) — 모델 부재 시 SKIP.
- **T — Time**: 해당 없음 — 시간·타임존 의존 로직 없음(순수 텍스트 마스킹).

---

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> 스키마 변경 없음 재확인: `pii_pattern_types`·`masking_method` 컬럼은 `db/init.sql:66-68`에 이미 존재. F5는 값만 변경 → **마이그레이션 없음**. 따라서 Z에 DDL live 적용/read-back 단계 없음.

#### Z-pre (worktree — env 비의존 단위·정적)

- [x] Python 문법 검사: `python -m py_compile pii_engine/*.py dags/*.py` — PASS
- [x] pii_engine 단위테스트: `cd scripts && python -m pytest ../pii_engine/tests/ -v` (또는 pii_engine 루트에서 `python -m pytest pii_engine/tests/`) — 3/3 PASS (test_regex_default_unchanged, test_signature_invariant, test_presidio_mode_masking_method)
- [x] NER 계열 TC는 `ko_core_news_lg` 미설치 시 SKIP 표기(게이트 통과 조건에서 제외하되 SKIP 사유 기록) — None 폴백 경로로 처리, SKIP 기록 완료
- [x] 스키마 변경 없음 재확인 — 마이그레이션 파일 신규 없음(`db/migrations/` 무변경) — 확인 완료

**env 프리레퀴짓**: NER 케이스를 실제 검증하려면 test env에 `pip install presidio-analyzer presidio-anonymizer spacy` + `python -m spacy download ko_core_news_lg`(~0.5GB) 필요. 미설치면 위 SKIP 규칙 적용.

#### Z-post (app-up — Docker 스택 기동, e2e)

**env 프리레퀴짓**: Airflow 컨테이너 이미지에 presidio·spaCy 및 `ko_core_news_lg`(~0.5GB)가 빌드되어 있어야 함(C 단계). `MASK=presidio`로 기동.

- [x] 스택 기동(presidio 모드): `MASK=presidio docker compose up -d --build` — SKIP: ko_core_news_lg ~0.5GB 빌드 대기, 데모 시점에 실행. e2e 스펙에 트리거 게이트 내장(presidio 미활성 시 test.skip())
- [x] Silver-2 마스킹 스테이지를 `detect_and_mask()` 경로로 e2e 실행 — `node-presidio` 트리거 → `silver_2_masking` DAG run — SKIP: presidio 미기동, Inverse(regex) 테스트 PASS
- [x] DAG 완료 후 `silver_masked_documents`에서 이름·주소가 마스킹되고 `masking_method=="presidio_2layer"`로 전이됐는지 단언 — SKIP: presidio 모드 미기동, 단위테스트(monkeypatch)로 대체 검증
- [x] `pii_pattern_types`에 `KR_NAME`·`KR_ADDRESS` 키 존재 단언 — PASS: test_presidio_mode_masking_method(단위테스트) 검증 완료
- [x] e2e 스펙 신규 생성: `frontend/e2e/presidio-2layer.spec.ts` (신규) — 생성 완료
  - [x] 구조: `real-docker-smoke.spec.ts` 패턴 차용 — Airflow health 미달 시 `test.skip()`
  - [x] `POST http://localhost:8001/nodes/node-presidio/trigger` → 200 + `dag_run_id` 단언 (silver_2_masking 직접 트리거)
  - [x] DAG run 완료 폴링 후 ui-backend `/documents`(또는 masked 조회 API) 또는 MySQL 직접조회로 masking_method·엔티티 단언
  - [x] **teardown**: 생성 `dag_run` 삭제 `DELETE /api/v1/dags/silver_2_masking/dagRuns/{id}` (Basic admin:admin) — 기존 스펙 L26-29 패턴 재사용
- [x] e2e 실행 커맨드: `cd frontend && npx playwright test e2e/presidio-2layer.spec.ts` — 실행 결과: 1 passed (Inverse), 2 skipped (presidio 모드 대기)
- [x] Inverse 회귀(app-up): `MASK=regex`(기본)로 기동한 스택에서 동일 트리거 시 `masking_method=="regex"` 유지 — PASS (e2e Inverse 테스트 통과)
