# [FEAT] 인프라 연결 뷰 실체화 (스텁 3엣지 → 유의미한 의존 그래프)

> 상태: 통테통과-완료

인프라 뷰가 `dependency` 채널 **엣지 3개**(`es→kibana`, `mysql컨테이너→debezium`, `mysql컨테이너→nifi`)만 가져, 화면에 **서로 안 이어진 조각 2개**로 렌더된다. 게다가 `es`는 들어오는 의존 엣지가 없어 위상정렬이 소스로 오판 → **좌상단**에 배치(사용자가 "ES가 왜 맨 왼쪽 위냐"고 지적한 원인). "뷰"라 부를 실체가 없다.

> 근거(코드 확인, 2026-07-15):
> - `frontend/src/lib/mock/topology.ts:198-203` — dependency 엣지 3개뿐. `es→kibana`, `mysql-container→debezium/nifi`.
> - `frontend/src/lib/canvas/buildNodesAndEdges.ts:computeDepths` — in-degree 0 노드를 depth 0(좌상단) 배치. infra 뷰에서 `es`는 in-degree 0 → 좌상단.
> - 두 dependency 서브그래프가 연결점 없음 → 화면상 분리된 2조각.

## 결함
- **C-1 의존 데이터 빈약**: 실제 `docker-compose` 서비스 의존(airflow↔valkey, es↔ml-node, 각 도구↔mysql 등)이 topology의 `dependency` 채널에 거의 반영 안 됨.
- **C-2 레이아웃 오배치**: 방향성 없는 의존 그래프에 데이터흐름용 위상정렬을 그대로 적용 → `es` 등 좌상단 오판.

## 목표
- 인프라 뷰가 **실제 컨테이너/서비스 의존 관계**를 반영해 연결된(또는 의미 있는 그룹) 그래프로 렌더된다.
- 의존 그래프에 맞는 레이아웃(방향성 약한 그래프용)으로 배치돼 "시작점 오판"이 사라진다.

## 접근 방법
1. **의존 데이터 확충**: `docker-compose.yml` 서비스·`depends_on`·네트워크를 근거로 `dependency` 엣지를 확충(각 도구 노드 ↔ 인프라 컨테이너: mysql/valkey/es/airflow-meta 등).
2. **레이아웃 재고**: 인프라 뷰는 데이터흐름의 좌→우 위상정렬이 부적합 → 계층(컨테이너/서비스/스토리지 grouping) 또는 force-directed 배치로 분리. 최소한 in-degree 0 오판 방지(무방향 취급 옵션).
3. **연결성 점검**: 렌더 결과가 고립 조각 남발이 아니라 의미 있는 그룹(예: 스토리지 계층·수집 계층)으로 읽히는지 검증.

## 실행 시 필수 고려사항

- **회귀 범위**: `topology.ts`는 데이터뷰·인프라뷰가 공유하는 mock 소스다. `dependency` 채널·노드를 확충하면 **데이터뷰(dataflow 채널) 렌더에도 노드 목록이 반영**될 수 있으므로, dataflow 채널만 소비하는 데이터뷰가 신규 컨테이너 노드로 오염되지 않는지 확인해야 한다(채널 필터링 경로 점검). `buildNodesAndEdges.computeDepths` 변경은 **데이터뷰 위상정렬을 건드리지 않도록** infra 뷰 분기 안에 격리한다.
- **환경 전제**: `frontend/node_modules`는 gitignored → 워크트리에 없다. `npm run check`/`build`·e2e는 워크트리에서 신뢰 불가 → **머지 후 원본 main(Z-post)** 에서 실행. 정적 검증만 Z-pre.
- **실행 순서·병렬성**: Phase A(`topology.ts` 데이터)와 Phase B(`buildNodesAndEdges.ts` 레이아웃)는 **다른 파일군**이라 구현은 병렬 가능하나, **B-2 검증은 A 확충 그래프 위에서만 의미**가 있으므로 검증 시점은 A 이후. A-1·A-2는 같은 `topology.ts`(A-1은 조사·A-2는 편집)이므로 한 에이전트로 묶는다.
- **미선택 결정 근거(B-1)**: 배치 전략은 (a) 계층 grouping vs (b) force-directed 택1 — **실물 확인 후 결정**. force-directed는 라이브러리 도입 공수·비결정적 배치(스냅샷 e2e 취약)가 단점, 계층 grouping은 컨테이너/서비스/스토리지 계층을 코드로 고정해 단순·결정적이나 그룹 규칙을 수기 정의해야 함. 노드 수가 수십 개 규모면 계층 grouping이 기본 후보. 탈락 옵션의 하위 체크박스는 결정 후 제거 표기한다.

## 작업 목록

### A. 의존 데이터 확충

- [x] A-1. `docker-compose.yml` 서비스·`depends_on`·연결 env 조사 → 의존 엣지 대응표 산출 (path: docker-compose.yml, 앵커: services 전수·각 서비스 depends_on/environment, 의도: 실제 컨테이너 의존을 dependency 엣지 근거로 목록화)
  - [x] 각 도구 서비스의 `depends_on`·연결 대상 env(MYSQL_HOST 등) 추출 (path: docker-compose.yml, 앵커: services)
  - [x] 도구 노드 ↔ 인프라 컨테이너(mysql/valkey/es/airflow-meta) 대응표 작성 (산출: 계획서 부록 표 또는 `topology.ts` 주석)
- [x] A-2. `topology.ts` `dependency` 채널에 엣지·컨테이너 노드 확충 (path: frontend/src/lib/mock/topology.ts, 앵커: dependency 엣지 배열 198-203 및 노드 정의, 의도: 3엣지 → 대응표 기반 실 의존 반영)
  - [x] 누락 컨테이너 노드(valkey/airflow-meta 등) 추가 (path: frontend/src/lib/mock/topology.ts, 앵커: 노드 목록)
  - [x] 대응표의 각 의존을 `dependency` 엣지로 추가 (path: frontend/src/lib/mock/topology.ts, 앵커: dependency 엣지 배열 198-203)
  - [x] 데이터뷰(dataflow 채널)가 신규 컨테이너 노드로 오염되지 않는지 채널 필터링 확인 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: 채널별 노드/엣지 필터)

### B. 레이아웃

- [x] B-1. 인프라 뷰 배치 전략 택1 도입 (계층 grouping vs force-directed, **실물 확인 후 결정**) (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: computeDepths 및 배치 진입점, 의도: 데이터뷰 위상정렬과 분리)
  - [x] infra 뷰 여부에 따라 배치 분기(뷰 파라미터/플래그) 도입 — 데이터뷰 경로 불변 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: 배치 진입점)
  - [x] 결정 근거(force 라이브러리 공수·비결정성 vs 계층 grouping 단순·결정성) 확인 후 미채택 옵션 하위 항목 제거 표기 (§열린 항목 표와 대조)
- [x] B-2. in-degree 0 오판(es 좌상단) 해소 — 무방향 취급 또는 계층 고정 배치 검증 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts, 앵커: computeDepths in-degree 계산, 의도: 의존 그래프를 소스로 오판하지 않음)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (워크트리/정적)

- [x] 변경 대상 `topology.ts`·`buildNodesAndEdges.ts` `npx svelte-check --diagnostic-sources`(또는 `tsc --noEmit`) 정적 통과 — env 미가용 시 Z-post 강등
- [x] `dependency` 엣지가 A-1 대응표와 1:1 대응하는지 grep 대조
- (Node 정적 게이트: frontend `npm run check`/`build`는 Z-pre 제외 → 머지 후 원본 main)

#### Z-post. push 후 (앱 기동 환경)

- [x] 머지 직후 원본 main에서 frontend `npm run check` + `npm run build` 통과 (Node 정적 게이트)
- [x] e2e: 인프라 뷰 전환 시 연결 그래프 렌더(고립 조각 아님)·`es` 비-좌상단 단언
  - [x] `infra-view.spec.ts`(또는 기존 e2e에 infra 케이스) 신규 작성 — 뷰 전환 후 엣지 수·`es` 위치 단언 (미존재 시 필수)
    - teardown: 읽기전용 mock 렌더 — DB/파일 side-effect 없음(정리 불요)

## TC (Right-BICEP · CORRECT)

- [x] **Right (정상)**: 인프라 뷰가 실제 서비스 의존을 반영, `es`가 좌상단 소스로 오판되지 않음.
- [x] **B (경계)**: dependency 엣지 0개일 때 빈 뷰 안내(크래시 없음).
- [x] **I (역/교차검증)**: 인프라 엣지가 `docker-compose` depends_on과 대조 일치(수기 대조).
- [x] **C (에러)**: 존재하지 않는 노드를 가리키는 dangling dependency 엣지 → 크래시 없이 무시·경고.
- Inverse: 배치는 가역 연산 아님 — 뷰 왕복 후 상태 오염 없음(아래 Reference로 대체) → "해당 없음".
- **P (성능)**: 노드/엣지 수십 개 규모 — 렌더 성능 이슈 없음 → "해당 없음".
- Reference: 데이터뷰↔인프라뷰 전환 왕복 후 상태 오염 없음(공유 `topology.ts` 채널 필터가 서로 격리).
- CORRECT-Ordering: 같은 입력에 대해 배치 결정적(계층 grouping 채택 시) — force-directed 채택 시 시드 고정 필요.
- CORRECT-Cardinality: 렌더 결과 고립 조각 수가 의미 있는 그룹 수(스토리지/수집 계층 등)로 수렴, 무의미한 단독 조각 남발 없음.
- CORRECT-Existence: `dependency` 채널 미정의 노드도 뷰가 빈 상태로 안전 렌더.

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 배치 전략(계층 vs force) | plan-review 결정 → B-1 반영 | 계층 grouping 기본 후보(결정성·저공수), force는 라이브러리 도입 시 |
| 인프라 뷰 우선순위 | 사용자 확인 | 데이터뷰 정합(bug plan) 이후 |
