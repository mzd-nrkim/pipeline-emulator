# F6. CeleryExecutor 분산 전환 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `PROFILE=local|celery` (기본 `local`)

---

## 목표

원본 운영계 구성(CeleryExecutor + Valkey)을 로컬에서 시연한다. DAG 코드 불변, 인프라만 추가.

## 전환 트리거

"실제 분산 워커 동작"이 데모 요구사항이 될 때.

## 작업

- [ ] valkey 컨테이너 추가(브로커)
- [ ] result backend는 기존 MySQL 재사용 (원본과 동일)
- [ ] `airflow celery worker` 컨테이너 분리 (scheduler 직접 실행 → 워커 분리)
- [ ] `AIRFLOW__CORE__EXECUTOR=CeleryExecutor` + `CELERY__BROKER_URL` + `CELERY__RESULT_BACKEND` (`PROFILE=celery`)

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
