# F2. 실시간 CDC (Debezium) — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★★
> 방향전환 판단(2026-07-15): **그대로 도구노드 편입**. Debezium CDC를 수집 도구 노드로 구현, Silver-1 트리거 계약 불변 → 다운스트림 영향 없음.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `CDC=off|on` (기본 `off`)

---

## 목표

배치(snapshot) 수집과 병행해 "소스 변경 → 실시간 반영"을 시연한다.

## 전환 트리거

"소스 변경 → 실시간 반영" 시연 요구가 생길 때.

## 작업

- [ ] Debezium Server + Valkey Stream 컨테이너 도입 (`CDC=on`)
- [ ] **CDC 어댑터** — Debezium `op`(c/u/d/r) → `change_operation`(snapshot/insert/update/delete) 정규화. MVP가 선점한 `change_operation` 필드 계약에 실시간 소스를 연결 → Silver-1 이하는 수집 방식을 모름
- [ ] 소스 변경 이벤트 → Bronze → Silver-1 트리거 흐름 (같은 트리거 conf 계약 재사용)

## 검증 기준

- [ ] 소스 RDB 변경 → 대시보드에 실시간 카운트 증가 반영
- [ ] 배치·실시간이 동일 Silver-1 트리거 conf 계약을 노출 (Silver-1 이하 코드 변경 0)
- [ ] Debezium `op` 4종이 `change_operation`으로 정규화됨

## 재사용 자산

- 개인 CDC 3방식 가이드(SQL 포함) `docs/study/test_pipeline_1/06_news_cdc_pipeline_plan.md`
- MVP에서 채운 `change_operation` 필드 계약 (배치 수집이 선점)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| Debezium `op`→`change_operation` 매핑 누락 | 어댑터에서 4종 op 전수 매핑, 미지원 op는 명시적 에러 |
| Valkey Stream 컨테이너 추가 부담 | 되돌리기 쉬운 컴포넌트 추가 — 토글 off로 즉시 배치-only 복귀 |
