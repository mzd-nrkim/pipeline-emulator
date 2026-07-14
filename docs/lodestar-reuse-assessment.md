# lodestar 재사용 자산 조사 — 파이프라인 에뮬레이터 모니터링 UI

> 작성일: 2026-07-13 / 상태: 조사 완료 (참고용)
> 관련 문서: [pipeline-emulator-decisions.md](./pipeline-emulator-decisions.md)
> 대상 소스: `/Users/mz01-risingnrkim/workspace_mzd/lodestar`

---

## 목적

데이터 파이프라인 에뮬레이터(Bronze→Silver→Gold 단계별 처리 현황 실시간 모니터링 UI + Docker Compose 경량 스택, **ES 단계는 MVP 이후 확장**)를 새로 만들 때, 기각된 `lodestar` 프로젝트에서 **가져다 쓸 만한 재사용 자산**을 식별한다.

---

## lodestar 기술 스택 요약

| 레이어 | 스택 |
|--------|------|
| 프론트 | SvelteKit 2.0 + Svelte 5 (`$state`/`$derived` runes), Tailwind CSS 4, bits-ui, lucide-svelte |
| 백엔드 | FastAPI (Python), Pydantic, async |
| DB | PostgreSQL 16 + pgvector |
| 인프라 | Docker Compose 3서비스 (postgres + backend + frontend) |
| 그래프 시각화 | **@xyflow/svelte 미사용 — 자체 SVG 캔버스 구현** |

---

## 1. svelte flow(@xyflow/svelte)를 안 쓴 이유

lodestar는 노드/엣지 그래프를 기성 라이브러리 대신 자체 SVG(`FlowCanvas.svelte`, `canvas-helpers.ts`, `SourceLaneGraph.svelte`)로 구현했다. 근거는 다음과 같다.

### 명시적 이유 (문서 인용)

**`GraphCanvas.README.md` — "현재 임시 구현 유지 이유"**
1. Svelte 5 runes + XYFlow 조합의 프로덕션 안정성 미확인 (2026-07 기준 runes 지원이 베타 단계)
2. 커스텀 SVG 구현으로 현재 요구사항(블로커 시각화, propagation, CRUD) 완전 충족
3. `GraphCanvas.svelte` 래퍼가 있어 언제든 교체 가능 — 조기 최적화 불필요

> 초기 기술 검토 문서(`CLAUDE.md`, `제품정의.md §5.3`)에는 "스택: Svelte Flow"로 적혀 있었으나, **실제 M0 구현은 커스텀 SVG**로 진행됨. 즉 후보로 고려했다가 구현 단계에서 자체 구현으로 선회.

### 추정 이유 (코드·요구사항에서 추론)

- **고정 밴드 레이아웃 + 도메인 제약**: 데이터 성숙도 계층을 X 좌표에 고정(BRONZE_X→SILVER_X→GOLD_X→…)하고 레이어 경계를 넘는 드래그를 막는(`clampToLayer()`) 요구. @xyflow의 자유 레이아웃 자유도와 어긋나, 경계 계산·제약을 순수 함수(`canvas-helpers.ts`)로 직접 구현하는 편이 테스트하기 쉬움.
- **도메인 특화 시각화**: 위협 전파 점선(propagation), 5가지 상태 색상, 노드 모양 차별화(source 원기둥 / processor 육각형 / storage 직육면체 / milestone 마름모), 근거 인용 오버레이 — 범용 라이브러리 커스터마이징 오버헤드 회피.
- **MVP 속도 + 팀 학습곡선**: 2주 주기 MVP에서 라이브러리 마이그레이션·runes 안정화 대기 리스크보다, 순수 SVG + 순수함수 테스트 경로가 리스크 낮음.

### 에뮬레이터 관점 시사점 → **결론: @xyflow/svelte 권장**

우리 에뮬레이터의 모니터링 UI는 **읽기전용 3레이어 고정 레이아웃**(Bronze/Silver/Gold, **ES는 MVP 이후**)이라 오히려 요구가 더 단순하다. 재검토 결과 **@xyflow/svelte 신규 도입**으로 방향을 잡는다.

**근거 — lodestar의 미채택 이유가 우리 케이스엔 무효화됨:**
1. **안정성 우려 해소**: Svelte Flow **1.0이 2025-05 정식 릴리스**되며 내부 store를 전부 runes로 재작성해 Svelte 5를 정식 지원. lodestar 문서(2026-07)의 "runes 베타" 서술은 시점상 뒤처짐. (일부 문서는 여전히 "활발한 개발 중, API는 비교적 안정" — 읽기전용엔 충분, 복잡한 CRUD엔 재검증 권장)
2. **lodestar의 진짜 미채택 이유는 "editable"**: 드래그·레이어 경계 제약·CRUD 상태동기화 리스크였음. 우리는 **읽기전용 출력**이라 해당 리스크가 통째로 사라짐.
3. **디자인 부담 = xyflow의 강점**: background 그리드·controls·미니맵·화살표 엣지·노드 핸들이 기본 제공. 자체 SVG는 이를 전부 직접 그려야 함 → 데모/발표 폴리시를 낮은 노력으로 확보.

| | 자체 SVG 차용 (A) | @xyflow/svelte (B) ★ |
|---|---|---|
| 디자인 부담 | 높음 (직접 렌더) | **낮음 (기본 chrome 제공)** |
| 의존성 | 없음 | 라이브러리 1개 |
| 읽기전용 요구 적합성 | 과함 | **딱 맞음** |
| lodestar가 피한 리스크 | — | 읽기전용이라 **해당 없음** |

**구현 방향**: 커스텀 노드(Bronze/Silver/Gold 3레이어에 DAG 6개)에 status 색상(DESIGN.md 토큰)만 입히고, 레이아웃·엣지·컨트롤은 라이브러리에 위임. `SourceLaneGraph.svelte`/`StatusPill`/`ProgressTrack`은 노드 내부 표현·부가 패널에 그대로 조합.

> **단서**: 향후 노드 드래그 편집 등 복잡한 인터랙션까지 확장하면 그 시점에 안정성 재검증 필요. 순수 모니터링에 머물면 걱정 없음.

---

## 2. 재사용 자산 인벤토리

### 바로 재사용 (복사 + 약간 손봄)

**프론트 컴포넌트** (`frontend/src/lib/`)
| 파일 | 용도 | 재사용 포인트 |
|------|------|--------------|
| `StatusPill.svelte` | 상태 배지 (ok/pending/blocked/threat/missing) | 단계 상태 배지로 그대로 |
| `StatusDot.svelte` | 상태 점 인디케이터 | 단계 상태 점 |
| `ProgressTrack.svelte` | 진행 스테퍼(요청→처리→검증→done) | Bronze→Silver→Gold 진행 표시(ES는 MVP 이후) |
| `Confidence.svelte` | 신뢰도 막대 | 리스크/신뢰도 표시(선택) |
| `SourceLaneGraph.svelte` | 레인 기반 DAG 시각화(305줄) | **3레인(Bronze/Silver/Gold) 레이아웃 템플릿으로 최우선 후보** |

**상태 컬러 토큰** (`statusStroke.ts` + `DESIGN.md`)
```
ok       #3F9D6B (green)  처리 완료
pending  #C8922E (amber)  진행/대기
blocked  #C0483B (red)    막힘/에러
threat   #C0483B (red)    위협(점선)
missing  #B8B4B8 (gray)   데이터 없음(점선)
```

**상태/통신**
- `loadstar-store.svelte.ts` — Svelte 5 `$state` 단일 스토어 패턴 (외부 라이브러리 無)
- `api.ts` — REST polling + **SSE 구독 패턴**(`subscribeBridgeStatus`, 세션 토큰 라우팅). 실시간 단계 카운트 갱신에 재사용
  - 백엔드에 SSE 엔드포인트(`/api/bridge/events?token=…`) 인프라는 있으나 프론트에서 아직 미활용 → 에뮬레이터에서 활성화 권장

**인프라**
- `DESIGN.md` — 컬러/타이포/스페이싱/라운드 토큰 시스템. status 컬러(신호등 시맨틱)는 그대로 이식
- `docker-compose.yml` — postgres+backend(FastAPI)+frontend 3서비스 골격 + healthcheck/depends_on 순서. **에뮬레이터는 이 골격을 ui-backend(FastAPI) + postgres(모니터링 앱 상태 = 서비스 DB)로 그대로 채택**하고, 파이프라인 데이터용 **MySQL을 별도 서비스로** 둔다(서비스 DB ↔ 파이프라인 DB 분리). *(pgvector는 ES 임베딩이 MVP 이후이므로 MVP 서비스 DB엔 불필요)*
- `db/init.sql` — 노드/엣지 + 상태머신 스키마 패턴 (에뮬레이터는 postgres 서비스 DB에 `pipeline_stage`/`pipeline_run`/`stage_execution`로 변형 적용)

### 패턴 참고용 (인스피레이션)

- `FlowCanvas.svelte`(43KB) + `canvas-helpers.ts` — 자체 SVG 캔버스의 밴드(레인 자동 분할) 계산 로직(`computeBands()`, `crossedBoundaries()`). 4단계 수평 레이아웃으로 차용 가능하나 편집기능 제거 필요
- `backend/app/api/blockers.py` — FastAPI 라우터 구성 패턴(`/stages`, `/runs`, `/executions`로 재현)
- `bridge/bridge.py` — WebSocket + SSE 워커 패턴. LLM 기반 이상탐지/원인분석이 필요할 때만 참고(모니터링 기본엔 불필요)

### 재사용 안 함

- `blockade-navigator/` — React/TanStack Start 별도 프로토타입(Lovable 생성, 기술스택 다름, 아카이브). **무시**
- LLM 어댑터 / audit / active-loop 로직 — 모니터링과 직교
- pgvector 임베딩 검색 — 에뮬레이터 ES 서빙과 무관

---

## 결론

- **svelte flow는 lodestar에 없다** — 자체 SVG 캔버스이며, 그 선택 이유는 "Svelte5+xyflow 안정성 미확인 + **editable(드래그·CRUD) 도메인 제약**" 이었다.
- **에뮬레이터 그래프는 @xyflow/svelte 신규 도입 권장** — lodestar의 미채택 이유(editable 리스크)가 읽기전용에선 해당 없고, Svelte Flow 1.0 정식 릴리스로 runes 안정성도 해소. 디자인 부담(기본 chrome 제공)까지 xyflow가 유리.
- 나머지는 **`StatusPill` + `ProgressTrack` + `DESIGN.md` 토큰 + `docker-compose.yml` 골격** 재사용으로 3레이어(Bronze/Silver/Gold) 파이프라인 모니터의 상당 부분을 커버한다. (`SourceLaneGraph.svelte`는 xyflow 노드 내부/부가 패널 표현에 조합)
- 실시간 갱신은 `api.ts`의 **SSE 패턴 재사용**을 권장.

### 파일 경로 빠른 참조
```
frontend/src/lib/StatusPill.svelte         상태 배지
frontend/src/lib/StatusDot.svelte          상태 점
frontend/src/lib/ProgressTrack.svelte      진행 스테퍼
frontend/src/lib/Confidence.svelte         신뢰도 막대
frontend/src/lib/SourceLaneGraph.svelte    레인 그래프 템플릿 ★
frontend/src/lib/loadstar-store.svelte.ts  상태 패턴
frontend/src/lib/api.ts                    REST + SSE 패턴
frontend/src/lib/FlowCanvas.svelte         캔버스(레이아웃 로직 참고)
frontend/src/lib/canvas-helpers.ts         밴드/경계 알고리즘
backend/app/api/blockers.py                FastAPI 라우터 패턴
DESIGN.md                                  디자인 토큰
docker-compose.yml                         오케스트레이션 골격
db/init.sql                                스키마 템플릿
GraphCanvas.README.md                      xyflow 미채택 근거 문서
```
