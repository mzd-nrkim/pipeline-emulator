# F6. CeleryExecutor 분산 전환 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 구현완료-게이트대기 / 우선순위: ★
> 방향전환 판단(2026-07-15): **보류/재평가**. Airflow 실행엔진 계층 종속. 백엔드 엔진이 유지되면 유효하나, 도구 제어면 데모에서의 가치는 낮음 → 우선순위 하향·재산정 대상.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `PROFILE=local|celery` (기본 `local`)

---

## 목표

원본 운영계 구성(CeleryExecutor + Valkey)을 로컬에서 시연한다. DAG 코드 불변, 인프라만 추가.

## 전환 트리거

"실제 분산 워커 동작"이 데모 요구사항이 될 때.

## 작업

- [x] valkey 컨테이너 추가(브로커)
- [x] result backend는 기존 MySQL 재사용 (원본과 동일)
- [x] `airflow celery worker` 컨테이너 분리 (scheduler 직접 실행 → 워커 분리)
- [x] `AIRFLOW__CORE__EXECUTOR=CeleryExecutor` + `CELERY__BROKER_URL` + `CELERY__RESULT_BACKEND` (`PROFILE=celery`)

## 검증 기준

- [ ] 분산 워커가 태스크를 실행 (scheduler가 아닌 celery worker에서 처리 확인)
- [ ] DAG 코드 변경 0으로 동일 결과 산출 (TaskFlow API)
- [ ] `PROFILE=local`로 즉시 복귀 가능

## 재사용 자산

- 원본 운영계 구성 (CeleryExecutor + Valkey 6노드 → 로컬 단순화)
- MVP TaskFlow DAG (코드 수정 불필요)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| 컨테이너·환경변수 추가 부담 | 되돌리기 쉬운 변경(compose 서비스 2개 + 환경변수 3개). MVP에서 미리 감당 안 함 |
| result backend 설정 | 기존 MySQL 재사용 → 원본과 동일, 별도 backend 불필요 |

## 비고

되돌리기 쉬운 변경이라 우선순위 최하위 축 중 하나. DAG가 TaskFlow라 executor 전환에 코드 수정이 없다는 점이 본 기능의 저비용을 보장한다.

---

## 실행 시 필수 고려사항

> 실물 코드 탐색(`docker-compose.yml`, `.env.example`, `DockerfileAirflow`, `CLAUDE.md`, `docs/pipeline-emulator-decisions.md`) 결과, 계획 착수 전 반드시 반영해야 할 사항. 아래는 **실물과 계획서의 차이·전제**를 정리한 것으로, 착수 시점에 재확인("실물 확인 후 결정")한다.

1. **인프라-only·완전 가역 변경** — 본 기능은 DAG 코드(`dags/`)를 전혀 건드리지 않는다(TaskFlow API라 executor는 런타임 설정). 변경 대상은 `docker-compose.yml`(서비스 추가/프로파일 태깅)과 `.env.example`(env 문서화)뿐이며, `COMPOSE_PROFILES` 미지정 기동 시 기존 동작이 100% 불변이어야 한다. 되돌리기는 프로파일 미지정 기동 = 즉시 복귀.

2. **현재 executor는 계획서 전제와 다름 — 반드시 확인** — `docker-compose.yml`의 `airflow` 서비스는 `AIRFLOW__CORE__EXECUTOR: SequentialExecutor` + `airflow standalone` + **SQLite 메타DB**(`sqlite:////opt/airflow/airflow.db`)로 실행된다. `CLAUDE.md`도 "Apache Airflow (SequentialExecutor, sqlite)"로 기술. 반면 `.env.example`은 `AIRFLOW__CORE__EXECUTOR=LocalExecutor`로 되어 있어 실물과 불일치(env 파일은 compose에서 참조되지 않음 — compose가 값을 하드코딩). 계획서의 "scheduler가 직접 실행(LocalExecutor)" 전제는 **현재 SequentialExecutor/standalone**을 의미하는 것으로 해석. 착수 시 실제 baseline을 재확인한다. (실물 확인 후 결정)

3. **CeleryExecutor는 SQLite 메타DB와 양립 불가 → 메타DB도 함께 전환 필요** — CeleryExecutor는 scheduler·worker가 **공유 메타DB**를 통해 상태를 주고받으므로 SQLite(파일 로컬)로는 동작하지 않는다. 따라서 `PROFILE=celery`에서는 `AIRFLOW__DATABASE__SQL_ALCHEMY_CONN`을 기존 MySQL(서비스 `mysql`, DB `pipeline_emulator`, 계정 `emulator`)로 전환해야 한다. 이는 계획서 "result backend는 기존 MySQL 재사용"과 방향이 같으나, **메타DB 전환**은 별도 항목으로 명시되지 않았던 부분이라 작업 목록에 추가한다. 별도 DB/스키마 준비가 필요한지(신규 DB `airflow` 분리 vs 기존 DB 공유), pymysql 드라이버 URL 형식은 착수 시 확정. (실물 확인 후 결정)

4. **DB 스키마 마이그레이션 불필요(앱 관점)** — Airflow의 celery 관련 메타 테이블(`celery_taskmeta`, `celery_tasksetmeta` 등 result backend 테이블 포함)은 Airflow가 `_AIRFLOW_DB_MIGRATE: "true"` 기동 시 자동 생성/관리한다. 본 프로젝트의 애플리케이션 스키마(`db/init.sql`의 bronze/silver 테이블 등)에는 변경이 없다. → **마이그레이션 체크박스 없음**. 착수 시 `airflow db migrate`가 MySQL 대상으로 정상 수행되는지만 확인.

5. **브로커: 기존 `valkey` 서비스 재사용 여부 결정** — `docker-compose.yml`에 이미 `valkey`(image `valkey/valkey:8`, port 6379) 서비스가 존재하나 `profiles: [cdc]`로 CDC/Debezium 전용이다. F6 브로커로 (a) 동일 `valkey` 서비스에 `celery` 프로파일을 함께 태깅해 재사용할지, (b) DB 인덱스만 분리(`redis://valkey:6379/1`)할지, (c) 별도 broker 서비스(`valkey-broker`)를 둘지 결정 필요. 데모 단순성상 (a)+(b)(같은 컨테이너, 다른 DB 인덱스) 유력. (실물 확인 후 결정)

6. **우선순위 최하위 근거** — 2026-07-15 재평가 노트대로, 도구 제어면(프론트/UI) 데모에서 "분산 워커 실행"의 시각적·설명적 가치가 낮다. TaskFlow라 저비용·가역이지만 트리거("실제 분산 워커 동작 요구") 전까지 착수 이득이 적다. 착수는 트리거 게이팅 유지.

7. **환경 전제 — 추가 컨테이너 리소스** — celery 전환은 broker(valkey) + worker(airflow celery worker) 컨테이너가 추가로 상시 기동된다. 로컬 Docker에 메모리/CPU 여유가 필요(기존 seaweedfs/mysql/airflow/mock-api/ui-backend + 옵션 cdc/nifi 스택과 공존). e2e(Z-post) 실행 전 Docker Desktop 리소스 확인.

8. **워커 vs 스케줄러 실행 증명 방법(핵심 검증 설계)** — "태스크가 워커에서 돌았다"를 증명하는 방법은:
   - (권장) Airflow Task Instance의 `hostname`/`Executor` 필드가 worker 컨테이너 hostname을 가리키는지 확인 — REST API(`/api/v1/dags/{dag}/dagRuns/{run}/taskInstances`)의 `hostname`, 또는 UI Task Instance Details.
   - worker 컨테이너 로그에 해당 task_id 실행 라인이 찍히고, scheduler(airflow) 컨테이너 로그에는 실행(execute)이 아닌 dispatch/queue만 찍히는지 대조.
   - CeleryExecutor 확인: `airflow config get-value core executor` == `CeleryExecutor`.
   Z-post에서 위 3중 확인을 명령으로 고정한다. (실물 확인 후 결정 — hostname 필드 표기 형식)

9. **거부된 옵션**
   - RabbitMQ 브로커 도입: 원본은 Valkey/Redis 계열이고 이미 `valkey` 이미지 보유 → 신규 의존 불필요, 거부.
   - Postgres 메타DB로 전환: 프로젝트 표준 RDB가 MySQL(`mysql:8.0`)이라 정합성 위해 MySQL 유지, Postgres 거부.
   - `.env.example`의 `LocalExecutor` 값을 신뢰: compose가 executor를 하드코딩하므로 env 파일 값은 미반영 → 신뢰하지 않고 compose를 정본으로 사용.

---

## 작업 목록

> 2레벨 원자 체크리스트. 앵커 3필드: (path, 앵커, 의도). 미존재 대상은 "(신규)". "실물 확인 후 결정" = 착수 시 baseline 재확인 필요.

### A. 브로커(Valkey) — celery broker 준비

- [x] valkey 컨테이너 추가(브로커)
  - [x] 기존 `valkey` 서비스에 `celery` 프로파일 병기 or 브로커용 DB 인덱스 분리 방식 결정 — `profiles: [cdc, celery]` + broker DB `/1` 분리 적용 (path: docker-compose.yml)
  - [x] `celery` 프로파일 기동 시 valkey healthcheck 대기 의존성 확보 — `airflow-worker.depends_on.valkey.condition: service_healthy` (path: docker-compose.yml)

### B. 메타DB 전환 (SequentialExecutor+SQLite → CeleryExecutor+MySQL)

> CeleryExecutor는 공유 메타DB 필수. SQLite 불가 → 기존 MySQL로 전환. (필수 고려사항 3 참조)

- [x] result backend는 기존 MySQL 재사용 (원본과 동일)
  - [x] `PROFILE=celery` 시 `AIRFLOW__DATABASE__SQL_ALCHEMY_CONN`을 MySQL로 지정 — `${AIRFLOW_SQL_CONN:-sqlite:...}` 치환 방식(airflow), worker는 MySQL 기본값 하드코딩 (path: docker-compose.yml)
  - [x] `CELERY__RESULT_BACKEND`를 동일 MySQL로 지정 — `${CELERY_RESULT_BACKEND:-db+mysql+pymysql://...}` (path: docker-compose.yml)
  - [x] MySQL 메타DB 대상 `airflow db migrate` 자동 수행 확인 — `_AIRFLOW_DB_MIGRATE: "true"` 기존 유지 (path: docker-compose.yml)
  - [x] pymysql 드라이버 존재 확인 — `_PIP_ADDITIONAL_REQUIREMENTS`에 이미 `pymysql` 포함 (path: DockerfileAirflow)

### C. Celery Worker 컨테이너 분리

- [x] `airflow celery worker` 컨테이너 분리 (scheduler 직접 실행 → 워커 분리)
  - [x] `airflow-worker` 서비스 신규 정의 — `command: airflow celery worker`, DockerfileAirflow 재사용 (path: docker-compose.yml)
  - [x] worker 서비스에 `profiles: [celery]` 지정 (path: docker-compose.yml)
  - [x] worker에 executor·broker·backend·메타DB env 공유 — CeleryExecutor 하드코딩, MySQL URL 기본값 (path: docker-compose.yml)
  - [x] worker에 dags/pii_engine 볼륨 마운트 공유 — `./dags`, `./pii_engine`, `airflow-logs` (path: docker-compose.yml)
  - [x] worker `depends_on` (mysql healthy + valkey healthy) 지정 (path: docker-compose.yml)

### D. Executor 토글 (PROFILE=celery)

- [x] `AIRFLOW__CORE__EXECUTOR=CeleryExecutor` + `CELERY__BROKER_URL` + `CELERY__RESULT_BACKEND` (`PROFILE=celery`)
  - [x] `airflow` 서비스 executor를 celery 모드에서 오버라이드 — `${AIRFLOW_EXECUTOR:-SequentialExecutor}` env 치환 방식 (path: docker-compose.yml)
  - [x] `CELERY__BROKER_URL` env 추가 — `${CELERY_BROKER_URL:-}` (airflow), `redis://valkey:6379/1` 기본값 (worker) (path: docker-compose.yml)
  - [x] `.env.example`에 celery 토글 문서화 — Celery 섹션 추가, `AIRFLOW__CORE__EXECUTOR=LocalExecutor` 오류 주석 처리 (path: .env.example)
  - [x] `CLAUDE.md` 토글/포트/서비스 목록 갱신 — 기술 스택·환경변수·테스트 명령 갱신 (path: CLAUDE.md)

### E. 문서 상태 갱신

- [x] 착수 시 상태 블록쿼트 갱신 — `대기` → `구현완료-게이트대기` (path: docs/plan/pipeline-emulator-feat-f6-celery-executor.md)
  - [x] 로드맵 인덱스 상태 동기화 (path: docs/plan/pipeline-emulator-post-mvp-roadmap.md)

---

## TC

> Right-BICEP & CORRECT 기준. 컨테이너 생성 TC는 teardown(`docker compose ... down -v`) 포함. e2e는 Z-post로 이관. 토글 실체는 `COMPOSE_PROFILES=celery`(계획서 `PROFILE=celery`와 동의).

### Right-BICEP

- **Right (정상 동작 — 워커 실행)**: `COMPOSE_PROFILES=celery docker compose up -d` 후 DAG 1건 트리거 → 태스크가 **`airflow-worker`에서 실행**됨. 증명: (1) Task Instance `hostname`이 worker 컨테이너 hostname, (2) worker 로그에 task execute 라인 존재, (3) `airflow config get-value core executor` == `CeleryExecutor`. → **Z-post e2e**. teardown: `COMPOSE_PROFILES=celery docker compose down -v`.

- **B (Boundary/경계)**: 브로커 URL DB 인덱스 분리 시 CDC용 valkey DB(0)와 celery DB(1)가 키 충돌 없이 공존. 워커 0대→1대 경계에서 태스크가 큐잉만 되고 실행 안 되다가 워커 기동 시 소비되는지(대기 큐 경계). → Z-post 보조 확인.

- **I (Inverse/역 — 즉시 복귀)**: `COMPOSE_PROFILES` 미지정 `docker compose up -d` → `airflow-worker`/celery broker 미기동, `AIRFLOW__CORE__EXECUTOR`가 기존값(SequentialExecutor) 유지, 동일 DAG가 기존 baseline대로 실행. `PROFILE=local` 즉시 복귀 검증. → **Z-post e2e** (핵심 가역성). teardown 포함.

- **C (Cross-check/교차검증)**: 동일 TaskFlow DAG를 local과 celery 두 프로파일에서 실행 → **산출 결과(silver/bronze 행 수, S3 오브젝트) 동일**. DAG 코드 diff == 0임을 `git diff dags/` 로 확인(코드 무변경 전제 교차검증). → Z-post e2e.

- **E (Error/에러 조건)**: (1) broker down — valkey 미기동/중단 상태에서 celery 프로파일 기동 → 워커가 브로커 접속 실패 로그, 태스크 dispatch 실패(스케줄러 큐 적체). (2) worker unreachable — worker 미기동인데 executor=CeleryExecutor → 태스크가 `queued`에 머물고 실행 안 됨(무한 대기 감지). 두 케이스 모두 명확한 에러/대기 상태로 관측되는지. → Z-post 보조. teardown 포함.

- **P (Performance/성능)**: **해당 없음** — 데모 목적 단일 워커 구성, 처리량·지연 SLA 없음(우선순위 최하위, 성능 요구 부재).

### CORRECT

- **C (Conformance/형식)**: broker/result-backend URL 스킴 적합성 — `CELERY__BROKER_URL`=`redis://...`, `CELERY__RESULT_BACKEND`=`db+mysql+pymysql://...` 형식 정합. `docker compose config`가 env 렌더링 성공. → **Z-pre static**.

- **O (Ordering/순서 — 핵심)**: **워커·브로커·메타DB가 태스크 dispatch보다 먼저 up**. `airflow-worker.depends_on`에 `mysql`(healthy)+`valkey`(healthy), scheduler도 동일. 브로커 준비 전 워커 기동 금지, 메타DB 준비 전 `db migrate` 금지. → Z-pre(depends_on 정적 확인) + Z-post(기동 순서 관측).

- **R (Range/범위)**: **해당 없음** — 수치 입력 범위 개념 없음(인프라 토글). broker DB 인덱스(0/1)는 Reference로 커버.

- **R (Reference/외부참조 — 핵심)**: broker(`valkey:6379`)·result-backend(`mysql:3306/pipeline_emulator`)·메타DB URL이 실제 서비스명/포트/계정과 일치(`docker-compose.yml`의 `mysql`·`valkey` 서비스, `emulator/emulator_pass`). 오타·잘못된 호스트 시 접속 실패. → Z-pre(값 존재/형식) + Z-post(실접속).

- **E (Existence/존재 — 핵심)**: celery 프로파일 기동 시 `valkey`(broker)·`airflow-worker` 컨테이너가 실제 `Up`/healthy. `docker compose ps`로 두 컨테이너 존재 확인. 미지정 기동 시엔 부재(존재하지 않아야 함). → Z-post. teardown 포함.

- **C (Cardinality/개수)**: 워커 1대(데모 단순화, 원본 6노드 축소). scheduler에서 태스크가 중복 실행되지 않음(worker에서만 1회). Task Instance try_number 중복 없음 확인. → Z-post 보조.

- **T (Time/시간)**: 워커가 브로커 접속·태스크 소비까지 기동 지연 존재 → healthcheck/`depends_on service_healthy`로 흡수. 태스크가 `queued`에서 `running`으로 전이하는 타임아웃 관측(무한 대기 아님). → Z-post 보조.

---

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

> 실물 서비스명: `docker-compose.yml` 단일 파일, 서비스 `airflow`(scheduler/webserver, standalone)·신규 `airflow-worker`·`valkey`·`mysql`. 토글 = `COMPOSE_PROFILES=celery`(계획서 `PROFILE=celery`).

#### Z-pre (worktree: static — 앱 기동 없음)

DB 마이그레이션 없음(앱 스키마 무변경, Airflow 메타는 런타임 자동). 정적 검증만 수행.

- [x] compose 문법·렌더 검증(기본 프로파일): `docker compose config` — 성공 & `airflow-worker` 부재, `valkey` 미포함 확인
- [x] compose 문법·렌더 검증(celery 프로파일): `COMPOSE_PROFILES=celery docker compose config` — `airflow-worker` + `valkey` 서비스 등장 확인
- [x] env 존재/형식 검증: celery 프로파일에서 `AIRFLOW__CORE__EXECUTOR: CeleryExecutor`, `CELERY__BROKER_URL: redis://valkey:6379/1`, `CELERY__RESULT_BACKEND: db+mysql+pymysql://...`, `SQL_ALCHEMY_CONN: mysql+pymysql://...` 확인 (worker 서비스 기준)
- [x] 기본(프로파일 미지정) executor 불변: `docker compose config | grep AIRFLOW__CORE__EXECUTOR` == `SequentialExecutor`
- [x] DAG 코드 무변경: `git diff --stat dags/` 빈 결과
- [x] depends_on 순서 정적 확인: `airflow-worker`에 `mysql`(service_healthy)+`valkey`(service_healthy) 존재

#### Z-post (app-up: e2e — celery 프로파일 실기동)

> 추가 컨테이너 기동. 완료 후 반드시 teardown. 실행 전 Docker 리소스 여유 확인.

- [ ] 기동: `AIRFLOW_EXECUTOR=CeleryExecutor AIRFLOW_SQL_CONN=mysql+pymysql://emulator:emulator_pass@mysql:3306/pipeline_emulator CELERY_BROKER_URL=redis://valkey:6379/1 CELERY_RESULT_BACKEND=db+mysql+pymysql://emulator:emulator_pass@mysql:3306/pipeline_emulator COMPOSE_PROFILES=celery docker compose up -d`
- [ ] 존재/기동 확인(Existence): `docker compose ps` — `valkey`·`airflow-worker` 컨테이너 `Up`, `airflow` healthy
- [ ] executor 확인(Right): `docker compose exec airflow airflow config get-value core executor` == `CeleryExecutor`
- [ ] 메타DB 확인: `docker compose exec airflow airflow config get-value database sql_alchemy_conn` == MySQL URL
- [ ] DAG 트리거: `docker compose exec airflow airflow dags trigger <mvp_dag_id>`
- [ ] **워커 실행 증명(Right — 3중)**: worker 로그 task execute 확인 + Task Instance hostname + scheduler 로그 dispatch-only 대조
- [ ] 결과 교차검증(Cross-check): DAG 성공 & silver/bronze 행 수·S3 오브젝트 일치
- [ ] **가역성 검증(Inverse — 핵심)**: celery down → `docker compose up -d` → `airflow-worker` 부재, executor==`SequentialExecutor`
- [ ] **teardown(필수)**: `COMPOSE_PROFILES=celery docker compose down -v`
