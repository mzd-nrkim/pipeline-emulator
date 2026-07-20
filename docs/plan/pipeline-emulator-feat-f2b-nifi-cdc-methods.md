# F2b. NiFi 프로세서 CDC (Polling·Trigger) — 기능 계획서

> 상태: 머지완료-통테대기
> 작성일: 2026-07-15 / 우선순위: ★★
> 관계: [F2 Debezium CDC](./pipeline-emulator-feat-f2-realtime-cdc.md)의 **대안 CDC 방식 옵션**. Debezium(binlog 실시간)과 병렬로, NiFi 프로세서 기반 CDC(Polling/Trigger)를 **선택 가능**하게 한다.
> 토글: `CDC_METHOD=debezium|polling|trigger` (기본 `debezium`, `CDC=on`일 때만 유효)
> 참조 자산(외부 로컬 학습 문서): `2026-01-21_hyundai/docs/study/test_pipeline_1/docs/06_news_cdc_pipeline_plan.md` — NiFi 2.7.2 + **PostgreSQL** 기반 CDC 3방식(Polling/Trigger/WAL). 본 계획은 이를 **MySQL로 이식**한다(PG 전용 요소 그대로 못 씀).
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)

---

## 0. 배경 — 왜 이 옵션이 필요한가

- 현업에서 **NiFi Polling/Trigger CDC를 실제로 사용**하고 있어, 데모에서도 이 방식을 재현·비교할 수 있어야 한다.
- Debezium(F2)은 binlog 실시간 방식. Polling/Trigger는 **NiFi 프로세서만으로** CDC를 구현 — 도구 통합(NiFi=수집+CDC)·낮은 인프라 부담·설명 용이성이 이점.
- 세 방식이 **같은 `change_operation` 계약** 위에서 교체 가능해야 한다 → "CDC 방식 비교 시연"이 목표.

## 1. 공통 전제 — CDC 대상 원천 테이블 (F2와 공유)

> **중요(2026-07-15 코드 확인)**: 현재 MySQL 스키마(`db/init.sql`)는 전부 medallion(bronze/silver/gold) 테이블이고 **진짜 "원천 운영 RDB 테이블"이 없다**. `bronze_rdb_events`는 이벤트 로그다. CDC는 "원천의 변경"을 잡는 것이므로, **변경이 발생하는 시뮬레이션 원천 테이블**이 선행 전제다. 이는 Debezium(F2)·NiFi(F2b) **공통**이다.

- **✅ 확정(2026-07-20, F2 완료)**: 원천 테이블 `source_cft_problem_history`는 F2가 **이미 정의해 main에 존재**(`db/init.sql`). PK `(pilot_problem_no, reform_numseq)`. → **재사용**(중복 정의 금지).
- **Polling 이득**: F2의 이 테이블은 `upd_dts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`를 **이미 보유** → Polling maximum-value 컬럼으로 **그대로 재사용, 신규 컬럼 마이그레이션 불요**(인덱스만 필요 시 추가).
- **변경 주입 수단도 F2가 이미 제공**: `scripts/cdc/mutate_source.py`(--op insert/update/delete) 재사용 → 본 계획 D는 신규 작성이 아니라 **재사용 확인**으로 축소.
- "소스 변경"(데모가 보여줄 이벤트) = 이 테이블에 대한 INSERT/UPDATE/DELETE.

## 2. CDC 방식 3종 비교 (MySQL 적응)

| 방식 | 감지 I/U/D | DELETE | 실시간성 | 소스 스키마 변경 | `change_operation` 매핑 |
|------|-----------|--------|----------|------------------|--------------------------|
| debezium (F2) | I/U/D | O | ms | 불필요(binlog) | op `r/c/u/d` → `snapshot/insert/update/delete` 1:1 |
| **polling (본 계획)** | I/U | ✗ | ~30s | `updated_at` 컬럼(ON UPDATE) | 최초 `row_hash`=insert, 재등장=update |
| **trigger (본 계획)** | I/U/D | O | ~30s | `change_log` 테이블 + AFTER 트리거 | `operation` → 1:1 |

> Polling은 DELETE를 구조적으로 못 잡는다(삭제된 행은 조회 불가) — 한계로 명시. DELETE 시연이 필요하면 trigger/debezium 사용.

## 3. 목표

- `CDC_METHOD=polling`·`trigger`로 전환 시, 원천 MySQL 변경이 **NiFi 프로세서 CDC**를 거쳐 Bronze `change_operation`으로 정규화·기록된다.
- Debezium(F2)과 **동일한 `bronze_rdb_events.change_operation` 계약·Silver-1 트리거 계약**을 노출 → 다운스트림(Silver-1 이하) 코드 변경 0.
- 세 방식이 같은 계약 위에서 토글 교체 가능(방식 비교 시연).

## 4. 접근 방법 / 전제

1. **NiFi 인프라는 F3(NiFi 수집기)와 공유**: F3가 도입하는 NiFi+ZK 컨테이너를 재사용. F3 미착수 상태에서 본 계획을 먼저 실행하면 최소 NiFi를 본 계획이 가져온다(실물 확인 후 결정 — 중복 도입 금지).
2. **MySQL 적응**: 참조 문서의 PostgreSQL 요소(`CaptureChangePostgreSQL`, `pgoutput`, publication, plpgsql 트리거)를 MySQL로 치환.
   - Polling: MySQL 네이티브 `updated_at TIMESTAMP ... ON UPDATE CURRENT_TIMESTAMP`(PG와 달리 갱신 트리거 불요).
   - Trigger: MySQL `AFTER INSERT/UPDATE/DELETE` 트리거 문법으로 이식(plpgsql `TG_OP` → MySQL 트리거 3개 분리).
3. **CDC 이벤트 → Bronze 등록은 기존 `ingest.py:register_bronze_event(change_operation=...)` 재사용**(수집 방식 불문 계약). NiFi는 조회·감지까지, 정규화·등록은 Python 어댑터.

## 실행 시 필수 고려사항

- **회귀 범위**: 본 계획은 `CDC_METHOD` 토글이 polling/trigger일 때만 활성. 기본 debezium·`CDC=off`는 불변. Silver-1 이하 계약 불변(회귀로 보장).
- **환경 전제**: Z-post e2e는 NiFi+ZK+MySQL 기동 전제(워크트리 불가) → 머지 후 앱 기동 환경. 소스 스키마 변경(마이그레이션)은 **live DB 적용이 post-gate**.
- **실행 순서·동일 파일 편집**: A(토글)는 B·C의 선행. B(polling)와 C(trigger)는 **어댑터 파일이 독립**(polling_adapter/trigger_adapter)이라 병렬 가능하나, 둘 다 `db/` 마이그레이션·NiFi 플로우 디렉토리를 건드리므로 마이그레이션·compose 편집은 한 에이전트로 묶는다.
- **미선택 결정(실물 확인 후)**: ① ✅해소 — 원천 테이블은 F2가 정의(재사용). ② **NiFi 인프라 소유권**(F3 vs F2b) — 통합 계획에서 확정(아래). ③ CDC 대상 컬럼 세트.
- **참조 문서 이식 주의**: PG plpgsql·publication·slot은 MySQL에 없음 — trigger는 MySQL 문법, WAL 방식은 본 계획 범위 밖(그건 Debezium=F2가 담당).
- **register_bronze_event 재사용 패키징(F2 post-gate 교훈)**: `scripts/ingest.py`는 모듈 레벨에서 `sample_data.upload`(→ `boto3`·`pyarrow`)를 import한다. Polling/Trigger 어댑터가 `register_bronze_event`를 재사용하면 이 전이 의존이 딸려온다 → 어댑터 실행 환경/requirements에 `boto3`·`pyarrow`·`pymysql`·`requests` 포함 필요(어댑터 requirements가 `redis`만이면 부족).
- **F3 NiFi 인프라 공유(통합 선행)**: F3(NiFi 수집기)·F2b 둘 다 NiFi+ZK 도입 → **통합 계획으로 인프라 소유권을 먼저 확정**한 뒤 실행한다. 권장: **F3가 NiFi+ZK compose를 소유·도입**, F2b는 그 위에 Polling/Trigger 플로우만 얹는다(의존). F3 미착수 상태로 F2b를 먼저 돌리면 F2b가 최소 NiFi를 임시 도입하되 F3 착수 시 소유권 이관.
- **공유 docker 환경 주의(F2 교훈)**: mysql/포트가 여러 세션·로컬 네이티브 서비스와 공유될 수 있다(F2에서 host 6379 네이티브 redis 충돌 발생). post-gate는 포트 충돌·동시 mutation을 점검하고 필요 시 격리 포트로 실행.

## 작업 목록

### A. CDC 방식 선택 토글

- [x] A-1. `CDC_METHOD=debezium|polling|trigger` 토글 도입 (path: docker-compose.yml + .env.example, 앵커: CDC 섹션, 의도: 방식 선택자·기본 debezium)
  - [x] `.env.example`에 `CDC_METHOD` + 값 설명 주석 추가 (path: .env.example, 앵커: CDC 섹션 말미)
  - [x] compose profiles로 방식별 서비스 조건부 기동 — polling/trigger는 `nifi` 프로파일, debezium은 기존 `cdc` 프로파일 (path: docker-compose.yml, 앵커: profiles)

### B. Polling 방식 (MySQL)

- [x] B-1. Polling maximum-value 컬럼 = F2가 이미 만든 `source_cft_problem_history.upd_dts`(ON UPDATE) **재사용** (path: db/init.sql 확인, 앵커: source_cft_problem_history.upd_dts, 의도: 신규 컬럼 마이그레이션 불요 — 재사용 확인)
  - [x] `upd_dts` 인덱스 부재 시에만 `CREATE INDEX IF NOT EXISTS idx_source_cft_upd_dts` 멱등 추가(Polling 조회 성능)
- [x] B-2. NiFi Polling 플로우 정의 (path: nifi/flows/polling/, 앵커: QueryDatabaseTableRecord, 의도: 변경행 조회)
  - [x] QueryDatabaseTableRecord: Table=원천, Maximum-value Columns=`updated_at`, DB Type=MySQL, Record Writer=Json, 스케줄 30s
  - [x] 출력을 polling 어댑터로 전달(PutFile 또는 ExecuteStreamCommand)
- [x] B-3. Polling 어댑터: 변경행 → `change_operation` 매핑 → `register_bronze_event` (path: scripts/cdc/polling_adapter.py 신규, 앵커: op 판정 함수, 의도: 계약 정규화)
  - [x] 최초 `row_hash`=insert, 재등장=update 판정(seen-key 상태) + DELETE 미감지 명시 로그

### C. Trigger 방식 (MySQL)

- [x] C-1. `bronze_source_change_log` 테이블 + AFTER INSERT/UPDATE/DELETE 트리거 멱등 마이그레이션 (path: db/migrations/ 신규, 앵커: 원천 테이블 트리거, 의도: I/U/D 변경 로그) — 참조 §5.3~5.4 plpgsql을 MySQL 문법으로 이식
  - [x] `change_log` 테이블: `id AUTO_INCREMENT`, `operation ENUM('INSERT','UPDATE','DELETE')`, 키 컬럼, `changed_at`, `processed BOOL DEFAULT FALSE`, 인덱스 `(processed, changed_at)`
  - [x] MySQL 트리거 3종(INSERT/UPDATE/DELETE 각각) — `DROP TRIGGER IF EXISTS` 선행으로 멱등
- [x] C-2. NiFi Trigger 플로우 정의 (path: nifi/flows/trigger/, 앵커: QueryDatabaseTableRecord, 의도: 미처리 변경 소비)
  - [x] QueryDatabaseTableRecord: Table=`change_log`, WHERE `processed=FALSE`, Maximum-value=`id` → 어댑터
  - [x] 처리 후 `UPDATE change_log SET processed=TRUE WHERE id=...` PutSQL
- [x] C-3. Trigger 어댑터: `operation` → `change_operation` 1:1 정규화 → `register_bronze_event` (path: scripts/cdc/trigger_adapter.py 신규, 앵커: 매핑, 의도: 계약 정규화 + DELETE 포함)

### D. 소스 변경 주입 (데모 트리거원)

- [x] D-1. 원천 테이블 INSERT/UPDATE/DELETE 주입 = F2의 `scripts/cdc/mutate_source.py` **재사용 확인** (path: scripts/cdc/mutate_source.py, 앵커: CLI --op, 의도: 신규 작성 아님 — 존재·동작 확인, 부족 시에만 보강)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (정적)
- [x] polling/trigger 어댑터 op 매핑 단위테스트 통과 (insert/update/delete + polling의 DELETE 미감지 케이스)
- [x] 마이그레이션 SQL dry/lint — `updated_at` ALTER·`change_log`+트리거 문법 검사(멱등 재실행 안전)
- [x] `docker compose --profile nifi config` 문법 통과 + 기본(프로파일 없음) 서비스 목록 불변

#### Z-post. push 후 (앱 기동 환경)
- [ ] 마이그레이션 live 적용 + read-back(`updated_at` 컬럼·`change_log` 테이블·트리거 존재 확인)
- [ ] `CDC_METHOD=polling` 기동 → 원천 INSERT/UPDATE → 대시보드 실시간 카운트 증가 e2e 스모크
- [ ] `CDC_METHOD=trigger` 기동 → 원천 INSERT/UPDATE/**DELETE** → `change_operation` 각각 기록 e2e 스모크
  - [ ] NiFi CDC 스모크 spec 신규 작성
    - teardown: 주입한 원천 행·`change_log` 정리 + `docker compose down -v`(NiFi flowfile·상태 정리)
- [ ] `CDC_METHOD=debezium` 복귀 정상(회귀) + `CDC=off` 배치-only 정상(회귀)

## TC (Right-BICEP · CORRECT)

- [ ] **Right(polling)**: 원천 INSERT → 최초 감지 insert, 같은 행 UPDATE → update로 `change_operation` 기록.
- [ ] **Right(trigger)**: 원천 I/U/D → `change_log.operation` → `change_operation` insert/update/delete 1:1.
- [ ] **B(경계)**: Polling에서 DELETE 발생 → 감지 안 됨을 **명시적 로그/문서화**(조용한 누락 아님).
- [ ] **I(교차검증)**: 세 방식(debezium/polling/trigger)이 동일 `bronze_rdb_events` 계약·Silver-1 트리거 conf 노출 → Silver-1 이하 코드 diff 0.
- [ ] **C(에러)**: 미지원 `operation` 값·NiFi 조회 실패 → 명시적 에러(무시 아님).
- Conformance: Trigger `operation` ENUM 3종 ↔ `change_operation` 3종 전수 매핑(누락 0).
- Ordering: 동일 키 다중 변경 순서 — Trigger는 `change_log.id` 순, Polling은 순서 비보장(명시).
- Repeat(멱등): 마이그레이션·트리거 재적용 안전(`IF NOT EXISTS`/`DROP IF EXISTS`).

## 검증 기준

- [ ] `CDC_METHOD=polling` → 원천 INSERT/UPDATE가 ~30s 내 Bronze `change_operation`에 반영, DELETE는 미감지(문서화된 한계).
- [ ] `CDC_METHOD=trigger` → 원천 I/U/D 전부 Bronze에 정확한 `change_operation`으로 반영.
- [ ] 세 방식 토글 교체 시 다운스트림(Silver-1 이하) 코드 변경 0.
- [ ] NiFi 인프라를 F3와 공유(중복 컨테이너 없음).

## 재사용 자산

- 참조 학습 문서(외부 로컬): NiFi CDC 3방식 가이드 — Polling/Trigger 프로세서 설정·SQL(PostgreSQL, MySQL 이식 대상).
- 기존 `ingest.py:register_bronze_event`(change_operation 계약) — CDC 등록 재사용.
- F3 NiFi+ZK 인프라(공유).
- MVP `change_operation` 필드 계약(배치 수집이 선점).

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| PostgreSQL 참조를 MySQL로 잘못 이식(plpgsql/publication) | trigger는 MySQL 트리거 3분리·문법 검증, WAL 방식은 범위 밖(Debezium이 담당) |
| 원천 테이블 부재 → CDC 대상 없음 | §1 공통 전제로 원천 테이블 선(先)정의(F2와 공유, 중복 금지) |
| Polling DELETE 미감지로 데이터 불일치 오해 | 한계를 검증 기준·TC·로그에 명시, DELETE 시연은 trigger/debezium 안내 |
| NiFi 컨테이너 중복 도입(F3와) | 인프라 공유 결정(실물 확인 후) — 프로파일 단일화 |
| 소스 스키마 변경(마이그레이션) 롤백 | 멱등 마이그레이션 + 별도 파일, `CDC_METHOD=debezium` 복귀 시 무영향(컬럼·로그 테이블은 잔존해도 무해) |
