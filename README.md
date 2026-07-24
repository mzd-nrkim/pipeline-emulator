# pipeline-emulator

현대차 LLM 플랫폼의 **Bronze → Silver → Gold 데이터 파이프라인**을 노트북 한 대(Docker Compose)에서 재현하고, 그 흐름을 커스텀 대시보드 **PipeScale**로 실시간 모니터링하는 **데모용 에뮬레이터**.

![PipeScale 캔버스 뷰 — Bronze→Silver→Gold 파이프라인과 Airflow 오케스트레이션](./docs/pipeline-canvas.png)

## 빠른 시작

```bash
# 원클릭 기동 (헬스체크까지 대기) — 발표·시연이면 이걸 쓴다
./scripts/demo/start-demo.sh

# 상태 진단 / 폴백(녹화 영상)
./scripts/demo/check-demo.sh
./scripts/demo/fallback-demo.sh
```

수동으로 띄우려면:

```bash
# 1. 백엔드 스택 기동 (기본 6개 서비스)
docker compose up -d

# 2. 프론트엔드 대시보드 기동
cd frontend && npm install && npm run dev
# → http://localhost:5173  (캔버스 뷰: /sample/pipeline)
```

- Airflow UI: http://localhost:8080 · 환경변수 템플릿: `.env.example`

## 구성

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | SvelteKit 2 + Svelte 5 + TailwindCSS 4 + @xyflow/svelte (제품명 **PipeScale**) |
| UI 백엔드 | FastAPI + PyMySQL — Airflow REST · MySQL 집계 |
| 파이프라인 | Apache Airflow (DAG 7종: bronze_0 → silver_1·2 → gold_3·4·5·6) |
| 스토리지 | SeaweedFS(S3 호환) · MySQL 8.0 · Elasticsearch |
| 선택 프로필 | CeleryExecutor(`celery`) · CDC(`cdc`, Debezium) · NiFi(`nifi`) |

## 문서

| 목적 | 문서 |
|------|------|
| **프로젝트 개요** (5분 소개) | [docs/OVERVIEW.md](./docs/OVERVIEW.md) |
| **🚨 발표 당일 기동·장애 대처** | [docs/데모_기동_가이드.md](./docs/데모_기동_가이드.md) |
| 시연 순서·대사·체크리스트 | [docs/demo-scenario.md](./docs/demo-scenario.md) |
| 설계 결정·원본→에뮬레이터 대체·로드맵 | [docs/pipeline-emulator-decisions.md](./docs/pipeline-emulator-decisions.md) |
| 개발 규칙·테스트·포트 맵 | [CLAUDE.md](./CLAUDE.md) |

> 상세 개요는 [docs/OVERVIEW.md](./docs/OVERVIEW.md)가 단일 진실 소스(SSoT)다. 이 README는 간판 역할만 한다.
