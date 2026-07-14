# F3. NiFi 수집기 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `COLLECTOR=script|nifi` (기본 `script`)

---

## 목표

Python 수집 스크립트를 원본 NiFi로 교체해 수집 단계 실물을 재현한다.

## 전환 트리거

수집 흐름 자체가 시연 대상이 될 때.

## 작업

- [ ] NiFi + ZooKeeper 단일 노드 도입 (`COLLECTOR=nifi`)
- [ ] NiFi 플로우로 원천 → Bronze Parquet 적재 (Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약 유지)
- [ ] 수집기 스위칭 검증 (script↔nifi가 동일 Bronze 계약 산출)

## 검증 기준

- [ ] NiFi 경유 수집 결과가 Python 수집과 동일 Bronze 스키마·행 수
- [ ] Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약 불변
- [ ] 토글로 script↔nifi 전환 시 다운스트림(Bronze 등록 이하) 코드 변경 0

## 재사용 자산

- 개인 `scripts/nifi/docker-compose.yml` (NiFi 2.8 + ZK 3.9.4)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| NiFi 설정 공수 | 개인 compose 자산 재사용, 단일 노드로 최소화 |
| 수집기 계약 불일치 | `hash_utils` 중앙화·Bronze 경로 규칙을 계약으로 고정 |
