# F3. NiFi 수집기 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★
> 방향전환 판단(2026-07-15): **그대로 도구노드 편입**. NiFi를 수집 도구 노드화, script↔nifi 토글로 전환해도 Bronze 계약 불변 → 다운스트림 영향 없음.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `COLLECTOR=script|nifi` (기본 `script`)
> **범주 주의(2026-07-15)**: 이 계획은 **수집 도구(스크립트→NiFi) 원본 재현도** 축이다. "실 도커 연결 + 샘플데이터 작동"의 전제가 **아니다** — 그건 [feat-real-docker-sample-e2e](./pipeline-emulator-feat-real-docker-sample-e2e.md)에서 F2/F3/F7 없이 완성된다.

---

## 목표

Python 수집 스크립트를 원본 NiFi로 교체해 수집 단계 실물을 재현한다.

## 전환 트리거

수집 흐름 자체가 시연 대상이 될 때.

## 실행 시 필수 고려사항

- **환경 전제**: `COLLECTOR=script`가 기본 → 토글 nifi일 때만 활성. Z-post e2e는 NiFi·ZK 컨테이너 기동 전제(워크트리 불가).
- **회귀 범위**: Bronze 계약(경로·스키마·`row_hash`) 불변이 핵심 → 다운스트림(Bronze 등록 이하) 코드 변경 0. 되돌리기는 토글 script.
- **미선택 결정**: 없음(도구노드 편입 방향 확정).

## 작업

- [ ] F3-1. NiFi + ZooKeeper 단일 노드 도입 (path: docker-compose.yml, 앵커: services에 nifi·zookeeper 신규 + `COLLECTOR=nifi` 프로파일, 의도: 수집 도구 실물 재현, 개인 compose 자산 재사용)
- [ ] F3-2. NiFi 플로우로 원천 → Bronze Parquet 적재 (path: NiFi 플로우 정의, 앵커: PutParquet/경로 프로세서, 의도: Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약 유지)
  - [ ] `row_hash` 산출을 `hash_utils` 계약과 일치(중앙화)
- [ ] F3-3. 수집기 스위칭 검증 (path: `COLLECTOR=script|nifi` 토글, 앵커: 수집 진입점, 의도: script↔nifi 동일 Bronze 계약 산출 — 다운스트림 코드 변경 0)

## 검증 기준

- [ ] NiFi 경유 수집 결과가 Python 수집과 동일 Bronze 스키마·행 수
- [ ] Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약 불변
- [ ] 토글로 script↔nifi 전환 시 다운스트림(Bronze 등록 이하) 코드 변경 0

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

### Z-pre. 머지 전 (정적)
- [ ] `docker-compose.yml` NiFi 프로파일 문법 dry (`docker compose config`)
- [ ] Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약이 단일 출처(`hash_utils` 등)인지 정적 확인

### Z-post. push 후 (앱 기동 환경)
- [ ] `COLLECTOR=nifi` 기동 → 원천 적재 → Bronze Parquet 산출 e2e 스모크
  - [ ] NiFi 수집 파리티 스모크 spec 신규 작성 — script/nifi Bronze 스키마·행 수 동일 단언
    - teardown: 적재 Bronze Parquet·NiFi flowfile 저장소 정리 + `docker compose down -v`
- [ ] `COLLECTOR=script` 복귀 정상(회귀)

## TC (Right-BICEP · CORRECT)

- [ ] **Right**: NiFi 경유 수집 결과가 Python 수집과 동일 Bronze 스키마·행 수.
- [ ] **I(교차검증)**: 동일 원천에 script/nifi 각각 실행 → Bronze `row_hash` 집합 동일.
- [ ] **B(경계)**: 빈 원천·중복 행 → 계약대로 처리(`row_hash` 멱등).
- [ ] **C(에러)**: NiFi 프로세서 실패 시 명확한 에러(부분 적재 방지).
- Conformance: Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약 불변.
- Ordering: Bronze 적재 순서는 계약 아님(행 집합 동일성으로 검증) → "해당 없음".

## 재사용 자산

- 개인 `scripts/nifi/docker-compose.yml` (NiFi 2.8 + ZK 3.9.4)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| NiFi 설정 공수 | 개인 compose 자산 재사용, 단일 노드로 최소화 |
| 수집기 계약 불일치 | `hash_utils` 중앙화·Bronze 경로 규칙을 계약으로 고정 |
