# pipeline-emulator — 프로젝트 규칙

## 프로젝트 개요

Bronze → Silver → Gold 멀티스테이지 데이터 파이프라인 에뮬레이터.
SvelteKit 프론트엔드 + FastAPI UI 백엔드 + Airflow DAG + MySQL + SeaweedFS + CDC(Debezium/NiFi/polling) 풀스택.

## 계획서 위치

이 프로젝트의 계획서는 **`docs/plan/`** 에 저장한다 (`plans/` 아님).

| 유형 | 저장 위치 |
|------|-----------|
| 활성 계획서 | `docs/plan/` |
| 완료 계획서 | `docs/plan/done/` |
| 아이디어 단계 | `docs/plan/idea/` |

- 파일명 규칙: `pipeline-emulator-<기능>.md` 또는 `YYYY-MM-DD.<종류>_<설명>.md`
- `/plan` 스킬이 `plans/`로 라우팅하는 경우 `docs/plan/`으로 수정해 저장한다.
- 기록·통찰·아이디어·조사결과·메모는 `docs/` 하위 적절한 위치에 저장한다.

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | SvelteKit 2 + Svelte 5 + TypeScript + TailwindCSS 4 + @xyflow/svelte |
| UI 백엔드 | FastAPI 0.110 + Uvicorn + Pydantic 2 + PyMySQL |
| 파이프라인 | Apache Airflow (SequentialExecutor, sqlite) |
| Mock API | FastAPI (청킹·보강 엔드포인트 시뮬레이션) |
| DB | MySQL 8.0 (`pipeline_emulator` 스키마) |
| 스토리지 | SeaweedFS (S3 호환, 포트 8333) |
| CDC | Debezium (기본) / NiFi / polling-trigger 선택 가능 |
| 스트림 | Valkey (Redis 호환, 포트 6379) |
| PII | pii_engine (layer1: regex, layer2: Presidio 예정) |

## 테스트 명령

### 격리 단위테스트 (pre-gate, env 비의존)

```bash
# 프론트엔드 단위 (Vitest, 빌드·DB 불필요)
cd frontend && npm run test:unit

# 타입 체크
cd frontend && npm run check

# Python 단위 (ui-backend, DB 불필요한 것만)
cd ui-backend && python -m pytest tests/ -k "not integration"

# Python 스크립트 단위
cd scripts && python -m pytest tests/
```

### 통합·E2E 테스트 (post-gate, Docker 필요)

```bash
# 스택 기동 (CDC 없이)
docker compose up -d

# E2E (Playwright, 스택 기동 전제)
cd frontend && npm run test:e2e

# Docker 스모크
cd frontend && npx playwright test e2e/real-docker-smoke.spec.ts

# CDC 포함 기동
COMPOSE_PROFILES=cdc docker compose up -d
```

### 정적 검증 (pre-gate)

```bash
# Python 문법 검사
python -m py_compile ui-backend/app/**/*.py mock_api/**/*.py pii_engine/*.py dags/*.py

# 프론트엔드 타입 체크
cd frontend && npm run check
```

## DB 마이그레이션

마이그레이션 파일 위치: `db/migrations/` (순번 접두사: `001_`, `002_`, …)

DDL 변경 시:
- **pre-gate**: SQL 문법 검사 (`mysql --dry-run` 또는 sqlfluff 등)
- **post-gate**: 실행 중인 MySQL 컨테이너에 `docker compose exec mysql mysql …` 로 live 적용 후 컬럼·인덱스 read-back

## 워크트리 규칙

워크트리 디렉터리: `wt/<branch-name>/` (repo 루트 안)

```bash
# 생성
git worktree add wt/<branch> -b <branch>

# 제거 (브랜치 머지 후)
git worktree remove wt/<branch>
git branch -d <branch>
```

`.gitignore`에 `wt/` 미등록 → `git status`에 노출될 수 있음 — 의도된 구조.

## 환경변수

런타임 환경변수: `.env` (gitignored). 템플릿: `.env.example`

주요 변수:
- `CDC=off|on` + `COMPOSE_PROFILES=cdc` — CDC 서비스 활성화
- `PUBLIC_UI_BACKEND_URL` — 프론트엔드가 바라보는 백엔드 URL
- `MASK=regex` — PII 엔진 모드

E2E 테스트는 `--mode test` 플래그로 `.env.test`를 로드해 real-mode 헬스체크를 비활성화한다.

## 포트 맵

| 서비스 | 포트 |
|--------|------|
| Frontend dev | 5177 (test) / 5173 (dev) |
| UI Backend | 8001 |
| Airflow | 8080 |
| Mock API | 8000 |
| MySQL | 3306 |
| SeaweedFS S3 | 8333 |
| Valkey | 6379 |

## 파이프라인 스테이지

| 스테이지 | DAG 파일 | 역할 |
|----------|----------|------|
| Bronze 0 | `dags/bronze_0_registration.py` | 문서 등록·수집 |
| Silver 1 | `dags/silver_1_structuring.py` | 구조화 |
| Silver 2 | `dags/silver_2_masking.py` | PII 마스킹 |
| Gold 3 | `dags/gold_3_chunking.py` | 청킹 |
| Gold 4 | `dags/gold_4_enrichment.py` | 보강(Enrich) |
| Gold 5 | `dags/gold_5_field_mapping.py` | 필드 매핑 |

## Git

- Remote: `origin` → `https://github.com/mzd-nrkim/pipeline-emulator.git`
- 기본 브랜치: `main`
- 작업 브랜치 머지 후 삭제 (상위 CLAUDE.md 규칙 동일 적용)
