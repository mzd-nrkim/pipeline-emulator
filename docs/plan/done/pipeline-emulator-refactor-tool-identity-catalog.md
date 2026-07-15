# P1.5. 도구 정체성 카탈로그 — 추상 노드를 실제 인프라 도구로 교체 (hyundaimotor-lllm 기준)

> 상태: 통테통과-완료
> 작성일: 2026-07-15 / 우선순위: ★★★ (P1 결과 시정 — 데모 핵심 가치)
> 인덱스: [pipeline-emulator-refactor-tool-orchestrator-canvas.md](./pipeline-emulator-refactor-tool-orchestrator-canvas.md)
> 선행: [done/pipeline-emulator-refactor-canvas-ui.md](./done/pipeline-emulator-refactor-canvas-ui.md) (P1 — 캔버스 골격 완료)
> 후속: 실 API 연동은 **별도 후속 계획서**(도구별 REST 실호출 — Airflow trigger/Variables, NiFi/ES 등)로 작성 예정. 본 계획은 **mock-adapter만으로 "n8n처럼 보이게(A)"** 완결.

---

## 왜 이 계획서가 필요한가 (P1 결과 회고)

P1은 캔버스 골격(일반 DAG 렌더·4종 시각 구분·drill-down 껍데기)을 e2e 27/27로 통과시켰다. **그러나 목표를 빗나갔다.**

- P1 목표문(계획서 line 12)엔 "각 노드가 **NiFi/Debezium/Airflow/ES**를 나타내는 도구 노드"라고 적혀 있었으나,
- 실제 구현된 mock(`frontend/src/lib/mock/topology.ts`)의 `tool` 값은 `rdb_loader`·`s3_loader`·`pii_masker`·`text_chunker`·`condition_router`·`elasticsearch_writer`·`s3_writer` 등 **추상 기능명**이었다.
- 결과: "이게 도구인지 소스인지 모를 추상 그래프" — 기존 medallion observability와 구별되지 않는다.

**근본 원인 3가지:**
1. **mock 데이터 = 핵심 산출물인데 placeholder로 취급됨.** `ToolNode.tool`은 자유 문자열이라 구체 도구명을 담을 수 있었으나(테스트엔 `tool:'Debezium'` 존재), 화면 mock엔 기능명을 넣었다.
2. **검증 기준이 이를 못 잡음.** P1 TC는 "4종 색상 구분"·"노드 수 일치"만 검사 — "알아볼 수 있는 실제 도구인가"를 검증하는 항목이 없어 전 게이트 통과에도 목표를 빗나갔다.
3. **도구별 시각 정체성 부재 + 설정 껍데기.** 노드는 색으로만 4종 구분(도구 아이콘 없음), 설정 패널은 `JSON.stringify(config)` 원시 덤프(`frontend/src/lib/components/ToolCanvasView.svelte:79`)라 편집·판독 불가.

## 목표

캔버스 노드를 **`hyundaimotor-lllm` 프로젝트에 실제로 존재하는 인프라 도구**로 교체하고, 각 도구가 **아이콘·벤더 정체성으로 한눈에 식별**되며, 클릭 시 **그 도구의 실제 설정 파라미터를 편집 가능한 폼**으로 보여준다. mock만으로 "n8n처럼 보이고 만질 수 있게(A)"를 달성한다.

**정의상 완료(DoD):** 처음 보는 사람이 캔버스만 보고 "아, NiFi로 수집해서 Airflow가 Presidio 마스킹·Docling 청킹을 돌리고 Elasticsearch에 색인하는 파이프라인이구나"를 말할 수 있어야 한다.

## 범위 경계

- **포함**: (1) 도구 카탈로그 레지스트리(도구 id→표시명·벤더·아이콘·범주·설정 스키마), (2) hyundaimotor-lllm 실제 도구 기반 mock 토폴로지 재작성, (3) 노드 도구 정체성 렌더(아이콘/벤더 배지), (4) 설정 패널을 편집 가능한 폼으로 승격(로컬 state, mock).
- **제외**: 실 도구 REST 호출(→후속 계획서), run_id 발급·medallion 바인딩(→P3), 설정 변경의 서버 영속화(mock은 로컬 state까지).

## 접근 방법

### A. 도구 카탈로그 레지스트리 (신규 SSOT)

`frontend/src/lib/canvas/toolCatalog.ts` 신설 — `ToolNode.tool`이 참조하는 도구 사전. 각 엔트리:

```
ToolCatalogEntry {
  id: string            // 'apache-nifi' | 'debezium' | 'apache-airflow' | 'valkey' | 'elasticsearch' | ...
  displayName: string   // 'Apache NiFi'
  vendor: string        // 'Apache' | 'Redis/Valkey' | 'Elastic' | 'Microsoft(Presidio)' ...
  kind: 'source'|'task'|'switch'|'sink'   // 기본 범주
  icon: string          // 인라인 svg 경로 또는 이모지/약어 배지 폴백
  accent: string        // 벤더 브랜드 색 (배지·테두리)
  configFields: ConfigField[]   // 설정 폼 스키마 (아래)
}

ConfigField {
  key: string; label: string;
  type: 'text'|'number'|'select'|'boolean';
  options?: string[];   // select
  placeholder?: string;
  group?: string;       // '연결' | '동작' | '인증' 등 폼 섹션
}
```

- 카탈로그는 hyundaimotor-lllm 실측(README·docker-compose·requirements-ai·docs/기술검토확정) 기준으로 채운다.
- `tool` 필드 값은 카탈로그 `id`로 정규화(예: `'rdb_loader'` → `'debezium'` 또는 `'apache-nifi'`).

### B. mock 토폴로지 재작성 — hyundaimotor-lllm 실제 DAG 반영

실측 파이프라인: **Ingestion(NiFi/Debezium) → Bronze(S3) → Processing(Airflow: 구조화→마스킹→청킹→엔리치→필드매핑, Valkey 브로커) → Silver/Gold(MySQL) → Serving(Elasticsearch→Kibana)**. 2단계 분기(수집유형: RDB Only / 비정형 Only / RDB+비정형)를 Switch로.

fan-in·branch·fan-out을 실제 흐름으로 표현:
- **fan-in**: Debezium(CDC) + Apache NiFi(RDB 폴링·파일) + DAM(비정형 파싱) → S3(Bronze)
- **branch(Switch)**: 수집유형 분기 → RDB경로 / 비정형경로 / 연동경로
- **fan-out**: Elasticsearch(색인) + Kibana(시각화) / MySQL 아카이브

### C. 노드 도구 정체성 렌더

`buildNodesAndEdges.ts`가 각 노드에 카탈로그를 조인해 **아이콘 + 도구 표시명 + 벤더 액센트**를 렌더 데이터로 실어보낸다. 4종 kind 색상은 유지하되 **주인공은 도구 정체성**(아이콘/이름)으로 바꾼다. `@xyflow/svelte 0.1.39` 커스텀 노드 API 제약 시 `data`+`label`(HTML/아이콘 임베드)·`style` 배지로 폴백.

### D. 설정 패널 → 편집 가능한 폼

`ToolCanvasView.svelte`의 drill-down을 `JSON.stringify` 덤프에서 **카탈로그 `configFields` 기반 폼**으로 교체. 각 필드를 label+입력 위젯으로 렌더, 변경은 로컬 `$state`에 반영(mock — 서버 영속 없음, "적용은 후속 실 API 계획서에서" 명시 배너). 도구 헤더에 아이콘·표시명·벤더 표기.

## 도구 카탈로그 (hyundaimotor-lllm 실측 근거)

> 근거: `hyundaimotor-lllm/README.md`, `docs/아키텍처/…최종_기술_스택_버전_명세서.md`, `services/*/docker-compose.yml`, `services/airflow/requirements-ai.txt`, `docs/기술검토확정/*`.

| 범주 | 도구 (id) | 표시명·버전 | 역할 | 주요 설정 필드(폼) |
|------|-----------|-------------|------|-------------------|
| **Source** | `apache-nifi` | Apache NiFi 2.8.0 | RDB 폴링·파일 수집·Parquet 변환 | connectionPool, sqlQuery/inputDir, fileFilterRegex, outputFormat |
| **Source** | `debezium` | Debezium 3.4.0.Final | CDC 변경감지(MySQL/Oracle/PG/MariaDB) | connectorType, dbHost, dbPort, dbUser, walMode |
| **Source** | `dam` | DAM (외부 API) | 비정형 파일 파싱(고객사 제공) | endpoint, filePath, outputFormat(markdown/html/json) |
| **Task** | `apache-airflow` | Apache Airflow 3.1.5 | DAG 오케스트레이션(5단계) | dagId, conf(source_name/db_name/table/batch_id), executor |
| **Task** | `presidio` | Presidio 2-Layer | PII 마스킹(정규식+DeBERTa NER) | recognizers, nlpEngine(spaCy ko), anonymizeStrategy |
| **Task** | `docling-langchain` | Docling 2.77 + LangChain 0.1.13 | 계층형 청킹 | chunkSize, chunkOverlap, strategy(structure/parent-child/contextual) |
| **Task** | `kure-embedding` | KURE-v1 (ONNX INT8) | 벡터 임베딩(768d) | modelPath, outputDim, batchSize |
| **Task/Broker** | `valkey` | Valkey 8.1.4 | Celery 브로커·CDC Stream | host, port, streamKey, maxlen |
| **Switch** | `airflow-branch` | 수집유형 분기 | RDB Only/비정형 Only/연동 | field(change_operation/source_name), cases[] |
| **Sink** | `s3` | S3 (Bronze/아카이브) | Parquet 원본 보관·JSONL 아카이브 | bucket, prefix, format(parquet/jsonl) |
| **Sink** | `mysql` | MySQL (Silver/Gold) | 처리결과 적재·메타(30일 보존) | host, database, table, batchSize |
| **Sink** | `elasticsearch` | Elasticsearch 9.2.5 | BM25+Vector 하이브리드 색인 | index, bulkSize, mlNode, esFieldInfo |
| **Sink/View** | `kibana` | Kibana 9.2.5 | 검색·모니터링 시각화 | space, dashboardId |

> ZooKeeper·Registry·Grafana/Prometheus/Loki 등 순수 운영 컴포넌트는 데이터 흐름 노드가 아니므로 카탈로그에는 넣되 mock 토폴로지 backbone엔 넣지 않는다(부가/옵션 표시).

## 실행 시 필수 고려사항

> plan-review 검토 발견 — 서술형 사항. plan-run은 계획서만 읽으므로 여기 기록한다. (실측: 2026-07-15 frontend 코드베이스 grep)

### ① 회귀 이유·범위 (topology 재작성 → 선행 P2 의존 config 파손 위험)

- **Airflow 노드 `config.dagId` 보존 필수.** 선행 P2(tool-adapter)가 `ToolCanvasView.svelte`에 트리거 UI를 추가했고, 트리거 컨트롤 노출 조건이 `{#if selectedNode.config?.dagId}`(`frontend/src/lib/components/ToolCanvasView.svelte:85`, 관련 상태 `triggeredRunId`/`triggerError` line 16-17, `handleTrigger` line 85-110)다. B-1의 topology 전면 재작성이 Airflow(`apache-airflow`) 노드 config에서 `dagId`를 빠뜨리면 **기존 트리거 컨트롤이 렌더되지 않아 P2 기능이 죽는다** → Airflow 노드 `config`에 `dagId`를 반드시 유지한다.
- **`buildNodesAndEdges.test.ts` 회귀.** 이 테스트는 `tool:'Debezium'` 하드코딩(`frontend/src/lib/canvas/buildNodesAndEdges.test.ts:7`)과 **노드 수·fan-in·fan-out·branch Cardinality 기대값**에 의존한다(Explore 실측: Right 4·Boundary 2·Inverse 1·Cardinality 3·Range 1 케이스). B-1이 노드 구성을 바꾸면 이 기대값이 깨지므로 B-2에서 mock/기대값뿐 아니라 **노드 수·엣지 카디널리티 기대값도 새 토폴로지에 맞춰 갱신**한다.

### ② 실행 순서·동일 파일 편집 충돌 (선행 의존 + ToolCanvasView 공존)

- **선행 게이트**: 본 계획(P1.5)은 **P2(tool-adapter) 머지 후 착수**한다(사용자 지정). P2가 `ToolCanvasView.svelte`(트리거 UI)·`real-adapter.ts`/`mock-adapter.ts`(`triggerNode`/`setNodeConfig`)를 이미 수정한 상태를 전제로 한다. P2가 `plans/done`으로 이동(= post-gate 통과)되기 전엔 착수하지 않는다.
- **동일 파일 편집 — `ToolCanvasView.svelte` 공존**: 본 계획 D 섹션이 이 파일(`frontend/src/lib/components/ToolCanvasView.svelte`)을 다시 편집한다. `JSON.stringify(config)` 덤프(`:79`)만 카탈로그 폼으로 교체하고, **P2가 추가한 트리거 컨트롤(`handleTrigger`·트리거 버튼·`triggeredRunId`/`triggerError`)은 삭제하지 않고 보존**한다(설정 폼 + 트리거가 한 패널에 공존). "기존 내용 삭제 금지" 원칙 적용.
- **Phase 병렬성**: A(toolCatalog 신규)·B(topology)·C(buildNodesAndEdges)·D(ToolCanvasView)에서 C·D는 A의 카탈로그 계약(`ToolCatalogEntry`·`getToolEntry`·`configFields`)에 의존한다 → **A를 먼저 완료(또는 타입 계약 선고정)** 후 B/C/D 진행. C(`buildNodesAndEdges.ts`)와 D(`ToolCanvasView.svelte`)는 서로 다른 파일이라 병렬 가능, B(`topology.ts`)도 독립.

### ③ 테스트 하네스·환경 전제 (worktree 격리 불가)

- e2e(`frontend/e2e/*.spec.ts`, playwright)는 앱 기동 전제 + `node_modules` gitignored → 워크트리에서 검증 불가 → **Z-static(`check`/`build`/`test:unit`)·Z-post(e2e)는 머지 후 원본 main**에서 실행(이미 Z 섹션 반영). 워크트리 에이전트는 심볼 grep·정적 확인·구현 커밋까지만 수행.

### ④ 미선택 결정 근거 (`SourceKind` 제거 보류 가능)

- **실측**: `SourceKind`(`frontend/src/lib/api/types.ts:88`, `'rdb'|'s3'|'unstructured'`)는 **정의만 있고 사용처 0건**(grep 확인)이다 — dead code라 제거해도 회귀 없음. 다만 A-2는 하위호환·계약 안정 우선으로 **제거를 강제하지 않는다**(남겨도 무해). 제거를 택하면 grep 재확인 후 진행한다.

## 작업 목록

### A. 도구 카탈로그 레지스트리 (`toolCatalog.ts`)

- [x] A-1. `frontend/src/lib/canvas/toolCatalog.ts` 신설 — `ToolCatalogEntry`·`ConfigField` 타입 + 위 표의 13개 도구 엔트리
  - [x] 각 엔트리에 `configFields` 스키마 채움 (실측 config 키 기준)
  - [x] `getToolEntry(id): ToolCatalogEntry | undefined` + 미등록 id 폴백(표시명=id, 회색 배지)
- [x] A-2. `frontend/src/lib/api/types.ts` — `ToolNode.tool` 주석에 "카탈로그 id 참조" 명시(계약 자체는 string 유지, 하위호환) (path: frontend/src/lib/api/types.ts, 앵커: `ToolNode` interface line 90-95·`SourceKind` line 88, 의도: tool 필드 계약 문서화). `SourceKind`는 **실측 사용처 0건(dead code)** 확인됨 — 제거는 선택(강제 아님, 하위호환 위해 잔존 무해), 제거 택 시 grep 재확인 후 진행(실물 확인 후 결정).

### B. mock 토폴로지 재작성 (`topology.ts`)

- [x] B-1. `frontend/src/lib/mock/topology.ts` 재작성 — 추상 기능명 노드 제거, hyundaimotor-lllm 실제 도구 노드로 교체 (path: frontend/src/lib/mock/topology.ts, 앵커: `mockTopology` export·nodes[]·edges[] (기존 8노드/7엣지), 의도: 추상 tool값→카탈로그 id 노드 교체)
  - [x] Source fan-in: `debezium` + `apache-nifi` + `dam` → `s3`(Bronze)
  - [x] Task 체인: `apache-airflow`(오케스트레이터) 하에 `presidio` → `docling-langchain` → `kure-embedding`, `valkey` 브로커 연결
  - [x] Switch: `airflow-branch`(수집유형) → RDB경로/비정형경로/연동
  - [x] Sink fan-out: `elasticsearch` + `kibana` + `mysql`(아카이브)
  - [x] 각 노드 `config`를 카탈로그 `configFields` 기본값으로 채움(폼이 실제 값 렌더하도록)
  - [x] **Airflow(`apache-airflow`) 노드 `config`에 `dagId` 유지** — 선행 P2 트리거 UI 노출 조건(`ToolCanvasView.svelte:85` `config?.dagId`) 파손 방지 (실행 시 필수 고려사항 ① 참조)
- [x] B-2. `buildNodesAndEdges.test.ts`의 mock/기대값을 새 도구 id로 갱신(기존 `'Debezium'` 하드코딩 케이스 정합)

### C. 노드 도구 정체성 렌더 (`buildNodesAndEdges.ts` + 노드 표현)

- [x] C-1. `buildNodesAndEdges()`가 각 노드에 카탈로그 조인 — `data`에 `{displayName, vendor, icon, accent, kind}` 실어보냄
- [x] C-2. 노드 라벨을 "도구 아이콘 + 표시명" 중심으로 렌더(kind 색상은 테두리/배지로 보조). `@xyflow/svelte 0.1.39` 커스텀 노드 제약 시 label HTML/style 폴백
- [x] C-3. Switch/Source/Task/Sink 4종은 유지하되 **주인공이 도구 정체성**이 되도록 시각 위계 조정

### D. 설정 패널 → 편집 폼 (`ToolCanvasView.svelte`)

> ⚠ 동일 파일에 선행 P2가 추가한 트리거 UI(`handleTrigger`·`triggeredRunId`/`triggerError`, line 16-17/85-110)가 있다 — **삭제 금지·공존**(실행 시 필수 고려사항 ② 참조). 경로: `frontend/src/lib/components/ToolCanvasView.svelte`.

- [x] D-1. drill-down 헤더에 도구 아이콘·표시명·벤더 표기 (path: frontend/src/lib/components/ToolCanvasView.svelte, 앵커: `{#if selectedNode}` 패널 헤더 line 58~, 의도: 현 `selectedNode.id`/`tool` 원시 표기를 카탈로그 표시명 대체)
- [x] D-2. `JSON.stringify(config)` 덤프 제거 → 카탈로그 `configFields` 기반 폼 렌더 (path: frontend/src/lib/components/ToolCanvasView.svelte, 앵커: `<pre>{JSON.stringify(selectedNode.config …)}</pre>` line 79, 의도: label + text/number/select/boolean 위젯, `group` 섹션 분리 — 인접 트리거 컨트롤 보존)
- [x] D-3. 필드 변경 시 로컬 `$state` 반영(mock). "실제 적용은 후속 실 API 연동 계획에서" 안내 배너 표기
- [x] D-4. 미등록 도구·빈 configFields 폴백(폼 대신 "설정 없음" 표시, 크래시 없음)

## 검증 기준

- [x] 캔버스에 `rdb_loader`/`s3_loader` 같은 추상 기능명이 **하나도 없고**, NiFi·Debezium·Airflow·Valkey·Elasticsearch·Presidio 등 실제 도구명이 노출된다(grep + e2e 텍스트 검증)
- [x] 각 노드가 도구 아이콘/벤더 배지로 시각 식별되고, Source/Task/Switch/Sink 4종 위계도 유지된다
- [x] fan-in(3 Source→S3)·branch(수집유형 Switch)·fan-out(→ES+Kibana+MySQL)이 hyundaimotor-lllm 실제 흐름으로 보인다
- [x] 노드 클릭 시 그 도구의 설정 파라미터가 **편집 가능한 폼**으로 뜬다(JSON 덤프 아님), 값 변경이 로컬 반영된다
- [x] `npm run check`/`build`/`test:unit` 통과, 기존 e2e 회귀 없음

## TC (Right-BICEP · CORRECT)

> 단위: vitest(`frontend/src/**/*.test.ts`) — 카탈로그 조인·폼 스키마 도출 순수 로직. e2e: playwright(앱 기동, Z-post).

### Right-BICEP

- [x] **Right**: 새 mock 토폴로지로 `buildNodesAndEdges()`가 각 노드에 카탈로그(표시명·아이콘·벤더)를 조인해 반환
- [x] **B(경계)**: 미등록 `tool` id, `configFields=[]`, config에 스키마에 없는 잉여 키 — 크래시 없이 폴백 렌더
- [x] **I(역)**: `tool`이 빈 문자열/undefined일 때 폴백 배지(id 표시), 폼은 "설정 없음"
- [x] **C(교차)**: 캔버스 노드 표시명 집합 == 토폴로지 각 노드의 카탈로그 표시명, 추상 기능명(`*_loader`/`*_writer`/`*_masker`) 0건(grep)
- [x] **E(에러)**: 카탈로그 로드 실패/부분 결손 시 캔버스는 뜨고 결손 노드만 폴백
- [x] **P**: 해당 없음(소규모 mock)

### CORRECT

- [x] **Conformance**: 카탈로그 엔트리가 `ToolCatalogEntry` 계약 만족(tsc/svelte-check)
- [x] **Range**: `configFields[].type`이 text|number|select|boolean 범위, `kind` 4종 범위
- [x] **Reference**: mock 토폴로지의 모든 `tool` id가 카탈로그에 존재(또는 명시적 폴백)
- [x] **Existence**: 노드 클릭 시 설정 폼이 존재/렌더, 도구 헤더에 아이콘·표시명 존재
- [x] **Existence(회귀)**: Airflow 노드(`config.dagId` 보유) 클릭 시 **설정 폼과 함께 선행 P2 트리거 컨트롤(`handleTrigger` 버튼)이 공존**한다 — 폼 교체가 트리거 UI를 삭제하지 않았음 확인(e2e, Z-post)
- [x] **Cardinality**: fan-in(N→1)·branch(Switch)·fan-out(1→N) 각 1케이스 이상, Source≥2 도구 서로 다른 벤더
- [x] **Ordering/Time**: 해당 없음

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> DB 스키마 변경 없음 → 마이그레이션 항목 생략. Node 프로젝트(node_modules gitignored)이므로 `check`/`build`/`test:unit`·e2e는 **머지 직후 원본 main**에서 실행.

### Z-pre. 머지 전 (워크트리 — 정적·격리만)

- [x] `toolCatalog.ts` 신규 심볼(`ToolCatalogEntry`·`getToolEntry`) 존재 grep 확인
- [x] mock `topology.ts`에 추상 기능명(`rdb_loader`·`s3_loader`·`pii_masker`·`text_chunker`·`condition_router`·`*_writer`) 잔존 0건 grep
- [x] 워크트리 브랜치에 구현 커밋 (통합·머지는 메인 책임)

### Z-static. 머지 직후 (원본 main — node_modules 상주)

- [x] `cd frontend && npm run check` (svelte-check/tsc) 통과
- [x] `cd frontend && npm run build` 성공
- [x] `cd frontend && npm run test:unit` (vitest) 통과 — 카탈로그 조인·폼 스키마 단위테스트 포함

### Z-post. push 후 (앱 기동 환경)

- [x] `cd frontend && npm run test:e2e` — 기존 `pipeline-canvas.spec.ts`·`pipeline-view-toggle.spec.ts`·`route-split.spec.ts` 회귀 없음
- [x] `pipeline-canvas.spec.ts`에 케이스 추가: (1) 실제 도구명(NiFi/Debezium/Airflow/Elasticsearch 등) 노출, (2) 추상 기능명 미노출, (3) 노드 클릭→설정 폼(입력 위젯) 렌더·값 편집, (4) **Airflow 노드 클릭 시 설정 폼 + 선행 P2 트리거 컨트롤 공존**(회귀 방지)
  - teardown: 앱 상태 변경 없음(로컬 state mock) — 불필요

## 재사용 자산

- 기존 `ToolCanvasView.svelte`·`buildNodesAndEdges.ts`·`CanvasTopology` 계약 — 골격 그대로, 도구 정체성/폼만 주입
- `@xyflow/svelte ^0.1.39`
- hyundaimotor-lllm 실측 카탈로그(본 계획서 도구 표) — 카탈로그 엔트리 채움의 SSOT

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| `@xyflow/svelte 0.1.39` 커스텀 노드 API 제약으로 아이콘 임베드 곤란 | label HTML/이모지·약어 배지·style accent로 폴백(아이콘 svg는 가능 범위) |
| 카탈로그가 hyundaimotor-lllm과 어긋나 "그럴듯한 가짜"가 됨 | 도구 표의 근거 파일경로 유지, 버전·config 키를 실측에 고정 |
| 설정 폼이 mock인데 "동작한다"는 오해 | 폼에 "적용은 후속 실 API 계획" 배너 상시 표기, 저장 버튼 비활성/안내 |
| `SourceKind`·기존 mock 제거가 회귀 유발 | grep으로 사용처 확인 후 제거, 기존 e2e 유지(대체 아님) |

## 후속 (본 계획 범위 밖)

- **실 API 연동 계획서**(별도): 카탈로그 `configFields`를 실제 도구 REST에 바인딩 — Airflow `POST /api/v2/dags/{id}/dagRuns`·Variables, NiFi REST(8080), ES Bulk 등. ui-backend 신규 구현·로컬 스택 필요. (기존 [tool-adapter](./pipeline-emulator-refactor-tool-adapter.md) 계획과 통합/승계 검토)
- **P3**: run_id 발급 + medallion 강등(부가뷰) + pipeline 페이지 해체.
