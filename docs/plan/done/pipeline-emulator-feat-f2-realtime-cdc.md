# F2. 실시간 CDC (Debezium) — 기능 계획서

> 작성일: 2026-07-14 / 상태: 통테통과-완료 / 우선순위: ★★★
> 방향전환 판단(2026-07-15): **그대로 도구노드 편입**. Debezium CDC를 수집 도구 노드로 구현, Silver-1 트리거 계약 불변 → 다운스트림 영향 없음.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `CDC=off|on` (기본 `off`)
> **범주 주의(2026-07-15)**: 이 계획은 **수집 방식(배치→실시간) 원본 재현도** 축이다. "실 도커 연결 + 샘플데이터 작동"의 전제가 **아니다** — 그건 [feat-real-docker-sample-e2e](./pipeline-emulator-feat-real-docker-sample-e2e.md)에서 F2/F3/F7 없이 완성된다.

---

## 목표

배치(snapshot) 수집과 병행해 "소스 변경 → 실시간 반영"을 시연한다.

## 전환 트리거

"소스 변경 → 실시간 반영" 시연 요구가 생길 때.

## 실행 시 필수 고려사항

- **환경 전제**: `CDC=off`가 기본 → 이 계획은 토글 on일 때만 활성. Z-post e2e는 Debezium·Valkey 컨테이너 기동 전제(워크트리 불가).
- **회귀 범위**: 어댑터가 MVP 선점 `change_operation` 계약에 연결 → Silver-1 이하 코드 변경 0(회귀로 보장). 되돌리기는 토글 off로 즉시 배치-only 복귀.
- **미선택 결정**: 없음(도구노드 편입 방향 확정 — 상단 방향전환 판단 참조).

## 작업

- [x] F2-1. Debezium Server + Valkey Stream 컨테이너 도입 (path: docker-compose.yml, 앵커: services에 debezium·valkey 신규 + `CDC=on` 프로파일, 의도: 실시간 소스 변경 캡처 인프라) — 커밋 299e13d(wt/f2-cdc)
  - [x] Debezium Server 컨테이너 정의 (debezium/server:2.7, sink=redis valkey:6379, source=MySqlConnector)
  - [x] Valkey Stream 컨테이너 정의 (valkey/valkey:8, profiles: cdc)
  - [x] `CDC=off|on` 토글로 두 컨테이너 조건부 기동 (profiles: cdc, 기본 미기동 → 배치-only 불변 정적 검증)
- [x] F2-2. CDC 어댑터 — Debezium `op`(c/u/d/r) → `change_operation`(snapshot/insert/update/delete) 정규화 (path: scripts/cdc/debezium_adapter.py, 앵커: normalize_op, 의도: MVP 선점 `change_operation` 계약에 실시간 소스 연결) — 커밋 6a91cfa, 단위테스트 23/23
  - [x] op 4종 전수 매핑 + 미지원 op 명시적 에러(ValueError)
- [x] F2-3. 소스 변경 이벤트 → Bronze → Silver-1 트리거 흐름 (path: scripts/cdc/debezium_adapter.py+mutate_source.py, 앵커: trigger_silver_1, 의도: 같은 트리거 conf 계약 재사용 — 다운스트림 불변) — 커밋 5a2f8b2, 소스테이블 source_cft_problem_history 정의
  - CDC 대상 소스 테이블 `source_cft_problem_history` 신규(db/init.sql) + Debezium include.list 반영
  - `mutate_source.py` 변경 주입 CLI(--op insert/update/delete)
  - 어댑터가 Bronze 등록 직후 `silver_1_structuring` 동일 conf 트리거(DAG 무수정)

## 검증 기준

- [x] 소스 RDB 변경 → 대시보드에 실시간 카운트 증가 반영 — 실증: source INSERT/UPDATE/DELETE → bronze_rdb_events event_id 5/6/7 (insert/update/delete)
- [x] 배치·실시간이 동일 Silver-1 트리거 conf 계약을 노출 (Silver-1 이하 코드 변경 0) — 어댑터가 `POST /dags/silver_1_structuring/dagRuns` 동일 REST 사용, DAG 무수정
- [x] Debezium `op` 4종이 `change_operation`으로 정규화됨 — 실증: r/c/u/d → snapshot/insert/update/delete (어댑터 로그)

## post-gate 발견·교정 (실 컨테이너 e2e가 잡은 결함)

정적 검증(compose config·단위테스트)은 통과했으나 **실 컨테이너 e2e에서만 드러난 결함 4건**을 교정했다:
1. `debezium/server:2.7` — 존재하지 않는 이미지 태그 → `2.7.3.Final`로 교정 (커밋 ace30b2).
2. `include.list`가 medallion 전체 포함 → 어댑터가 `bronze_rdb_events`에 쓰면 Debezium이 재캡처하는 **무한 피드백 루프** → 원천 테이블만으로 한정 (커밋 0e5bbfc).
3. Debezium Server Redis sink 실포맷은 `{key-json: value-json}` 단일 필드인데 어댑터가 `payload` 이름 필드를 찾음 → **모든 이벤트 스킵** → 필드 값에서 envelope 추출로 교정 (커밋 0e5bbfc).
4. 삭제 tombstone(빈 value)이 "op 미지원"으로 오분류 → JSONDecodeError 스킵 처리 (커밋 0e5bbfc).
> 환경 주의: 로컬 네이티브 `redis-server`가 `127.0.0.1:6379`를 점유하면 호스트 어댑터가 CDC valkey 아닌 그 redis에 붙는다 — 스모크는 `VALKEY_PORT`로 우회 (scripts/cdc/smoke_cdc.sh 주석 참조).

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

### Z-pre. 머지 전 (정적)
- [x] CDC 어댑터 op 매핑 함수 단위테스트(4종 op + 미지원 op) 통과 — pyenv 3.11.13 격리 45/45 passed
- [x] `docker-compose.yml` CDC 프로파일 문법 dry (`docker compose config`) — 기본=CDC 부재, `--profile cdc`=valkey/debezium 등장 확인

### Z-post. push 후 (앱 기동 환경)
- [x] `CDC=on` 기동 → 소스 RDB 변경 → 대시보드 실시간 카운트 증가 e2e 스모크 — 실증 완료(수치: insert/update/delete 각 1건 change_operation 기록)
  - [x] CDC 실시간 반영 스모크 spec 신규 작성 — `scripts/cdc/smoke_cdc.sh`
    - [x] teardown: 스모크 데이터 정리(bronze CDC행·source행 DELETE) + CDC 컨테이너 제거, bronze 기준선(2) 복귀 확인
- [x] `CDC=off` 복귀 시 배치-only 정상(회귀) — CDC 컨테이너 제거 후 base 스택 정상, 기본 프로파일 불변(정적 검증)

## TC (Right-BICEP · CORRECT)

- [x] **Right**: 소스 insert/update/delete → `change_operation`이 각각 insert/update/delete로 정규화 — 실증(event 5/6/7).
- [x] **B(경계)**: 스냅샷 초기적재(`r`) → `snapshot` 매핑 — 실증(event 3/4 op=r→snapshot).
- [x] **I(교차검증)**: 배치·실시간이 동일 Silver-1 트리거 conf 노출 → Silver-1 이하 코드 diff 0 — DAG 무수정, 동일 REST 계약.
- [x] **C(에러)**: 미지원 `op`/tombstone → 명시적 처리(단위테스트 46/46, tombstone 스킵 회귀 테스트 포함).
- Conformance: Debezium `op` 4종 ↔ `change_operation` 4종 전수 매핑(누락 0).
- Ordering: 동일 키 다중 변경의 순서 보존(Valkey Stream) — 시연 범위면 확인, 아니면 "해당 없음".

## 재사용 자산

- 개인 CDC 3방식 가이드(SQL 포함) `docs/study/test_pipeline_1/06_news_cdc_pipeline_plan.md`
- MVP에서 채운 `change_operation` 필드 계약 (배치 수집이 선점)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| Debezium `op`→`change_operation` 매핑 누락 | 어댑터에서 4종 op 전수 매핑, 미지원 op는 명시적 에러 |
| Valkey Stream 컨테이너 추가 부담 | 되돌리기 쉬운 컴포넌트 추가 — 토글 off로 즉시 배치-only 복귀 |
