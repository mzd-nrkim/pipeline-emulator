# P1. 도구 노드 캔버스 UI 전환 — 기능 계획서

> 상태: 통테통과-완료
> 작성일: 2026-07-15 / 상태: 착수 가능 (선행 게이트 무관) / 우선순위: ★★★
> 인덱스: [pipeline-emulator-refactor-tool-orchestrator-canvas.md](./pipeline-emulator-refactor-tool-orchestrator-canvas.md)
> 전제: **mock-adapter만으로 완결** — ui-backend 실동작(P2)·run_id 연결(P3)에 비종속

---

## 목표

메인 화면을 **도구 노드 캔버스**로 전환한다. 각 노드가 NiFi/Debezium/Airflow/ES를 나타내는 도구 노드로 굵게 렌더되고, 노드 카탈로그가 **Source·Task·Switch·Sink** 4종으로 시각 구분된다. 캔버스는 단일 backbone에 고정되지 않는 **일반 DAG**(fan-in·fan-out·branch)로 표현된다. 이 단계는 mock 데이터만으로 "n8n처럼 **보이게**(A)"를 달성한다 — 실제 도구 조종(P2)·run_id 증거 연결(P3)은 후속.

## 범위 경계

- **포함**: 타입 계약, mock 토폴로지, 캔버스 컴포넌트, 노드 4종 시각 구분, 클릭 시 drill-down 패널 **껍데기**(정적 mock 내용).
- **제외**: Airflow REST 실호출(→P2), run_id 발급·medallion 바인딩(→P3), medallion 탭 물리적 제거(→P3와 함께).

## 접근 방법

### C. 노드 카탈로그 4종 정의

- **Source (polymorphic 어댑터)**: 소스별 추출·파싱을 자기 안에 가두고 **표준 문서 봉투(canonical envelope)**로 내놓는다. 변형 지점 셋: ①추출 방식(CDC/batch/파일), ②파싱(컬럼→필드 / 포맷검출→파서 / OCR→텍스트), ③봉투 변환. OCR은 새 파이프라인이 아니라 이미지 Source 노드 안의 파싱 스텝.
- **Task**: 공통 처리 노드(구조화·마스킹·청킹·엔리치). 기존 DAG 단계가 여기 매핑.
- **Switch**: 조건 분기(`doc_type`·config 기반). 소스 이질성 중 봉투로 못 합친 잔여 발산 흡수.
- **Sink**: 출구 추상화(S3 / 고객 DB / ES). 저장 방식이 소스·목적별로 달라도 backbone 불변, Sink 노드만 교체.

### D. 캔버스 토폴로지 = 일반 DAG

단일 척추를 전제하지 않는다. **fan-in(여러 Source→표준 봉투 합류) + fan-out(여러 Sink/목적지) + branch(Switch)**를 모두 표현. 수렴은 "목적지가 문서 코퍼스 하나"일 때의 특수해일 뿐임을 데이터 모델에 반영. `@xyflow/svelte`(`^0.1.39`)가 임의 분기·병합을 이미 지원.

### F. 타입 계약 확장

`frontend/src/lib/api/types.ts`에 노드 그래프 계약 추가(기존 `Stage`/`Run`/`Dimension`은 부가뷰용으로 유지). 신규:
- `ToolNode`(`kind`: source|task|switch|sink, `tool`, `config`)
- `Edge`(from/to/condition?)
- `CanvasTopology`(nodes/edges)
- `SourceKind`(rdb|s3|unstructured)

mock-adapter에 샘플 토폴로지 선(先)제공 → real-adapter는 P2에서 채운다.

## 실행 시 필수 고려사항

> plan-review 검토 발견 — 서술형 사항. plan-run은 계획서만 읽으므로 여기 기록한다.

### ① 회귀 이유·범위 (기존 e2e를 깨뜨림)

- 기존 e2e `frontend/e2e/pipeline-view-toggle.spec.ts`는 **Grid/Graph 토글 + 노드 수 정확히 8개 + Serving planned 점선** 을 하드 검증한다(11개 케이스). 캔버스를 **대체**하면 이 스펙이 대량 실패한다.
- 헤지: 이 계획서는 캔버스를 **기존 토글과 공존**시키는 방향(범위 경계·리스크 헤지 참조)이므로 기존 스펙을 유지하되, 캔버스 뷰용 e2e를 **신규 추가**한다(대체 아님). 캔버스가 기존 토글을 제거하는 시점은 P3이며, 그때 pipeline-view-toggle.spec.ts를 재작성한다.
- `pipeline/+page.svelte`의 `selectedStageId` 초기값이 `'silver_masked'` 하드코딩(라인 19)이라 캔버스 배선 시 이 기본 선택 로직과 충돌하지 않는지 확인 필요.

### ② 테스트 하네스·환경 전제

- e2e는 playwright `webServer: npm run dev -- --port 5177`(`playwright.config.ts`)로 앱을 기동한다 → **워크트리에서 실행 불가**(node_modules gitignored·포트). Z-post(앱 기동 root)에서 실행.
- 어댑터 스왑은 `PUBLIC_UI_BACKEND_URL` 환경변수가 아니라 **`frontend/src/routes/[mode=mode]/+layout.ts`가 `params.mode`로 mock/real 어댑터를 선택**하는 구조다. `fetchCanvasTopology()`를 추가할 때 **mock·real 양쪽 어댑터에 동일 시그니처로** 넣어야 어댑터 스왑이 성립한다(real은 P2에서 채우는 스텁).

### ③ 실행 순서·동일 파일 편집 충돌

- 이 계획서와 **P3가 `frontend/src/routes/[mode=mode]/pipeline/+page.svelte`를 동시에 편집**한다(P1=캔버스 배선, P3=medallion 강등·페이지 해체). P1·P3를 병렬로 돌리면 충돌하므로 **P1 done 후 P3** 순서를 지킨다(인덱스 실행 순서와 정합).
- `PipelineGraphView.svelte`는 P1에서 개조하고, drill-down 패널은 P3에서 medallion 실내용을 주입한다 — P1은 **껍데기까지만**.

## 작업 목록

### A. 타입 계약 확장 (`types.ts`)

- [x] A-1. `frontend/src/lib/api/types.ts`에 노드 그래프 계약 추가 — 기존 타입 불변
  - [x] `SourceKind` 타입 추가 (`'rdb' | 's3' | 'unstructured'`)
  - [x] `ToolNode` 인터페이스 추가 (`id`, `kind: 'source'|'task'|'switch'|'sink'`, `tool`, `config`)
  - [x] `Edge` 인터페이스 추가 (`from`, `to`, `condition?`)
  - [x] `CanvasTopology` 인터페이스 추가 (`nodes: ToolNode[]`, `edges: Edge[]`)
  - [x] 기존 `Stage`/`Run`/`Dimension` export가 그대로 유지되는지 grep 확인

### B. mock 토폴로지 제공 + 어댑터 시그니처 정합

- [x] B-1. mock 샘플 토폴로지 데이터 작성
  - [x] `frontend/src/lib/mock/topology.ts` 신규 — 샘플 `CanvasTopology`(fan-in·branch·fan-out 각 1케이스 이상 포함)
  - [x] `frontend/src/lib/mock/selectors.ts`에 topology export 추가
- [x] B-2. 어댑터에 `fetchCanvasTopology()` 추가 (mock·real 시그니처 일치)
  - [x] `frontend/src/lib/api/mock-adapter.ts`에 `fetchCanvasTopology(): Promise<CanvasTopology>` 추가 (topology 반환)
  - [x] `frontend/src/lib/api/real-adapter.ts`에 `fetchCanvasTopology()` 스텁 추가 (미구현 마킹 — P2에서 채움), 시그니처는 mock과 동일

### C. 캔버스 컴포넌트 + 라우트 배선

- [x] C-1. 도구 노드 캔버스 컴포넌트 — `frontend/src/lib/components/ToolCanvasView.svelte` 신설
  - [x] `buildNodesAndEdges()`를 `CanvasTopology` 기반으로 구현 — 일반 DAG(fan-in·fan-out·branch) 렌더
  - [x] Source/Task/Switch/Sink 4종 시각 구분 (style 기반 색상 구분)
- [x] C-2. 노드 클릭 → drill-down 패널 **껍데기** (도구 내부 DAG/프로세서·medallion 카운트 자리 — 정적 mock, run_id 바인딩은 P3)
- [x] C-3. `frontend/src/routes/[mode=mode]/pipeline/+page.svelte`에 캔버스 뷰 배선 — 기존 Grid/Graph 토글과 **공존**(대체 아님, P3에서 정리), `selectedStageId='silver_masked'` 기본 선택과의 충돌 없음 확인

## 검증 기준

- [x] `/[mode]/pipeline`에서 도구 노드 캔버스가 뜨고 Source/Task/Switch/Sink 4종이 시각적으로 구분된다
- [x] 샘플 토폴로지에 fan-in·branch·fan-out이 각 1개 이상 보인다
- [x] 도구 노드 클릭 시 그 도구 내부(Airflow=DAG 6개 등)가 drill-down 패널에 펼쳐진다 (정적 mock 허용)
- [x] `types.ts` 신규 계약이 `svelte-check`/tsc 통과, mock-adapter 샘플이 계약을 만족한다

## TC (Right-BICEP · CORRECT)

> 단위: vitest(`frontend/src/**/*.test.ts`, node 환경) — topology→노드/엣지 빌드 순수 로직 대상. e2e: playwright(앱 기동, Z-post).

### Right-BICEP

- [ ] **Right(정상 경로)**: 샘플 토폴로지로 `buildNodesAndEdges()`가 Source/Task/Switch/Sink 노드와 엣지를 계약대로 생성한다
- [ ] **B(경계)**: 빈 토폴로지(nodes=[])·엣지 없는 단일 노드·자기참조 없는 최소 DAG에서 크래시 없이 빈/최소 렌더
- [ ] **I(역·부정)**: `edge.from`/`edge.to`가 존재하지 않는 노드 id를 가리킬 때 안전 처리(누락 엣지 무시 또는 명시적 처리)
- [ ] **C(교차 확인)**: 렌더된 노드 수 == `topology.nodes.length`, mock/real 어댑터의 `fetchCanvasTopology()` 시그니처 동일(svelte-check로 교차 검증)
- [ ] **E(에러 조건)**: `fetchCanvasTopology()` reject 시 캔버스가 빈 상태/에러 표시로 폴백(런타임 예외 전파 안 함)
- [ ] **P(성능)**: 해당 없음 — mock 소규모 토폴로지, 성능 임계 없음

### CORRECT

- [ ] **Conformance**: mock 샘플이 `CanvasTopology` 계약을 만족(svelte-check/tsc 통과)
- [ ] **Ordering**: 해당 없음 — DAG는 위상 관계를 가지나 노드 렌더 순서에 의존하지 않음
- [ ] **Range**: `ToolNode.kind`가 source|task|switch|sink 4종 범위, `SourceKind`가 rdb|s3|unstructured 범위 밖 값 거부(타입)
- [ ] **Reference**: real-adapter `fetchCanvasTopology()` 스텁이 존재해 어댑터 스왑 시 미정의 참조 없음(P2 구현 전제 마킹)
- [ ] **Existence**: 노드 클릭 시 drill-down 패널이 존재/렌더(정적 mock 내용 허용)
- [ ] **Cardinality**: 샘플 토폴로지에 fan-in(N→1)·fan-out(1→N)·branch(Switch) 카디널리티가 각 1케이스 이상 존재
- [ ] **Time**: 해당 없음 — 실시간/타이밍 의존 없음(SSE 바인딩은 P2/P3)

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> DB 스키마 변경 없음 → 마이그레이션 항목 생략. Node 프로젝트(node_modules gitignored)이므로 `check`/`build`/`test:unit`은 워크트리가 아니라 **머지 직후 원본 main**에서 실행한다.

### Z-pre. 머지 전 (워크트리 — 정적·격리만)

- [x] `frontend/src/lib/api/types.ts` 신규 계약 심볼 존재 grep 확인(`ToolNode`/`Edge`/`CanvasTopology`/`SourceKind`)
- [x] 워크트리 브랜치에 구현 커밋 (통합테스트·머지는 메인 책임)

### Z-static. 머지 직후 (원본 main — node_modules 상주)

- [x] `cd frontend && npm run check` (svelte-check/tsc) 통과 — 신규 계약·어댑터 시그니처 정합
- [x] `cd frontend && npm run build` 성공
- [x] `cd frontend && npm run test:unit` (vitest) 통과 — 7/7 통과 (topology 빌드 로직은 기존 params 테스트 기준)

### Z-post. push 후 (앱 기동 환경)

- [x] e2e 통합테스트 통과 확인 (`cd frontend && npm run test:e2e`, 앱 기동 전제)
  - [x] `frontend/e2e/pipeline-canvas.spec.ts` 신규 작성 — 캔버스 뷰 노드 4종·fan-in/out/branch 렌더·노드 클릭 drill-down 검증 (기존 `pipeline-view-toggle.spec.ts`는 **유지**, 대체 아님) — 7/7 통과
    - teardown: 앱 상태 변경 없음(읽기전용 mock 렌더) — DB/파일 레코드 생성 없어 teardown 불필요
  - [x] 기존 `pipeline-view-toggle.spec.ts`·`route-split.spec.ts` 회귀 없음 확인 — 27/27 전체 통과

## 재사용 자산

- 기존 `PipelineGraphView.svelte`(SvelteFlow 렌더·노드/엣지 빌드 로직) — 도구 노드용으로 개조
- `@xyflow/svelte ^0.1.39` (임의 DAG 지원)
- 기존 `mock/pipeline.ts`의 6단계 Stage 데이터 — Task 노드·drill-down 내부 DAG 표현에 재활용

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| `@xyflow/svelte 0.1.39`가 커스텀 노드 타입 API 제약 | 초기엔 `style` 기반 시각 구분(현 코드 방식)으로 4종 표현, 커스텀 노드 컴포넌트는 필요 시 후속 |
| 캔버스 전환이 기존 pipeline 페이지 회귀 유발 | Grid/Graph 토글을 P3까지 유지해 롤백 경로 확보 |
| P3 없이 캔버스가 "죽은 그림"으로 보임 | drill-down 껍데기에 "이 run의 증거는 P3에서 연결" 상태 명시, mock 카운트로 형태만 시연 |
