# pipeline-emulator — n8n형 도구 오케스트레이션 캔버스로 구조 전환 (인덱스)

> 작성일: 2026-07-02 / 개정: 2026-07-15 (3분할 + 인덱스화)
> 이 문서는 **인덱스**다. 실행 계획은 아래 P1·P2·P3 개별 계획서에 있다.

현재 PipeScale는 Bronze→Silver→Gold medallion 단계를 읽기전용으로 시각화하는 **관찰(observability) 데모**다. 팀장 피드백은 이것을 n8n처럼 **인프라 도구(NiFi/Debezium/Airflow/ES)를 REST API로 간접 조종하는 시뮬레이터**로 보이게 하는 것이다. 즉 화면의 주인공을 "데이터 계층"에서 "도구 제어면"으로 옮기고, 기존 medallion 흐름은 도구 실행 결과를 보여주는 **부가 관찰 뷰**로 강등한다.

> 근거 대화: 노드=도구(데이터 계층 아님), 캔버스=도구 API 감싸는 제어면, medallion=부가뷰(run_id 연결), 노드 카탈로그=Source/Task/Switch/Sink, 캔버스=단일 backbone 못박지 않는 일반 DAG(fan-in/out/branch), 입도=도구 노드(굵게)+클릭 시 내부 DAG/프로세서 부가뷰 2계층.

---

## 왜 3분할인가

이 refactor는 성격·리스크·의존이 다른 3덩어리다. 이 레포의 기존 컨벤션(feat-f1~f7 + roadmap 인덱스)에 맞춰 독립 계획서로 분리했다.

| 계획 | 성격 | 선행/의존 | 착수 판단 |
|------|------|-----------|-----------|
| **[P1. 캔버스 UI 전환](./pipeline-emulator-refactor-canvas-ui.md)** | 순수 프론트, mock-adapter만으로 완결 | 없음 (선행 게이트 무관) | **즉시 착수 가능** ★★★ |
| **[P2. 도구 어댑터 실동작](./pipeline-emulator-refactor-tool-adapter.md)** | ui-backend Airflow POST/Variables **신규 구현** | A 스코프 확정 + 로컬 Airflow 스택 · P1 노드 계약 | 게이트·스택 확보 후 ★★ |
| **[P3. run_id 연결 + medallion 강등](./pipeline-emulator-refactor-runid-medallion.md)** | 프론트+백 통합, pipeline 페이지 해체 | **P1·P2 done** | 통합 단계, 마지막 ★★ |

**분리 근거:**
- P1은 mock만으로 "n8n처럼 **보이게**(A)" 목표를 달성한다 — 데모 핵심 가치가 여기서 나오고 백엔드 없이 검증된다. run_id 실연동을 기다릴 이유가 없다.
- P2는 아래 A/B 스코프 게이트와 로컬 Airflow 스택 가용성에 종속된다. P1을 여기 묶으면 백엔드 블로커가 프론트 진척을 인질로 잡는다. **주의: 현 `airflow.py`는 읽기 전용 — 트리거·Variables·pause는 확장이 아니라 신규.**
- P3는 P1·P2 양쪽에 의존하는 통합 지점이고 pipeline 페이지 해체를 수반한다.

## 선행 게이트 — A/B 스코프 확정 (P2·P3 종속)

착수 전 팀장과 **"n8n처럼 보이게(A) vs n8n처럼 동작하게(B)"**를 못박는다 — 스코프가 10배 갈린다.

- **A. 룩앤필 + 제한 조작(권장)**: 노드/배선/조건 UI는 n8n 감성이되, 토폴로지는 미리 정의된 것을 로드해 사용자는 **config 토글·조건 분기·트리거**만 조작. 대부분 프론트 + 기존 REST 감싸기로 달성, 2주 MVP 정신과 양립.
- **B. 완전 저작(대형)**: 사용자가 노드를 드래그·배선·저장해 DAG를 조립 → Airflow DAG 동적 생성/직렬화 백엔드 필요. 데모 아티팩트 범위를 크게 초과.

> P1·P2·P3 모두 **A 전제**로 작성됐다. B로 확정되면 별도 계획으로 재구성한다.
> **이 게이트는 P2/P3 범위를 흔들지만 P1(룩앤필)에는 영향이 거의 없다** — 게이트 대기 중에도 P1은 진행 가능.

## 실행 순서

```
[선행 게이트: A/B 확정] ──(A 확정 시)──┐
                                       │
P1 (캔버스 UI, mock)  ────────────────┼──→ P3 (run_id + medallion 강등)
                                       │        ↑
P2 (도구 어댑터 실동작) ───────────────┘────────┘
```

- **P1은 게이트와 무관하게 지금 착수**한다.
- P2는 게이트 A 확정 + 로컬 Airflow 스택 확보 후.
- P3는 P1·P2 done 후 통합.

## 참고 (코드베이스 실측, 2026-07-15)

- 노드 그래프 계약(`ToolNode`/`Edge`/`CanvasTopology`/`SourceKind`)은 `frontend/src/lib/api/types.ts`에 신설 — 기존 `Stage`/`Run`/`Dimension`은 부가뷰용 유지.
- `@xyflow/svelte ^0.1.39`가 임의 분기·병합(일반 DAG)을 이미 지원.
- `ui-backend/app/services/airflow.py`는 **읽기 전용**(`GET dagRuns`) — 트리거·Variables·pause는 P2에서 신규 구현.
- pipeline 페이지 `RUN_ID: RX-9042-ALPHA`는 하드코딩 — P3에서 실 발급으로 대체.

## 저장 위치 주의

이 계획서군은 `pipeline-emulator/docs/plan/`(tools 레포 밖)에 있다. tools/stashdex 계획서 라우팅 규칙이 아니라 이 레포의 기존 `docs/plan/` 컨벤션(feat-f*.md 패턴)을 따른다.
