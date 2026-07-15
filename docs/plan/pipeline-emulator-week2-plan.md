# 파이프라인 에뮬레이터 — Week 2 확장 계획서

> 상태: 머지완료-통테대기
> 방향전환 판단(2026-07-15): **재스코프 필요**. "고정 6단계 대시보드"가 도구 오케스트레이션 캔버스 + medallion 드릴다운(P3)과 정면 중복. 설정 메뉴·데모 시나리오는 유효하되 대시보드부는 캔버스로 흡수/재정의 필요. 잔여 항목 착수 전 이 부분 먼저 확정할 것.

> 작성일: 2026-07-14 / 상태: 초안 (MVP 완료 후 착수)
> 선행: [pipeline-emulator-mvp-plan.md](./pipeline-emulator-mvp-plan.md) (Week 1 MVP 완료가 전제)
> 근거: [pipeline-emulator-decisions.md](../pipeline-emulator-decisions.md) §5·§6 · [lodestar-reuse-assessment.md](../lodestar-reuse-assessment.md) · [design-prompt-monitoring-dashboard.md](../design-prompt-monitoring-dashboard.md)
> 이후 로드맵: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)

---

## 1. 목표

MVP(Week 1)가 확보한 "파이프라인이 흐른다"를, **커스텀 통합 대시보드 + 설정 메뉴 + 데모 시나리오**로 확장해 **경영진·고객 시연용 데모 아티팩트**를 완성한다.

**성공 기준**: MVP보다 기능이 명확히 많은 데모. 커스텀 대시보드로 단계별 처리 현황이 실시간으로 보이고, 설정 메뉴가 에뮬레이터 구성 축(로드맵 포함)을 노출하며, 발표 가능한 데모 시나리오가 준비된 상태.

- **원칙**: Week 1은 버려지지 않는다 — Airflow REST 연동·MySQL 카운트 쿼리(MVP T7)를 ui-backend가 그대로 흡수하는 **증분**이다.
- **범위 밖**: ES 검색 시연은 스트레치(일정 여유 시). 무거우면 [post-mvp-roadmap](./pipeline-emulator-post-mvp-roadmap.md)에 그대로 둔다.

---

## 2. 컨테이너 추가 (MVP 4개 → 7개)

MVP 코어(seaweedfs·mysql·airflow·mock-api)에 모니터링 3서비스를 추가한다.

```
+ ui-backend   모니터링 백엔드 (FastAPI: Airflow REST + MySQL 집계·SSE, lodestar 재사용)
+ postgres     모니터링 앱 상태 저장 (서비스 DB, lodestar db/init.sql 변형)
+ ui           모니터링 대시보드 (SvelteKit + @xyflow/svelte)
```

> **DB 분리 완성**: 파이프라인 데이터 = MySQL, 모니터링 앱 상태 = postgres(서비스 DB). pgvector는 ES 임베딩이 로드맵 이후라 MVP·Week2 서비스 DB엔 불필요.
> lodestar `docker-compose.yml`(postgres+backend+frontend 3서비스) 골격을 그대로 채택.

---

## 실행 시 필수 고려사항

1. **이미 구현된 [x] 항목 다수**: T2·T3에 `[x]` 항목이 다수 — plan-run Phase 에이전트는 `[x]` 항목을 스킵하고 미완 `[ ]` 항목만 구현한다. 착수 전 실물 파일(frontend/ 컴포넌트) 확인 필수.
2. **@xyflow/svelte vs CSS Grid 결정**: T2의 `@xyflow/svelte 단계 그래프` 항목이 "현재 CSS Grid 기반 StageNode로 대체됨"으로 표기됨 — 실물 `frontend/` 확인 후 xyflow 도입 여부 결정 필요. 확인 없이 무조건 구현 금지.
3. **SSE 의존성 (T1→T2 직렬)**: T1-6 SSE 엔드포인트(ui-backend) 완료 후 T2의 SSE 연동(SvelteKit) 착수. 두 작업은 같은 Phase에 병렬화 불가.
4. **feature-flag 백엔드 반영 범위 밖**: T3의 feature-flag는 "UI 토글만 구현, 실제 백엔드 반영 없음"으로 명시 — 백엔드 환경변수 즉시 수정은 Week 2 범위 외. 구현 범위 초과 금지.
5. **Week 1 MVP 완료 전제**: T1이 MVP T7(MySQL 카운트·Airflow REST)을 흡수하므로, MVP가 먼저 완료된 상태에서 착수.

## 3. 작업 항목 (Week 2)

### T1. ui-backend (FastAPI 집계 계층)

MVP의 상태 조회 로직(Airflow REST + MySQL 카운트)을 서비스로 승격.

- [x] T1-1. FastAPI 라우터 구성 (`ui-backend/app/api/`)
  - [x] `/stages` 라우터 — 단계별 문서 수·상태·마지막 처리 시각
  - [x] `/runs` 라우터 — DAG 실행 회차 목록·상태·소요시간
  - [ ] `/executions` 라우터 — 단계별 실행 결과 (run_id 기준)
- [x] T1-2. Airflow REST API 연동 모듈 (`ui-backend/app/services/airflow.py`)
  - [x] DAG 실행 현황 조회 (run 목록·상태·소요시간)
  - [x] MVP T7 Airflow REST 연동 로직 이관
- [x] T1-3. MySQL 집계 쿼리 모듈 (`ui-backend/app/services/mysql_aggregator.py`)
  - [x] 단계별 문서 수(입력/출력) 집계
  - [x] 최근 처리 시각, 실패 사유 조회
  - [x] MVP T7 MySQL 카운트 쿼리 이관
- [x] T1-4. PII 마스킹 현황 집계 모듈 (`ui-backend/app/services/pii_stats.py`)
  - [x] 마스킹/비마스킹 문서 수 집계
  - [ ] `pii_pattern_types` 유형별 건수 집계
- [ ] T1-5. postgres 서비스 DB 스키마 DDL (`ui-backend/db/init.sql`)
  - [ ] `pipeline_stage` 테이블 DDL
  - [ ] `pipeline_run` 테이블 DDL
  - [ ] `stage_execution` 테이블 DDL (FK: `pipeline_run_id` → `pipeline_run`)
- [x] T1-6. **SSE 엔드포인트** (`/sse/stages`) 구현
  - [x] `asyncio` 기반 SSE 응답 스트리밍 (lodestar `subscribeBridgeStatus` 패턴 참조)
  - [x] 단계 카운트 갱신 이벤트 emit (폴링 주기 설정)

### T2. 커스텀 대시보드 — 파이프라인 페이지

> 요구사항 상세: [design-prompt-monitoring-dashboard.md](../design-prompt-monitoring-dashboard.md) "파이프라인 페이지"

- [x] SvelteKit 프로젝트 셋업 + lodestar `DESIGN.md` 토큰 이식 (색상/타이포/간격, status 신호등 시맨틱)
- [ ] **@xyflow/svelte 읽기전용 단계 그래프** → **[pipeline-emulator-feat-dag-graph-toggle.md](./pipeline-emulator-feat-dag-graph-toggle.md) 로 이관**
  - Grid 뷰 기본 유지 + 우측 토글로 DAG Graph 뷰 전환 방식으로 확정
  - (현재 CSS Grid 기반 StageNode 구현 실물 확인 완료 — 별도 계획서에서 구현)
- [x] 커스텀 노드 — 단계 이름·소속 계층·처리 상태(완료/진행/대기/실패/없음)·통과 문서 수·마지막 처리 시각. status 색상은 DESIGN.md 토큰
- [x] 단계 세부 패널 — 입력/출력 문서 수, 최근 실행 시작·소요·성공여부, 실패 사유
- [x] PII 마스킹 현황 — 실버 마스킹 노드 선택 시 마스킹/비마스킹 수·PII 유형별 건수·현재 방식, 미적용 유형은 "예정" 표시
- [x] 실행 이력 — 실행 회차 목록(식별자·시작·소요·결과), 선택 시 단계별 결과
- [x] 검색 시연 노드 — 흐름 끝에 "예정" 상태로 노출 (미제공 안내)
- [x] SSE 실시간 갱신 연동 (별도 새로고침 없이 반영), 모바일 우선 레이아웃 _(SSE real-adapter 구현 완료)_
  - [x] `EventSource` 클라이언트 구현 (lodestar `frontend/src/lib/api.ts` `subscribeBridgeStatus` 패턴 참조)
  - [x] SSE 이벤트 수신 시 단계 카운트·상태 자동 갱신 (T1-6 SSE 엔드포인트 완료 후 연동)

### T3. 설정 페이지 (feature-flag 뼈대 + 토글 UI)

> 요구사항 상세: design-prompt "설정 페이지" / 축 정의: decisions §설정 메뉴

- [x] 구성 축 7개 노출 — PII마스킹·검색서빙·청킹방식·엔리치먼트·Presidio레이어·분산실행·ES클러스터
- [x] 각 축: 이름·현재 값·선택지·짧은 설명 표시
- [x] **제공 축만 조작 가능**. 미구현 축은 **비활성 + "다음 계획" 배지** — 로드맵 자체를 데모로 노출
- [x] 의존 규칙 — ES 노드 축은 검색 서빙이 off일 때 조작 불가
- [x] feature-flag 뼈대 — 환경변수 + Docker Compose profile 스위치를 화면에 노출·적용 _(UI 토글만 구현, 실제 백엔드 반영 없음)_
  - [x] 현재 feature-flag 상태 읽기 API 엔드포인트 구현 (`/config` 또는 `/flags`)
  - [x] 토글 변경 UI 반응 — 변경 시 "재시작 필요" 안내 표시 (백엔드 즉시 반영은 Week 2 범위 밖)

### T4. 데모 시나리오 & 발표 자료

- [x] T4-1. 데모 시나리오 문서 작성 (`docs/demo-scenario.md`)
  - [x] 투입 → Bronze → Silver → Gold staged 단계별 시연 흐름 기술
  - [x] 각 단계에서 대시보드에서 확인할 내용 명시 (노드 상태·카운트·세부 패널)
- [x] T4-2. 설정 메뉴 로드맵 스토리 추가 (T4-1 문서에 섹션 추가)
  - [x] 미구현 축(검색서빙·Presidio·분산실행·ES클러스터)의 "다음 계획" 배지 시나리오 포함
- [x] T4-3. 발표 자료 준비 (경영진·고객·팀 시연용)
  - [x] 흐름 다이어그램 + 주요 수치 (Week 2 성과)
  - [x] 아키텍처 설명 슬라이드

### T5. (스트레치, 여유 시) ES 검색 시연

- [ ] 데모 클라이맥스. 무거우면 로드맵에 그대로 둔다 → [post-mvp-roadmap "검색 서빙(ES)"](./pipeline-emulator-post-mvp-roadmap.md)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (worktree에서 실행)

- [ ] `ui-backend/db/init.sql` SQL 문법 검사 (postgres DDL dry-parse)
- [ ] FastAPI 라우터 Python 문법 검사 (`python -m py_compile ui-backend/app/api/*.py`)
- [ ] SSE 엔드포인트 단위 테스트 — 이벤트 emit 형식 검증 (Python 환경 가용 시)

#### Z-post. 머지 후 (앱 기동 환경에서 실행)

- [ ] `npm run check` — SvelteKit 타입 검사 (원본 main에서, node_modules 상주 전제)
- [ ] `npm run build` — SvelteKit 빌드 통과 확인
- [ ] `docker-compose up -d` → 7서비스(MVP 4 + ui-backend·postgres·ui) 전체 기동 확인
- [ ] 대시보드 통합 테스트
  - [ ] SSE 연결 후 `/sse/stages` 이벤트 수신 확인 (단계 카운트 갱신)
  - [ ] 단계 노드 선택 → 세부 패널 (입력/출력 수·실행 정보·실패 사유) 표시 확인
  - [ ] 설정 페이지 7개 축 표시, 미구현 축 비활성 "다음 계획" 배지 확인
  - teardown: `docker-compose down -v` — 볼륨 포함 초기화

---

## TC (테스트 케이스)

### Right-BICEP

**R — Results are right:**
- [ ] SSE 엔드포인트(`/sse/stages`) 연결 후 단계 카운트 이벤트 수신 확인
- [ ] 대시보드에서 단계 노드 선택 시 세부 패널 표시 (입력/출력 수·실행 정보·실패 사유)
- [ ] 설정 페이지 7개 축 모두 표시, 미구현 축 "다음 계획" 배지 + 비활성화 상태
- [ ] ui-backend `/stages` 응답의 문서 수가 MySQL 직접 쿼리 결과와 일치

**B — Boundary conditions:**
- [ ] ES 노드 축: 검색 서빙 off 시 조작 불가, on 시 조작 가능 (의존 규칙 검증)
- [ ] SSE 연결 해제 후 재연결 시 최신 상태로 복구 확인 (reconnect 동작)
- [ ] 실행 이력 없는 단계 노드: 패널에 "실행 없음" 메시지 표시 (null 에러 없음)

**I — Inverse relationships:**
- [ ] feature-flag 토글 off → 해당 축 비활성화 배지 표시 (UI 반응 확인)
- 백엔드 즉시 반영 검증: 해당 없음 (Week 2 범위 밖으로 명시됨)

**C — Cross-check using other means:**
- [ ] ui-backend `/runs` 응답의 실행 이력이 Airflow REST API 응답과 일치

**E — Error conditions:**
- [ ] ui-backend가 MySQL 연결 실패 시 HTTP 500 + 에러 메시지 반환
- [ ] SSE 연결 중 Airflow 응답 지연 시 timeout 처리 (연결 유지)

**P — Performance characteristics:**
- 해당 없음: Week 2는 데모 규모(5건), 성능 측정 범위 밖

### CORRECT

**C — Conformance:**
- [ ] `pipeline_stage`/`pipeline_run`/`stage_execution` 스키마가 DDL 명세와 일치
- [ ] SSE 이벤트 포맷이 lodestar `subscribeBridgeStatus` 패턴과 호환

**O — Ordering:**
- [ ] 실행 이력 목록: 최신 run이 상단 정렬
- [ ] 단계 세부 패널: 최근 실행이 상단 표시

**R — Range:**
- [ ] 대시보드 문서 수: 음수 표시 없음
- [ ] SSE 이벤트: `count` 필드 ≥ 0

**R — Reference integrity:**
- [ ] `stage_execution.pipeline_run_id` FK가 `pipeline_run` 레코드를 참조 (orphan 없음)

**E — Existence (null handling):**
- [ ] PII 마스킹 노드 외 다른 노드 선택 시: PII 패널 미표시 (에러 없음)
- [ ] 단계 실행 이력 없을 때: 빈 목록 표시 (null 에러 없음)

**C — Cardinality:**
- [ ] postgres `pipeline_stage` 행 수 = 6 (Bronze·Silver·Gold 단계 수)
- [ ] SSE 이벤트: DAG 실행 완료 시 해당 단계 이벤트 emit

**T — Time / temporal ordering:**
- [ ] SSE 갱신: DAG 실행 완료 후 폴링 주기 이내 대시보드 반영 (설정값 명시 후 검증)

---

## 4. 재사용 자산 매핑 (lodestar)

| Week 2 작업 | lodestar 재사용 | 비고 |
|-------------|-----------------|------|
| ui-backend 라우터 | `backend/app/api/blockers.py` | `/stages`·`/runs`·`/executions` 패턴 |
| SSE 실시간 갱신 | `frontend/src/lib/api.ts` | `subscribeBridgeStatus` 패턴 |
| 서비스 DB 스키마 | `db/init.sql` | 노드/엣지 상태머신 → pipeline_* 변형 |
| compose 골격 | `docker-compose.yml` | postgres+backend+frontend 3서비스 |
| 상태 배지·진행 | `StatusPill.svelte`·`StatusDot.svelte`·`ProgressTrack.svelte` | 노드/패널 표현 |
| 레인 그래프 | `SourceLaneGraph.svelte` | xyflow 노드 내부/부가 패널 조합 |
| 디자인 토큰 | `DESIGN.md`·`statusStroke.ts` | status 신호등 색상 |
| 상태 패턴 | `loadstar-store.svelte.ts` | Svelte 5 `$state` 단일 스토어 |

> @xyflow/svelte는 **신규 도입**(lodestar엔 없음). 읽기전용 3레이어라 lodestar가 피한 editable 리스크가 해당 없고, Svelte Flow 1.0 정식 릴리스로 runes 안정성 해소. 근거: [lodestar-reuse-assessment.md](../lodestar-reuse-assessment.md) §1.

---

## 5. 검증 기준 (Week 2 완료 게이트)

- [x] 대시보드가 8개 단계 노드(Bronze·Silver·Gold·Serving)를 표시 _(xyflow 그래프 미사용, CSS Grid 기반 구현)_
- [ ] 단계별 처리 상태·문서 수가 **SSE로 실시간 갱신** (수동 새로고침 없이 반영) _(미구현 — mock 데이터)_
- [x] 단계 선택 시 입력/출력 수·최근 실행 정보·실패 사유 표시
- [x] 실버 마스킹 노드에서 PII 유형별 건수·마스킹 현황 표시, 미적용 유형 "예정" 구분
- [x] 실행 이력에서 회차 선택 시 단계별 결과 조회
- [x] 설정 페이지 7개 축 노출, 제공 축만 조작·미구현 축 "다음 계획" 배지 비활성
- [x] ES 노드 축이 검색 서빙 off일 때 조작 불가
- [x] 모바일 좁은 화면에서 전체 흐름 파악 가능 (반응형 레이아웃 구현)
- [ ] 데모 시나리오 리허설 1회 통과 (투입→Gold staged 시연) _(미구현)_

---

## 6. Week 1 → Week 2 연속성 (버려지지 않는 증분)

| Week 1 자산 | Week 2 흡수 방식 |
|-------------|------------------|
| Airflow REST 연동 (T7) | ui-backend `/runs` 라우터로 승격 |
| MySQL 카운트 쿼리 (T7) | ui-backend `/stages` 집계로 승격 |
| 환경변수 + compose profile 구조 (§6) | 설정 메뉴가 화면 노출·적용만 추가 |
| DAG·Mock API·PII 래퍼 | 변경 없음 — 대시보드는 순수 읽기전용 관측자 |

---

## 7. 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| Week 2 일정 초과 | MVP(Week 1)가 이미 "흐름 증명" 데모를 확보 → Week 2 미완이어도 시연 가능. 대시보드→설정→ES 순 우선순위로 절삭 |
| @xyflow/svelte 신규 도입 리스크 | 읽기전용에 한정(editable 미사용) → 안정성 걱정 최소. 복잡 인터랙션 확장 시 재검증 |
| ES 검색 스트레치가 일정 압박 | 스트레치로 분리 — 무거우면 로드맵으로 이연, Week 2 완료 판정에서 제외 |
