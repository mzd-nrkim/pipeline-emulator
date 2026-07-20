# 데이터흐름도 실제 반영도 조사 (topology fidelity audit)

작성일: 2026-07-20
대상: `/real/pipeline` 페이지 → "데이터흐름" 뷰의 각 노드 상세 내용
목적: 데이터흐름도가 실제 인프라를 얼마나 정확히 반영하는지 대조, 수정 가능 영역 도출

---

## 1. 구조 이해 (중요 전제)

- 데이터흐름도의 노드·엣지·config 값은 **`frontend/src/lib/mock/topology.ts`의 `mockTopology` 고정 상수**다.
- `frontend/src/lib/api/real-adapter.ts:61-64`가 real 모드에서도 이 `mockTopology`를 그대로 반환한다 → **"real"이어도 토폴로지 내용은 실제 인프라 조회가 아니라 손으로 적은 값**이다.
- 노드 클릭 시 상세 패널의 필드 라벨/타입은 `frontend/src/lib/canvas/toolCatalog.ts`, **값은 노드 `config`**에서 온다.
- `topology.ts` 주석(3행): *"hyundaimotor-lllm 파이프라인 반영"* — **원래 목표(프로덕션) 아키텍처를 모사**한 것이며, 이 레포가 실제 실행하는 emulator 구현과 여러 지점에서 어긋난다.
- 어댑터 분기는 이미 깨끗하다: `frontend/src/routes/[mode=mode]/+layout.ts:6`이 `params.mode === 'real'`이면 `realAdapter`, 아니면 `mockAdapter`를 선택. 두 어댑터 모두 현재 `fetchCanvasTopology()`에서 동일한 `mockTopology`를 반환할 뿐이다.

---

## 2. 노드별 실제 반영도

근거: docker-compose.yml, dags/*.py, mock_api/routes/*, pii_engine/* 대조

| 노드 | 반영도 | 실제값 vs 표기 |
|------|--------|----------------|
| **node-debezium** | 🟢 정확 | connectorType=mysql, dbHost=mysql, port=3306, user=debezium, walMode=binlog — 전부 일치 |
| **node-seaweedfs** | 🟢 정확 | endpoint `http://seaweedfs:8333`, port 8333 일치 |
| **node-zookeeper** | 🟢 대체로 정확 | connectString `zookeeper:2181` 일치 |
| **node-mock-api** | 🟡 부분 | chunk/enrich URL·port 8000 정확. 단 `tool:'presidio'`는 오분류(enrichment임) |
| **node-airflow** | 🔴 불일치 | `dagId:'lllm_pipeline'` = 존재하지 않는 통합 DAG(실제는 개별 7개). `executor:'CeleryExecutor'`인데 실제 기본은 SequentialExecutor(Celery는 profile 옵션). 같은 파일 주석 54행 "SequentialExecutor라 valkey 의존 없음"과 자기모순 |
| **node-presidio** | 🔴 불일치 | `recognizers:'phone,email,rrn'` — 실제 정규식은 계좌번호(bank_account) 포함 4종. `nlpEngine:'spacy_ko'` 실제는 `ko_core_news_lg`. 기본 모드 `MASK=regex`라 presidio가 기본 아님 |
| **node-docling** | 🔴 불일치 | dagId=silver_1_structuring는 맞으나 구조화(RDB→JSON) 단계인데 config가 청킹 파라미터(chunkSize 512/overlap 64/parent-child). docling 실제 미사용, 값들 실제 하드코딩 없음 |
| **node-kure** | 🔴 불일치 | `modelPath:'kure-v1.onnx'`·`outputDim:768` — 실제는 KURE 아님(sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), 차원 384, 임베딩은 gold_3가 아니라 gold_6_es_indexing에서 수행 |
| **node-es** | 🔴 불일치 | `dagId:gold_5_field_mapping`는 staging만(실제 색인은 gold_6). `index:'lllm-docs'` 실제 `pdis_cft`. `mlNode:'ml-node-1'`은 single-node라 존재 안 함(허위) |
| **node-mysql** (Archive) | 🔴 불일치 | `database:'lllm_silver'`, `table:'processed_docs'` — 실제 DB는 `pipeline_emulator` 단일, 그런 테이블 없음 |
| **node-mysql-container** | 🟡 부분 | `database:'source_db'` — 실제 원본도 `pipeline_emulator` 단일 DB |
| **node-s3-bronze** | 🟡 부분 | `bucket:'lllm-bronze'` — 실제 버킷명 미명시, S3 key는 `pdis/pcqlty/rdb/...` |
| **node-dam** | ⚪ 가상 | DAM 컨테이너가 docker-compose에 아예 없음(가상 소스) |
| **node-nifi**, **node-valkey** | 🟡 예시값 | NiFi flow는 UI 구성이라 검증 불가한 예시값. valkey host/port는 일치 |

---

## 3. 구조적 갭

- **실제 ES 색인 DAG(gold_6_es_indexing)가 데이터흐름도에서 트리거 불가**: ui-backend `STAGE_DAG_MAP`에는 `node-es→gold_5`, `node-es-search→gold_6`가 있으나(`ui-backend/app/services/airflow.py:36-37`), 토폴로지엔 `node-es-search` 노드가 없다. 흐름도에서 node-es 트리거 시 실제 색인이 아닌 staging(gold_5)만 실행.
- fan-out `valkey→mysql` 엣지: 실제로 Airflow DAG가 MySQL에 직접 write하지, valkey 브로커가 mysql로 보내지 않는다.

---

## 4. 수정 가능 영역 (우선순위)

**높음 — 명백한 사실 오류**
1. `node-kure.outputDim` 768 → 384, modelPath를 실제 모델명으로
2. `node-es.index` `lllm-docs` → `pdis_cft`, `mlNode` 제거(허위)
3. `node-airflow.executor` CeleryExecutor → SequentialExecutor(주석과 정합)
4. `node-es`에 실제 색인 DAG(gold_6) 연결 또는 `node-es-search` 노드 추가

**중간 — 개념 혼동/누락**
5. `node-presidio.recognizers`에 계좌(bank_account) 추가, nlpEngine 실제 모델명
6. `node-docling` config의 청킹 파라미터를 구조화 성격에 맞게 정리
7. `node-mysql`/`node-mysql-container` DB명을 `pipeline_emulator`로

---

## 5. 방향 결정 (사용자 의사)

**모드별 토폴로지 분리** — sample(mock) 모드 = 이상(hyundaimotor-lllm 아키텍처, 현행 `mockTopology` 유지), real 모드 = 실제(docker-compose/DAG 실제값).

### 실현 가능성: 가능 (배선 이미 분리됨)
- `mock-adapter.ts` → 현행 `mockTopology`(이상) 유지
- 신규 `realTopology`(실제 emulator 값 반영) 작성 → `real-adapter.ts:fetchCanvasTopology()`가 이를 반환하도록 교체
- 이 방식이면 위 4번(높음)·중간 항목의 "실제값 교정"은 real 전용 `realTopology`에만 반영하면 되고, 이상 아키텍처 표현(KURE·docling·lllm 네이밍·dam)은 sample 모드에 온전히 보존된다.
- 정적 handwritten `realTopology.ts`로 시작하는 것이 저위험. (ui-backend가 docker-compose/DAG를 introspection하는 동적 방식은 백엔드 신규 작업 필요 — 과설계)

### 후속(미착수)
- 본 리포트는 조사 결과만 기록. topology 분리·값 교정 구현은 별도 plan에서.
