# 파이프라인 캔버스 — 도구 오케스트레이션 정체성 확립 + 단일소스·2뷰 재설계

> 상태: 통테통과-완료

`/sample/pipeline` 샘플 토폴로지 검증에서 노드의 역할·의미·배치·매핑 결함이 다수 확인됐다. 논의 결과 이 제품의 정체성을 **n8n식 도구 오케스트레이션 캔버스**(도구선택 + 노드연결 + 조건부여 + 설정)로 정립하고, 노드 = "dockerized 프로그램", 엣지 = "뷰별 관계"로 재정의한다. 기존 결함의 상당수는 **데이터 계보(medallion) 렌즈**로 본 오판이었고, 실제로는 **하나의 캐노니컬 모델에서 데이터흐름 뷰 / 인프라연결 뷰 2가지로 투영**하면 자연스럽게 해소된다. 출시는 데이터흐름 뷰 first, 인프라 뷰 fast-follow.

> 근거: 샘플 토폴로지 데이터 검증·설계 논의 세션(2026-07-15). `topology.ts` · `buildNodesAndEdges.ts` · `ToolCanvasView.svelte` 정독.
> 관련: [pipeline-emulator-refactor-tool-orchestrator-canvas.md](./pipeline-emulator-refactor-tool-orchestrator-canvas.md) · [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md) · [pipeline-emulator-feat-dag-graph-toggle.md](./pipeline-emulator-feat-dag-graph-toggle.md)

---

## 목표

- 캔버스가 **도구 오케스트레이션 도구**(노드=프로그램, 엣지=관계, config=1급 기능)로 정체성이 확립된다.
- **단일 캐노니컬 topology 모델**에서 **데이터흐름 뷰 / 인프라연결 뷰** 2가지로 투영이 가능해진다(뷰 토글).
- 데이터흐름 뷰에서 **모든 엣지가 좌→우 단방향**으로 흐르고(지그재그 소멸), 노드가 **trigger/action/switch**로 분류되며, **Switch가 실제로 다중 분기**한다.
- 검증에서 나온 배치 결함(D1)·무분기 스위치(D5)·오케스트레이터 중복(D6)이 해결되고, source/sink 오분류(D2·D3)와 Kibana 오연결(D4)은 **뷰 분리로 자연 해소**된다.
- 각 노드의 **설정(config) 편집 폼**(도구 API param / 컨테이너 config)이 드릴다운에서 1급 기능으로 제공된다(기존 씨앗 확장).

## 접근 방법

1. **캐노니컬 모델 재설계 (단일 `kind` 폐기 → 직교 facet + 타입 엣지)**
   - 노드: `kind` 스칼라 대신 `role`(`ingest|transform|route|store|index|broker|visualize`) + `trigger?:boolean` facet. 도구 카테고리·벤더·아이콘은 `toolCatalog`에서 유도.
   - 엣지: `channels: ('data'|'dependency')[]` 태깅 + `condition?`(switch 분기 라벨). 하나의 엣지가 데이터흐름·인프라의존 중 어느 뷰에 나타날지 결정.
   - 이로써 "데이터흐름 그래프"와 "인프라 의존 그래프"라는 **겹치되 다른 두 그래프**를 한 소스에 담는다.

2. **뷰 투영 함수 (`buildNodesAndEdges(topo, view)`)**
   - `view` 채널로 엣지 필터 → 가시 부분그래프만 남김.
   - 가시 엣지셋 기준 **위상정렬 rank로 X좌표 산출**(뷰마다 레이아웃이 정확). Y는 rank 내 순번.
   - 뷰별 색상: 데이터흐름 = `role`/`trigger` 기준, 인프라 = 도구 카테고리 기준.
   - 해당 뷰에서 연결이 없는 **고아 노드는 숨김**(예: Kibana는 데이터뷰에서 미표시).

3. **레이아웃 위상화 (D1 근본 해소)**
   - `KIND_X` 고정 좌표 폐기 → 엣지 기반 위상정렬(소스로부터 최장경로 depth × 열간격). 사이클/고아 방어 fallback.

4. **topology.ts 데이터 재저작 (데이터흐름 채널 우선)**
   - **D5**: `수집유형 분기`(switch)를 실제 다중 출력으로 만들거나, 후속 분기 경로가 없으면 제거하고 `s3-bronze→airflow` 직결.
   - **D4**: `valkey→kibana` 데이터 엣지 제거. Kibana는 `es→kibana`를 **`dependency` 채널로만** 태깅(데이터뷰 미표시, 인프라뷰 표시).
   - **D6**: Airflow 노드는 데이터뷰에서 오케스트레이터=캔버스 자신과 중복 → trigger 성격으로 재정의하거나 데이터뷰에서 숨김(택1은 plan-review에서 확정).
   - **D3**: Debezium/NiFi는 데이터뷰에서 **trigger 노드로 정상**(MySQL은 그 노드의 config). 진짜 RDB origin은 **인프라뷰의 컨테이너 노드**로만 `dependency` 태깅(fast-follow).

5. **뷰 토글 UI**
   - `[mode=mode]/pipeline/+page.svelte`(또는 `ToolCanvasView`)에 뷰 셀렉터 추가. 데이터흐름 뷰 default, 인프라 뷰는 스텁(스키마는 지원, 렌더는 fast-follow). 기존 `[mode=mode]` 라우팅과 정합.

6. **설정(config) 1급화**
   - `toolCatalog.configFields` 확장, 드릴다운 편집 폼(이미 존재) 유지·강화. 실 API 연동은 별도 F-계획(F2/F3/F7 등) 범위 — 여기서는 config 조정 UI까지.

7. **도구 팔레트(도구선택)는 범위 경계**
   - 카탈로그에서 노드 추가/삭제하는 팔레트는 이번 스코프 밖(열린 항목). 이번엔 기존 노드의 정합·2뷰·설정에 집중.

> **결함↔해소 매핑 요약** (검증 세션 D1~D7):
> - 그대로 유효: **D1**(레이아웃 위상화) · **D5**(Switch 다중분기) · **D6**(Airflow 중복)
> - 뷰 분리로 해소: **D2**(S3 Bronze는 `role:store`, 분류 비문제) · **D3**(Debezium=데이터뷰 trigger / MySQL origin=인프라뷰 컨테이너) · **D4**(Kibana=인프라뷰 전용)
> - 낮은 우선순위: **D7**(config 값 정합 — `ssn`→`rrn` 등)

## 실행 시 필수 고려사항

> plan-run은 이 계획서만 읽는다 — 아래는 채팅이 아닌 본문 기록.

### ① 회귀 이유·범위 (기존 e2e가 이번 변경으로 깨짐)

`kind` 스칼라 폐기·뷰 셀렉터 추가로 **아래 기존 e2e 단언이 필연적으로 실패**한다. Z-post에서 반드시 갱신한다(회귀가 아니라 계약 변경):

- `frontend/e2e/pipeline-canvas.spec.ts:9-13` — "Grid/Graph 토글 **미노출**"을 단언 → 뷰 셀렉터 추가 후 반대가 됨.
- `frontend/e2e/pipeline-canvas.spec.ts:26-33` — `[source] [task] [sink]` **kind 텍스트 라벨** 단언 → role 기반으로 라벨 체계 변경 시 실패.
- `frontend/e2e/pipeline-view-toggle.spec.ts:9-13` — 마찬가지로 토글 부재를 단언.
- `pipeline-view-toggle.spec.ts:40-58`(Airflow 트리거)·`pipeline-canvas.spec.ts:79-104`(설정 폼+트리거)는 **회귀 보존 대상** — airflow 처리(D6) 결정이 이 트리거 버튼을 없애면 안 됨(아래 ④ 참조).

### ② 테스트 하네스·환경 전제

- 캔버스 topology는 **DB 비의존** — `mockTopology`(topology.ts)를 `mock-adapter.ts:fetchCanvasTopology`가 반환. `db/init.sql`에 node/edge/topology 정의 없음 → **마이그레이션 불필요, DB 통합 테스트 해당 없음**.
- e2e는 `/sample/pipeline` 라우트(`[mode=mode]`=sample) = **mock adapter** 경로. Airflow 트리거도 mock run id 반환(영속 DB write 없음) → e2e teardown 불필요.
- 패키지매니저는 **npm**(`frontend/package-lock.json`). 계획서 본문의 "pnpm check"는 부정확 — 실제 명령은 `npm run check`(svelte-check)·`npm run test:e2e`(playwright)·`npm run test:unit`(vitest).
- `node_modules` gitignored → **Node 정적 게이트**(`npm run check`/build/vitest)는 워크트리 Z-pre가 아니라 **머지 후 원본 main**에서 실행(Z-post/정적 게이트).

### ③ 실행 순서·동일 파일 편집 충돌·병렬 가능 여부

- **A(types.ts)는 의존성 루트** — B·C·D·E 모두 새 타입(`role`/`trigger`/`channels`)에 의존. **A를 최우선 직렬 완료 후** 나머지 착수.
- B(buildNodesAndEdges.ts)와 C(topology.ts)는 **다른 파일**이라 병렬 가능하나, 채널 필터(B-2)와 엣지 채널 태깅(C-1)이 **의미적으로 결합** — 같은 채널 값 셋(`'data'|'dependency'`)을 공유해야 하므로 A에서 채널 유니온을 SSOT로 확정.
- D는 `ToolCanvasView.svelte`(D-1)와 `+page.svelte`/`+page.ts`(D-2/D-3)로 **파일이 갈리므로** D-1과 D-2/D-3는 별도 에이전트 병렬 가능. 단 view prop 이름은 A/B에서 정한 시그니처와 일치시킬 것.
- E는 대체로 독립(toolCatalog + 드릴다운 회귀 확인). C의 role 매핑 완료 후가 안전.

### ④ 미선택 결정 근거 (실물 확인 후 확정 — 권장안 + 근거)

- **D5 Switch(node-branch)**: 실물 확인 결과 `node-s3-bronze → node-branch → node-airflow`로 **단일 하류(airflow)뿐, 실제 분기 없음**(topology.ts 엣지). → **권장 B2(제거 후 `s3-bronze→airflow` 직결)**. 억지 3분기(B1)는 지양. 단 착수 시 topology.ts 엣지를 재확인하고 확정.
- **D6 Airflow(node-airflow)**: **권장 "trigger로 재정의"**(role 유지 + `trigger:true`, 데이터뷰 표시). 숨김을 택하면 `pipeline-view-toggle.spec.ts:40-58`·`pipeline-canvas.spec.ts:79-104`의 **Airflow 트리거 버튼 회귀가 깨진다** → 오케스트레이터=캔버스 전제와 트리거 버튼 보존을 동시에 만족하는 trigger 재정의가 우월. 착수 시 트리거 버튼 렌더 경로(ToolCanvasView.svelte:142-167) 확인 후 확정.
- **role 유니온 최종 셋**: A 착수 시 **최소 셋 우선**으로 확정(현 노드 커버: `ingest`(debezium/nifi/dam)·`store`(s3-bronze/mysql)·`route`(branch, 제거 시 불요)·`transform`(presidio/docling/kure)·`broker`(valkey)·`index`(es)·`visualize`(kibana), airflow는 `trigger` facet). 미사용 role은 넣지 않음.

## 작업 목록

### A. 캐노니컬 타입 모델 재설계 (types.ts) — 의존성 루트·최우선 직렬

- [x] A-1. `ToolNode` facet 재설계 (path: frontend/src/lib/api/types.ts, 앵커: `ToolNode` 인터페이스 라인 90-97의 `kind` 필드, 의도: `kind` 스칼라를 `role` 유니온 + `trigger?:boolean`로 교체)
  - [x] `role` 유니온 타입 정의 — 최소 셋 우선(실물 확인 후 결정: 현 노드가 실제 쓰는 role만 포함) (path: frontend/src/lib/api/types.ts, 앵커: `ToolNode` 위 신규 `type ToolRole`)
  - [x] `ToolNode`에 `role: ToolRole` + `trigger?: boolean` 추가, `kind` 제거 (path: frontend/src/lib/api/types.ts, 앵커: `ToolNode` 라인 93)
- [x] A-2. `Edge` 채널 태깅 필드 추가 (path: frontend/src/lib/api/types.ts, 앵커: `Edge` 인터페이스 라인 99-103, 의도: `channels: ('data'|'dependency')[]` 추가, `condition?` 유지)
- [x] A-3. `toolCatalog.ts`의 `ToolKind` → role 정합 (path: frontend/src/lib/canvas/toolCatalog.ts, 앵커: `ToolKind` 라인 1·`ToolCatalogEntry.kind` 라인 13-21, 의도: 카탈로그 kind가 노드 role과 충돌하지 않도록 정리 — 카탈로그는 도구 카테고리 유도용으로 역할 재정의 or 유지 판단, 실물 확인 후 결정)

### B. 뷰 투영 함수 + 레이아웃 위상화 (buildNodesAndEdges.ts)

- [x] B-1. 함수 시그니처 `view` 파라미터화 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: `buildNodesAndEdges` 라인 41, 의도: `(topo, view: 'data'|'infra')` 시그니처로 확장, 호출부 기본값 `'data'`)
- [x] B-2. 채널 필터 + 고아 노드 숨김 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: 엣지 빌드 루프 라인 76-84, 의도: `view` 채널 미포함 엣지 제외 → 가시 부분그래프 산출, 연결 0인 노드 숨김)
- [x] B-3. 위상정렬 X좌표 (D1 근본 해소) (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: `KIND_X` 라인 11-16 제거·좌표 계산 라인 67, 의도: 가시 엣지셋 기준 소스로부터 최장경로 depth×열간격으로 X 산출, Y는 rank 내 순번)
  - [x] 사이클·고아 방어 fallback (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: 위상정렬 로직 내, 의도: 사이클 감지 시 무한루프 방지·미방문 노드 기본 열 배치)
- [x] B-4. 뷰별 색상 매핑 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: `KIND_STYLE` 라인 4-9·스타일 적용 라인 72, 의도: 데이터뷰=`role`/`trigger` 기준 색, 인프라뷰=도구 카테고리 기준 색으로 `KIND_STYLE` 교체)

### C. topology.ts 데이터 재저작 (데이터흐름 채널 우선)

- [x] C-1. 노드 role/trigger 매핑 (path: frontend/src/lib/mock/topology.ts, 앵커: `mockTopology.nodes` 라인 17-172, 의도: 각 노드 `kind`→`role` 치환, airflow에 `trigger:true` 부여)
- [x] C-2. 전 엣지 `channels` 태깅 (path: frontend/src/lib/mock/topology.ts, 앵커: `mockTopology.edges` 라인 174-196, 의도: 각 엣지에 `channels:['data']`/`['dependency']`/양쪽 태깅)
- [x] C-3. D5 Switch 처리 — 단일출력이면 제거·직결 (실물 확인 후 결정) (path: frontend/src/lib/mock/topology.ts, 앵커: `node-branch` 라인 67-77 및 `s3-bronze→branch→airflow` 엣지 라인 180-184, 의도: 실제 분기 없으면 branch 노드·엣지 제거 후 `s3-bronze→airflow` 직결 — 권장 B2)
- [x] C-4. D4 Kibana 엣지 재정의 (path: frontend/src/lib/mock/topology.ts, 앵커: `node-valkey→node-kibana`(fan-out 라인 192-195) 및 `es→kibana`, 의도: `valkey→kibana` 데이터 엣지 제거, `es→kibana`는 `channels:['dependency']`로만 태깅 — 데이터뷰 미표시·인프라뷰 표시)
- [x] C-5. D6 Airflow 데이터뷰 처리 (실물 확인 후 결정) (path: frontend/src/lib/mock/topology.ts, 앵커: `node-airflow` 라인 80-90, 의도: trigger 재정의(권장) 또는 데이터뷰 숨김 — ④의 회귀 근거상 trigger 재정의 우선)

### D. 뷰 토글 UI (데이터흐름 default)

- [x] D-1. `ToolCanvasView`에 `view` prop + 조건부 렌더 (path: frontend/src/lib/components/ToolCanvasView.svelte, 앵커: props 라인 16-21·캔버스 렌더 라인 62-69, 의도: `view` prop 받아 `buildNodesAndEdges(topology, view)` 호출, 드릴다운(72-220)은 뷰 무관 유지)
- [x] D-2. `+page.svelte` 뷰 셀렉터 UI (path: frontend/src/routes/[mode=mode]/pipeline/+page.svelte, 앵커: 실행 조작 패널 버튼 그룹 라인 53-61·state 선언 라인 12-23, 의도: 데이터흐름 default 셀렉터 추가, 선택값을 `ToolCanvasView`의 `view`로 전달, 인프라뷰는 스텁 라벨)
- [x] D-3. `+page.ts` 뷰 파라미터 필요 시 반영 (실물 확인 후 결정) (path: frontend/src/routes/[mode=mode]/pipeline/+page.ts, 앵커: `fetchCanvasTopology` 로드 라인 3-6, 의도: topology는 단일 소스라 클라이언트 필터로 충분하면 +page.ts 무변경 — URL `?view=` 쿼리 동기화가 필요할 때만 수정)

### E. 설정(config) 1급화 + 회귀 보존

- [x] E-1. `toolCatalog.configFields` 확장 (path: frontend/src/lib/canvas/toolCatalog.ts, 앵커: 각 도구 entry의 `configFields` 배열 라인 23-216, 의도: 드릴다운 편집 대상 config param 보강 — 실 API 연동은 범위 밖)
- [x] E-2. 드릴다운 config 폼·Airflow 트리거 회귀 확인 (path: frontend/src/lib/components/ToolCanvasView.svelte, 앵커: 설정 폼 라인 104-138·Airflow 트리거 라인 142-167, 의도: role 전환 후에도 폼 렌더·트리거 버튼·medallion 증거(177-219) 정상 동작 확인)

### F. (fast-follow) 인프라연결 뷰

- [x] F-1. 인프라뷰 `dependency` 엣지 + 컨테이너 노드 저작 (path: frontend/src/lib/mock/topology.ts, 앵커: `mockTopology.nodes`/`edges`, 의도: MySQL origin·broker 등 컨테이너 노드를 `dependency` 채널로 추가 — 데이터뷰 미표시)
- [x] F-2. 인프라뷰 렌더 활성화 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts + ToolCanvasView.svelte, 앵커: B-4 색상 매핑의 인프라 분기, 의도: 스텁이던 인프라뷰를 실제 렌더로 승격)

### G. (D7, 선택) config 값 정합

- [x] G-1. config 값 오타·형식 정합 (path: frontend/src/lib/mock/topology.ts + toolCatalog.ts, 앵커: 해당 노드 config, 의도: Presidio `ssn`→`rrn`, Debezium `walMode` 키명, DAM 형식 주석)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> 스키마 변경 없음(DB 비의존 mock topology) → 마이그레이션 항목 없음. Node `node_modules` gitignored → 정적 게이트는 머지 후 원본 main에서 실행.

#### Z-pre. 머지 전 (워크트리에서 실행)

- [x] 워크트리 에이전트는 구현 완료 후 **워크트리 브랜치에 커밋**(단위테스트·통합테스트·머지는 메인 책임)
- [x] (워크트리에서 실행 가능하면) `npm run test:unit`(vitest) 격리 단위테스트 통과 확인 — env 미가용 시 Z-post로 강등

#### Z-static. 머지 직후 원본 main (Node 정적 게이트 — node_modules 상주)

- [x] `npm run check`(`svelte-kit sync && svelte-check`) 통과, 타입 에러 0
- [x] `npm run build` 통과

#### Z-post. push 후 (앱 기동 환경에서 실행)

- [x] e2e 통합테스트 통과 확인 (`npm run test:e2e`, 앱 기동 전제)
  - [x] `frontend/e2e/pipeline-canvas.spec.ts` 갱신 — 구 kind 라벨(`[source]/[task]/[sink]`, 라인 26-33)·"토글 미노출"(라인 9-13) 단언을 새 role/뷰 셀렉터 계약으로 수정 (teardown: mock adapter → DB 레코드 미생성, 불요)
  - [x] `frontend/e2e/pipeline-view-toggle.spec.ts` 갱신 — 토글 부재 단언(라인 9-13)을 뷰 전환 검증으로 교체, Airflow 트리거(40-58) 회귀 통과 유지
  - [x] (신규 시나리오) 뷰 셀렉터 가시성·데이터↔인프라 전환 시 렌더 변경·전환 후 드릴다운 상태·`?view=` URL 반영(D-3 채택 시) e2e 추가

## Verification (TC — Right-BICEP · CORRECT)

### Right (정상 결과)

- [x] **데이터흐름 뷰**: `/sample/pipeline`에서 모든 엣지가 좌→우 순방향(역방향 화살표 0개), S3 Bronze가 소스~airflow 사이 열에 위치, 지그재그 소멸.
- [x] **Kibana**: 데이터흐름 뷰에서 미표시(Valkey→Kibana 엣지 없음, `es→kibana`는 dependency라 데이터뷰 제외).
- [x] **뷰 토글**: 데이터흐름↔인프라 전환 동작. 인프라 뷰(fast-follow) 활성 시 `es→kibana`·MySQL origin 컨테이너 등장.

### B — Boundary (경계)

- [x] **빈/단절 topology**: 노드 0개 또는 엣지 0개(전 노드 고아)일 때 buildNodesAndEdges 크래시 없이 빈/기본배치 반환.
- [x] **Switch cardinality**: 분기 0/1/N 출력 케이스 — 단일출력 switch가 잔존하지 않음(D5). N출력이면 condition 라벨별 다중 엣지.

### I — Inverse (역операция)

- [x] **뷰 왕복**: 데이터→인프라→데이터 전환 후 노드/엣지 셋·레이아웃이 최초 데이터뷰와 동일(상태 오염 없음).

### C — Cross-check (교차 검증)

- [x] **위상 rank 교차 확인**: 위상정렬 X좌표 순서가 수기 기대 순서(source들 < s3-bronze < airflow < presidio < ... < sink들)와 일치.

### E — Error (오류 조건)

- [x] **사이클 topology**: 엣지가 사이클을 이뤄도 위상정렬 fallback으로 무한루프·크래시 없이 렌더(콘솔 에러 0).
- [x] **카탈로그 미스**: `getToolEntry(id)`가 미등록 tool을 만나도 fallback 표시(누락 시 보강).

### CORRECT

- [x] **Conformance**: 모든 노드 `role`이 `ToolRole` 유니온에 속하고, 모든 엣지 `channels`가 `'data'|'dependency'`만 가짐(타입 통과).
- [x] **Ordering**: 데이터뷰 X좌표가 데이터흐름 방향으로 단조 증가(역방향 0).
- [x] **Range**: 산출 X/Y 좌표가 캔버스 가시 범위 내(음수·과대값 없음).
- [x] **Reference**: 고아 노드 숨김이 현재 뷰 기준으로만 판정(다른 뷰의 연결로 오판 안 함).
- [x] **Existence**: null/undefined topology·빈 config 노드 방어.
- [x] **Cardinality**: fan-in(3 source→s3-bronze)·fan-out(valkey→N sink) 엣지 수가 보존.
- [x] **Time**: 해당 없음(시간 의존 로직 없음 — 정적 topology 투영).

### 회귀·결함 해소

- [x] **타입/빌드**: `npm run check`(svelte-check) 통과, 브라우저 콘솔 에러 0.
- [x] **회귀 없음**: 노드 클릭 드릴다운, config 편집 폼, Airflow 트리거 버튼·medallion 증거 정상.
- [x] **결함 해소 확인**: D1·D5·D6 수정 반영, D2·D3·D4가 뷰 분리로 사라졌는지 육안 확인.

- **Performance**: 해당 없음 — 노드 ~13개 소규모 mock topology, 성능 임계 무의미.
- **DB 통합 테스트**: 해당 없음 — 캔버스 topology는 DB 비의존(mock adapter). DB write/read-back 경로 없음.

## 열린 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 엣지 채널을 "설정에서 뷰 선택" 방식으로 노출 | 확정(2뷰 토글) | 사용자 요청 = 두 옵션 제공·전환. 데이터뷰 default |
| Airflow 노드: 데이터뷰에서 숨김 vs trigger로 재정의 | plan-review에서 확정 | 캔버스=오케스트레이터 전제 |
| Switch: 실제 3분기(B1) vs 제거(B2) | 후속 처리 경로 유무에 따름 | 억지 분기 지양 |
| 도구 팔레트(노드 추가/삭제 = 도구선택 UI) | 범위 밖 | 별도 계획 |
| 실 도구 API 연동(설정 기능의 "API 사용") | 범위 밖 | F2/F3/F7 등 기존 F-계획 |
| `role`/facet 유니온 최종 셋 | Phase 1 착수 시 확정 | 최소 셋 우선 |

## 참고 (파일 위치)

- 토폴로지 데이터: `frontend/src/lib/mock/topology.ts`
- 레이아웃 변환: `frontend/src/lib/canvas/buildNodesAndEdges.ts`
- 렌더 컴포넌트: `frontend/src/lib/components/ToolCanvasView.svelte`
- 타입: `frontend/src/lib/api/types.ts`
- 도구 카탈로그: `frontend/src/lib/canvas/toolCatalog.ts`
- 라우트/모드: `frontend/src/routes/[mode=mode]/pipeline/+page.svelte` · `+page.ts`
