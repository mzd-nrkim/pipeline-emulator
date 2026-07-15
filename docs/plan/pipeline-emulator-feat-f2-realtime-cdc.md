# F2. 실시간 CDC (Debezium) — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★★
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

- [ ] F2-1. Debezium Server + Valkey Stream 컨테이너 도입 (path: docker-compose.yml, 앵커: services에 debezium·valkey 신규 + `CDC=on` 프로파일, 의도: 실시간 소스 변경 캡처 인프라)
  - [ ] Debezium Server 컨테이너 정의 (source connector·sink 설정)
  - [ ] Valkey Stream 컨테이너 정의 (변경 이벤트 버퍼)
  - [ ] `CDC=off|on` 토글로 두 컨테이너 조건부 기동 (기본 off → 배치-only 복귀)
- [ ] F2-2. CDC 어댑터 — Debezium `op`(c/u/d/r) → `change_operation`(snapshot/insert/update/delete) 정규화 (path: 수집 어댑터 신규, 앵커: op 매핑 함수, 의도: MVP 선점 `change_operation` 계약에 실시간 소스 연결 — Silver-1 이하는 수집 방식 불문)
  - [ ] op 4종 전수 매핑 + 미지원 op 명시적 에러
- [ ] F2-3. 소스 변경 이벤트 → Bronze → Silver-1 트리거 흐름 (path: 트리거 경로, 앵커: Silver-1 트리거 conf, 의도: 같은 트리거 conf 계약 재사용 — 다운스트림 불변)

## 검증 기준

- [ ] 소스 RDB 변경 → 대시보드에 실시간 카운트 증가 반영
- [ ] 배치·실시간이 동일 Silver-1 트리거 conf 계약을 노출 (Silver-1 이하 코드 변경 0)
- [ ] Debezium `op` 4종이 `change_operation`으로 정규화됨

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

### Z-pre. 머지 전 (정적)
- [ ] CDC 어댑터 op 매핑 함수 단위테스트(4종 op + 미지원 op) 통과
- [ ] `docker-compose.yml` CDC 프로파일 문법 dry (`docker compose config`)

### Z-post. push 후 (앱 기동 환경)
- [ ] `CDC=on` 기동 → 소스 RDB 변경 → 대시보드 실시간 카운트 증가 e2e 스모크
  - [ ] CDC 실시간 반영 스모크 spec 신규 작성
    - teardown: 테스트 소스 변경분 롤백 + `docker compose down -v`(valkey stream·debezium offset 정리)
- [ ] `CDC=off` 복귀 시 배치-only 정상(회귀)

## TC (Right-BICEP · CORRECT)

- [ ] **Right**: 소스 insert/update/delete → `change_operation`이 각각 insert/update/delete로 정규화·대시보드 반영.
- [ ] **B(경계)**: 스냅샷 초기적재(`r`) → `snapshot` 매핑.
- [ ] **I(교차검증)**: 배치·실시간이 동일 Silver-1 트리거 conf 노출 → Silver-1 이하 코드 diff 0 확인.
- [ ] **C(에러)**: 미지원 `op` 수신 → 명시적 에러(무시·오분류 아님).
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
