# 도구 API 전수조사표

> 작성일: 2026-07-15  
> 대상 프로젝트: pipeline-emulator (로컬 데모 환경)  
> "런타임 설정 가능" 기준: ui-backend가 직접 해당 도구의 API를 호출해 변경 가능한 것

---

## 도구별 설정 API

| 도구 | 엔드포인트 | 런타임 변경 가능 파라미터 | 이 프로젝트 지원 여부 | 비고 |
|------|-----------|----------------------|---------------------|------|
| Airflow | `PATCH /api/v1/dags/{dag_id}` | `is_paused` | ✅ 구현됨 | `set_paused()` via ui-backend nodes.py |
| Airflow | `PATCH /api/v1/variables/{key}` (404 시 POST) | `key`, `value` (임의 Variable) | ✅ 구현됨 | `set_variable()` via ui-backend nodes.py |
| Airflow | `POST /api/v1/dags/{dag_id}/dagRuns` | `conf` (DagRun 실행 파라미터) | ✅ 구현됨 | `trigger_dag()` via ui-backend nodes.py — trigger 엔드포인트 |
| Debezium | `POST /connectors` / `PUT /connectors/{name}/config` | connector config 전체 | ❌ 미구현 | Kafka Connect REST API 존재하나 ui-backend에 구현 없음 |
| NiFi | `PUT /nifi-api/processors/{id}` | processor config, scheduling | ❌ 미구현 | NiFi REST API v2 존재하나 ui-backend에 구현 없음 |
| Presidio | `POST /analyze` | `recognizers`, `language`, `score_threshold`, `return_decision_process` | ❌ 미구현 | 요청 파라미터 레벨 변경만 가능; ui-backend 연동 없음 |
| Docling | 재기동 필요 | `chunk_size`, `chunk_overlap`, `strategy` 등 | ❌ 미구현 | REST API 없음; 파이썬 라이브러리 직접 호출 — 재시작 필요 |
| KURE (ONNX) | 재기동 필요 | `model_path`, `output_dim`, `batch_size`, `device`, `precision` | ❌ 미구현 | ONNX 런타임 로드 시 확정 — 재기동 없이 변경 불가 |
| Valkey | `CONFIG SET` (Redis 호환 명령) | `maxmemory`, `maxmemory-policy` 등 | ❌ 미구현 | Redis 호환 CONFIG SET 명령 가능하나 ui-backend 연동 없음 |
| Elasticsearch | `PUT /{index}/_settings` | `number_of_replicas`, `refresh_interval` 등 | ❌ 미구현 | ES REST API 존재하나 ui-backend에 구현 없음 |
| MySQL | DDL/DML 직접 | 스키마, 인덱스 등 | ❌ 미구현 | 런타임 변경 불가 (DDL 필요); ui-backend 연동 없음 |
| DAM (외부 API) | 외부 서비스 API | `endpoint`, `apiKey` 등 | ❌ 미구현 | 외부 서비스 — ui-backend 내 설정 저장만 가능 |
| Kibana | `POST /api/saved_objects/dashboard` 등 | `refreshInterval`, `dashboardId` 등 | ❌ 미구현 | Kibana REST API 존재하나 ui-backend에 구현 없음 |
| S3 | AWS SDK / presigned URL | `bucket`, `prefix`, `region` 등 | ❌ 미구현 | AWS SDK 통해 접근 가능하나 ui-backend 연동 없음 |

---

## configField applyMode 분류

> applyMode 정의:
> - `runtime` : ui-backend가 해당 도구 API를 직접 호출하여 재기동 없이 적용 가능
> - `restart` : 컨테이너/프로세스 재기동 후 적용 (설정 파일 또는 환경변수 변경)
> - `code` : DAG 코드·파이프라인 정의 내에 하드코딩 — 코드 변경 필요
> - `readonly` : 이 프로젝트에서 변경 불가 (외부 시스템 종속 또는 미구현)

### apache-nifi

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `connectionPool` | 연결 풀 | readonly | NiFi REST API 미구현; 로컬 데모에서 NiFi 직접 호출 없음 |
| `sqlQuery` | SQL 쿼리 | readonly | Processor 속성 — NiFi REST API 미구현 |
| `inputDir` | 입력 디렉토리 | readonly | Processor 속성 — NiFi REST API 미구현 |
| `fileFilterRegex` | 파일 필터 정규식 | readonly | Processor 속성 — NiFi REST API 미구현 |
| `outputFormat` | 출력 형식 | readonly | Processor 속성 — NiFi REST API 미구현 |
| `schedulingStrategy` | 스케줄링 전략 | readonly | NiFi Processor 스케줄링 — REST API 미구현 |
| `batchSize` | 배치 크기 | readonly | Processor 속성 — NiFi REST API 미구현 |
| `maxConcurrentTasks` | 최대 동시 작업 | readonly | NiFi Processor concurrentTasks — REST API 미구현 |

### debezium

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `connectorType` | 커넥터 유형 | readonly | Kafka Connect connector 생성 시 확정 — 변경 불가 |
| `dbHost` | DB 호스트 | readonly | Kafka Connect config — ui-backend 연동 없음 |
| `dbPort` | DB 포트 | readonly | Kafka Connect config — ui-backend 연동 없음 |
| `dbUser` | DB 사용자 | readonly | Kafka Connect 인증 — ui-backend 연동 없음 |
| `walMode` | WAL 모드 | readonly | DB 레벨 설정 (binlog/pgoutput) — 재기동 필요 |
| `dbPassword` | DB 비밀번호 | readonly | Kafka Connect 인증 — ui-backend 연동 없음 |
| `serverName` | 서버 이름 | readonly | Kafka Connect config — ui-backend 연동 없음 |
| `tableIncludeList` | 포함 테이블 목록 | readonly | Kafka Connect config — ui-backend 연동 없음 |
| `offsetStorageTopic` | 오프셋 저장 토픽 | readonly | Kafka Connect config — ui-backend 연동 없음 |

### dam

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `endpoint` | 엔드포인트 | readonly | 외부 DAM 서비스 URL — ui-backend 내 설정 저장만 |
| `filePath` | 파일 경로 | readonly | 외부 서비스 파일 경로 — ui-backend 연동 없음 |
| `outputFormat` | 출력 형식 | readonly | 외부 API 요청 파라미터 — ui-backend 연동 없음 |
| `apiKey` | API 키 | readonly | 외부 서비스 인증 — ui-backend 연동 없음 |
| `batchSize` | 배치 크기 | readonly | 외부 API 요청 파라미터 — ui-backend 연동 없음 |
| `retryCount` | 재시도 횟수 | readonly | 외부 API 호출 정책 — ui-backend 연동 없음 |

### apache-airflow

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `dagId` | DAG ID | readonly | DAG 코드 정의값 — 변경 불가 |
| `conf` | 설정 JSON | runtime | `POST /api/v1/dags/{dag_id}/dagRuns` conf 파라미터로 전달 — `trigger_dag()` 구현됨 |
| `executor` | 실행기 | readonly | `AIRFLOW__CORE__EXECUTOR` 환경변수 — 재기동 필요 (config.py FLAGS 참조) |
| `triggerRule` | 트리거 규칙 | code | DAG 태스크 코드 내 `trigger_rule` 인수 — 코드 변경 필요 |
| `retries` | 재시도 횟수 | code | DAG 태스크 `default_args.retries` — 코드 변경 필요 |
| `retryDelay` | 재시도 지연(분) | code | DAG 태스크 `default_args.retry_delay` — 코드 변경 필요 |
| `poolSlots` | 풀 슬롯 | readonly | Airflow Pool 설정 — Airflow UI/REST Pool API 별도 구현 필요 |

> 추가 런타임 경로 (configFields에 없으나 구현됨):
> - `is_paused` → `PATCH /api/v1/dags/{dag_id}` — `set_paused()` 구현됨 (runtime)
> - `variable.{key}` → `PATCH/POST /api/v1/variables/{key}` — `set_variable()` 구현됨 (runtime)

### presidio

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `recognizers` | 인식기 | readonly | Presidio 서비스 설정 — ui-backend 연동 없음 |
| `nlpEngine` | NLP 엔진 | restart | NLP 엔진 교체는 Presidio Analyzer 재기동 필요 |
| `anonymizeStrategy` | 익명화 전략 | readonly | Presidio Anonymizer 설정 — ui-backend 연동 없음 |
| `language` | 언어 | readonly | `/analyze` 요청 파라미터지만 ui-backend 연동 없음 |
| `scoreThreshold` | 점수 임계값 | readonly | `/analyze` 요청 파라미터지만 ui-backend 연동 없음 |
| `returnDecisionProcess` | 판정 과정 반환 | readonly | `/analyze` 요청 파라미터지만 ui-backend 연동 없음 |

### docling-langchain

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `chunkSize` | 청크 크기 | restart | Docling 파이썬 라이브러리 — 재기동 시 파라미터 재로드 |
| `chunkOverlap` | 청크 오버랩 | restart | Docling 파이썬 라이브러리 — 재기동 시 파라미터 재로드 |
| `strategy` | 청킹 전략 | restart | LangChain TextSplitter 전략 선택 — 재기동 필요 |
| `splitBy` | 분할 기준 | restart | LangChain TextSplitter 설정 — 재기동 필요 |
| `maxTokens` | 최대 토큰 | restart | LangChain TextSplitter 설정 — 재기동 필요 |
| `includeMetadata` | 메타데이터 포함 | restart | Docling 파이썬 라이브러리 옵션 — 재기동 필요 |

### kure-embedding

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `modelPath` | 모델 경로 | restart | ONNX 모델 로드 시 확정 — 재기동 필요 |
| `outputDim` | 출력 차원 | readonly | ONNX 모델 아키텍처 정의값 — 변경 불가 |
| `batchSize` | 배치 크기 | restart | ONNX 런타임 세션 파라미터 — 재기동 필요 |
| `device` | 디바이스 | restart | ONNX 실행 프로바이더(CPU/CUDA/MPS) — 재기동 필요 |
| `normalize` | 벡터 정규화 | restart | 후처리 옵션 — 재기동 필요 |
| `precision` | 정밀도 | restart | ONNX INT8/FP16/FP32 모델 선택 — 재기동 필요 |

### valkey

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `host` | 호스트 | restart | 연결 문자열 — 재기동 필요 |
| `port` | 포트 | restart | 연결 문자열 — 재기동 필요 |
| `streamKey` | 스트림 키 | readonly | Redis Stream 키 이름 — DAG 코드 내 정의 |
| `maxlen` | 최대 길이 | readonly | XADD MAXLEN 파라미터 — DAG 코드 내 정의 |
| `password` | 비밀번호 | restart | 연결 인증 — 재기동 필요 |
| `db` | DB 번호 | restart | Redis DB 선택 — 재기동 필요 |
| `consumerGroup` | 컨슈머 그룹 | readonly | Redis Stream ConsumerGroup 이름 — DAG 코드 내 정의 |
| `ackMode` | 수신 확인 모드 | readonly | 코드 레벨 처리 방식 — DAG 코드 내 정의 |

### airflow-branch

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `field` | 분기 필드 | code | BranchPythonOperator 코드 내 분기 조건 — 코드 변경 필요 |
| `cases` | 분기 케이스 | code | BranchPythonOperator 코드 내 분기 조건 — 코드 변경 필요 |
| `defaultCase` | 기본 케이스 | code | BranchPythonOperator 코드 내 분기 조건 — 코드 변경 필요 |
| `taskGroup` | 태스크 그룹 | code | DAG 태스크 그룹 정의 — 코드 변경 필요 |

### s3

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `bucket` | 버킷 | readonly | AWS S3 버킷 — ui-backend 연동 없음 |
| `prefix` | 프리픽스 | readonly | S3 경로 프리픽스 — ui-backend 연동 없음 |
| `format` | 저장 형식 | readonly | DAG 코드 내 출력 형식 정의 |
| `region` | 리전 | readonly | AWS 리전 설정 — ui-backend 연동 없음 |
| `endpoint` | 엔드포인트 | readonly | S3 엔드포인트 URL — ui-backend 연동 없음 |
| `accessKeyId` | Access Key ID | readonly | AWS 인증 — ui-backend 연동 없음 |
| `partitionBy` | 파티션 기준 | readonly | DAG 코드 내 파티션 정의 |
| `compressionType` | 압축 방식 | readonly | DAG 코드 내 압축 방식 정의 |

### mysql

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `host` | 호스트 | restart | DB 연결 문자열 — 재기동 필요 |
| `database` | 데이터베이스 | restart | DB 연결 — 재기동 필요 |
| `table` | 테이블 | readonly | DAG 코드 내 대상 테이블 정의 |
| `batchSize` | 배치 크기 | readonly | DAG 코드 내 배치 처리 정의 |
| `port` | 포트 | restart | DB 연결 문자열 — 재기동 필요 |
| `user` | 사용자 | restart | DB 인증 — 재기동 필요 |
| `password` | 비밀번호 | restart | DB 인증 — 재기동 필요 |
| `ssl` | SSL 사용 | restart | DB 연결 옵션 — 재기동 필요 |
| `insertMode` | 삽입 모드 | readonly | DAG 코드 내 INSERT/UPSERT/REPLACE 정의 |

### elasticsearch

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `index` | 인덱스 | readonly | ES 인덱스명 — DAG 코드 내 정의 |
| `bulkSize` | 벌크 크기 | readonly | DAG 코드 내 bulk 처리 크기 정의 |
| `mlNode` | ML 노드 | readonly | ES 클러스터 노드 설정 — ui-backend 연동 없음 |
| `esFieldInfo` | ES 필드 정보 | readonly | 인덱스 매핑 정의 — ui-backend 연동 없음 |
| `host` | 호스트 | restart | ES 연결 URL — 재기동 필요 |
| `username` | 사용자명 | restart | ES 인증 — 재기동 필요 |
| `password` | 비밀번호 | restart | ES 인증 — 재기동 필요 |
| `pipeline` | Ingest Pipeline | readonly | ES Ingest Pipeline 이름 — DAG 코드 내 정의 |
| `refreshPolicy` | 갱신 정책 | readonly | DAG 코드 내 refresh_policy 정의 |

### kibana

| 필드 key | label | applyMode | 근거 |
|---------|-------|-----------|------|
| `space` | 스페이스 | readonly | Kibana Space 이름 — ui-backend 연동 없음 |
| `dashboardId` | 대시보드 ID | readonly | Kibana 저장된 객체 ID — ui-backend 연동 없음 |
| `host` | 호스트 | restart | Kibana 연결 URL — 재기동 필요 |
| `username` | 사용자명 | restart | Kibana 인증 — 재기동 필요 |
| `indexPattern` | 인덱스 패턴 | readonly | Kibana 데이터 뷰 — ui-backend 연동 없음 |
| `refreshInterval` | 새로고침 간격(s) | readonly | Kibana 대시보드 설정 — ui-backend 연동 없음 |

---

## 분류 요약

| applyMode | 필드 수 | 비율 |
|-----------|--------|------|
| runtime | 1 | 1.1% |
| restart | 19 | 21.6% |
| code | 7 | 8.0% |
| readonly | 61 | 69.3% |
| **합계** | **88** | 100% |

> **runtime 필드**: `apache-airflow.conf` (DagRun conf via `POST /api/v1/dags/{dag_id}/dagRuns`)  
> **비고**: `is_paused`와 `variable.{key}`는 ui-backend에 구현되어 있으나 configFields에 미등록 — 향후 추가 후보
