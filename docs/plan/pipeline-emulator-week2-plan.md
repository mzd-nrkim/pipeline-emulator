# 파이프라인 에뮬레이터 — Week 2 확장 계획서

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

## 3. 작업 항목 (Week 2)

### T1. ui-backend (FastAPI 집계 계층)

MVP의 상태 조회 로직(Airflow REST + MySQL 카운트)을 서비스로 승격.

- [ ] FastAPI 라우터 구성 — `/stages`, `/runs`, `/executions` (lodestar `blockers.py` 패턴: `/stages`, `/runs`, `/executions`로 재현)
- [ ] Airflow REST API 연동 — DAG 실행 현황(run 목록·상태·소요시간)
- [ ] MySQL 집계 쿼리 — 단계별 문서 수(입력/출력), 최근 처리 시각, 실패 사유
- [ ] PII 마스킹 현황 집계 — 마스킹/비마스킹 문서 수, `pii_pattern_types` 타입별 건수
- [ ] postgres 서비스 DB 스키마 — `pipeline_stage` / `pipeline_run` / `stage_execution` (lodestar `db/init.sql` 노드/엣지 상태머신 패턴 변형)
- [ ] **SSE 엔드포인트** — 실시간 단계 카운트 갱신 (lodestar `api.ts` `subscribeBridgeStatus` 패턴, 백엔드 SSE 인프라 활성화)

### T2. 커스텀 대시보드 — 파이프라인 페이지

> 요구사항 상세: [design-prompt-monitoring-dashboard.md](../design-prompt-monitoring-dashboard.md) "파이프라인 페이지"

- [ ] SvelteKit 프로젝트 셋업 + lodestar `DESIGN.md` 토큰 이식 (색상/타이포/간격, status 신호등 시맨틱)
- [ ] **@xyflow/svelte 읽기전용 단계 그래프** — Bronze/Silver/Gold 3레이어 고정 레이아웃, DAG 6개 노드, 엣지 방향, 확대·축소·이동
- [ ] 커스텀 노드 — 단계 이름·소속 계층·처리 상태(완료/진행/대기/실패/없음)·통과 문서 수·마지막 처리 시각. status 색상은 DESIGN.md 토큰
- [ ] 단계 세부 패널 — 입력/출력 문서 수, 최근 실행 시작·소요·성공여부, 실패 사유 (`SourceLaneGraph.svelte`·`StatusPill`·`ProgressTrack` 조합)
- [ ] PII 마스킹 현황 — 실버 마스킹 노드 선택 시 마스킹/비마스킹 수·PII 유형별 건수·현재 방식, 미적용 유형은 "예정" 표시
- [ ] 실행 이력 — 실행 회차 목록(식별자·시작·소요·결과), 선택 시 단계별 결과
- [ ] 검색 시연 노드 — 흐름 끝에 "예정" 상태로 노출 (미제공 안내)
- [ ] SSE 실시간 갱신 연동 (별도 새로고침 없이 반영), 모바일 우선 레이아웃

### T3. 설정 페이지 (feature-flag 뼈대 + 토글 UI)

> 요구사항 상세: design-prompt "설정 페이지" / 축 정의: decisions §설정 메뉴

- [ ] 구성 축 7개 노출 — Executor·수집기·CDC·검색서빙·청킹엔리치·PII마스킹·ES노드
- [ ] 각 축: 이름·현재 값·선택지·짧은 설명 표시
- [ ] **제공 축만 조작 가능** (MVP 종착이 Gold라 실제 켜지는 건 기본값). 미구현 축은 **비활성 + "다음 계획" 배지** — 로드맵 자체를 데모로 노출
- [ ] 의존 규칙 — ES 노드 축은 검색 서빙이 켜졌을 때만 조작 가능
- [ ] feature-flag 뼈대 — 환경변수 + Docker Compose profile 스위치를 화면에 노출·적용만 (코드 재작성 없이 로드맵 축이 붙는 구조)

### T4. 데모 시나리오 & 발표 자료

- [ ] 데모 시나리오 작성 — 투입 → 단계 통과 → Gold staged 적재까지의 시연 흐름
- [ ] 설정 메뉴로 로드맵(미구현 축) 보여주는 스토리 포함
- [ ] 발표 자료 준비 (경영진·고객·팀 시연용)

### T5. (스트레치, 여유 시) ES 검색 시연

- [ ] 데모 클라이맥스. 무거우면 로드맵에 그대로 둔다 → [post-mvp-roadmap "검색 서빙(ES)"](./pipeline-emulator-post-mvp-roadmap.md)

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

- [ ] 대시보드가 6개 DAG 노드를 Bronze/Silver/Gold 3레이어로 표시, 확대·축소·이동 동작
- [ ] 단계별 처리 상태·문서 수가 **SSE로 실시간 갱신** (수동 새로고침 없이 반영)
- [ ] 단계 선택 시 입력/출력 수·최근 실행 정보·실패 사유 표시
- [ ] 실버 마스킹 노드에서 PII 유형별 건수·마스킹 현황 표시, 미적용 유형 "예정" 구분
- [ ] 실행 이력에서 회차 선택 시 단계별 결과 조회
- [ ] 설정 페이지 7개 축 노출, 제공 축만 조작·미구현 축 "다음 계획" 배지 비활성
- [ ] ES 노드 축이 검색 서빙 off일 때 조작 불가
- [ ] 모바일 좁은 화면에서 전체 흐름 파악 가능
- [ ] 데모 시나리오 리허설 1회 통과 (투입→Gold staged 시연)

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
