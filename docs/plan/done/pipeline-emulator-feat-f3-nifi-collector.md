# F3. NiFi 수집기 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★
> 상태: 게이트통과-머지대기
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
- **NiFi 인프라 소유권(통합 조율 2026-07-20)**: F3가 **NiFi+ZooKeeper compose 인프라를 소유·도입**한다. [F2b(NiFi CDC Polling/Trigger)](./pipeline-emulator-feat-f2b-nifi-cdc-methods.md)가 같은 NiFi를 공유하므로, F3의 NiFi 서비스 정의는 F2b 플로우도 얹을 수 있게 프로파일(`nifi`)·볼륨(플로우 정의 마운트)을 일반화한다. **실행 순서: F3 선행 → F2b가 그 위에 CDC 플로우 추가**(F2b 단독 선행 시 임시 NiFi 도입 후 F3 착수 시 소유권 이관).
- **패키징(F2 교훈)**: NiFi가 Python 수집 로직을 호출(ExecuteStreamCommand 등)하면 `scripts.ingest` 전이 의존(`boto3`·`pyarrow`)이 실행 환경에 필요.
- **hash_utils 물리화 필요**: `hash_utils`는 현재 독립 파일 없음 — `scripts/ingest.py` L27 `compute_hub_hash` 함수가 유일 구현체. F3-2에서 `scripts/hash_utils.py` 신규 작성 + `ingest.py` import 교체가 필요. F3-2 단일 에이전트가 동일 파일 편집 충돌 없이 처리.
- **NiFi 플로우 정의 경로 미확정**: 현재 `nifi/flows/` 디렉토리 미존재. F3-2에서 신규 생성. 파일 형식(XML vs JSON) 및 NiFi 2.8 플로우 포맷은 실물 확인 후 결정.

## 작업

- [x] F3-1. NiFi + ZooKeeper 단일 노드 도입 (path: docker-compose.yml, 앵커: services에 nifi·zookeeper 신규 + `COLLECTOR=nifi` 프로파일, 의도: 수집 도구 실물 재현, 개인 compose 자산 재사용)
  - [x] `zookeeper` 서비스 블록 추가 (path: docker-compose.yml, 앵커: services 섹션, 의도: NiFi 상태관리 백엔드, ZK 3.9.4 이미지)
  - [x] `nifi` 서비스 블록 추가 (path: docker-compose.yml, 앵커: services 섹션, 의도: NiFi 2.8 단일 노드 기동 — 개인 compose 자산 재사용)
  - [x] `nifi` 서비스에 `profiles: [nifi]` 지정 (path: docker-compose.yml, 앵커: nifi 서비스 블록 내 profiles, 의도: 기본 `docker compose up` 시 NiFi 제외, `--profile nifi` 시에만 활성)
  - [x] NiFi 플로우 마운트 볼륨 경로 일반화 (path: docker-compose.yml, 앵커: nifi volumes, 의도: F2b CDC 플로우도 동일 NiFi 위에 얹을 수 있게 공유 볼륨 구조 설계, 실물 확인 후 결정)
- [x] F3-2. NiFi 플로우로 원천 → Bronze Parquet 적재 (path: NiFi 플로우 정의, 앵커: PutParquet/경로 프로세서, 의도: Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약 유지)
  - [x] NiFi 플로우 정의 파일 신규 작성 (path: nifi/flows/collector-flow.xml, 앵커: 신규 파일, 의도: 원천 데이터 읽기 → Bronze Parquet 적재 플로우 정의)
  - [x] PutParquet 프로세서에 Bronze 경로 규칙 적용 (path: nifi/flows/collector-flow.xml, 앵커: PutParquet 프로세서 속성, 의도: SeaweedFS Bronze 경로 규칙 준수)
  - [x] `scripts/hash_utils.py` 신규 작성 — `compute_hub_hash` 분리 이전 (path: scripts/hash_utils.py, 앵커: 신규 파일, 의도: `scripts/ingest.py` L27 `compute_hub_hash` 함수를 별도 모듈로 분리)
  - [x] `row_hash` 산출을 `hash_utils` 계약과 일치(중앙화) (path: scripts/ingest.py, 앵커: compute_hub_hash 함수 정의 L27, 의도: 함수 제거 후 `from scripts.hash_utils import compute_hub_hash`로 교체)
  - [x] NiFi ExecuteStreamCommand 래퍼 스크립트 작성 (path: scripts/nifi_hash_bridge.py, 앵커: 신규 파일, 의도: NiFi에서 `scripts.hash_utils.compute_hub_hash` 호출 — boto3·pyarrow 의존성 포함)
- [x] F3-3. 수집기 스위칭 검증 (path: `COLLECTOR=script|nifi` 토글, 앵커: 수집 진입점, 의도: script↔nifi 동일 Bronze 계약 산출 — 다운스트림 코드 변경 0)
  - [x] 수집 진입점에 `COLLECTOR` 환경변수 읽기·분기 추가 (path: scripts/ingest.py, 앵커: 수집 시작 로직 진입부, 의도: `os.environ.get("COLLECTOR", "script")` 값에 따라 NiFi/script 경로 분기)
  - [x] `COLLECTOR=nifi` 분기 — NiFi 플로우 트리거 로직 작성 (path: scripts/ingest.py, 앵커: COLLECTOR=nifi 분기, 의도: NiFi REST API 또는 컨테이너 CLI로 플로우 실행 트리거)
  - [x] `COLLECTOR=script` 기존 경로 유지 확인 (path: scripts/ingest.py, 앵커: 기존 수집 로직, 의도: 다운스트림 코드 변경 0 정적 확인)

## 검증 기준

- [ ] NiFi 경유 수집 결과가 Python 수집과 동일 Bronze 스키마·행 수
- [ ] Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약 불변
- [ ] 토글로 script↔nifi 전환 시 다운스트림(Bronze 등록 이하) 코드 변경 0

## Z. 머지 전·후 검증 (게이트 — 스킵 금지)

### Z-pre. 머지 전 (정적)
- [x] `docker-compose.yml` NiFi 프로파일 문법 dry (`docker compose config`)
- [x] Bronze 경로 규칙·Parquet 스키마·`row_hash` 계약이 단일 출처(`hash_utils` 등)인지 정적 확인

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
- [ ] **P(성능)**: 수천 행 이상 원천 수집 시 NiFi 플로우 처리 완료 확인 (시간 수치 미정 — 완료 여부 + 에러 없음 수준 검증).
- **R(Reference/CORRECT)**: NiFi 컨테이너 내 Python 의존성(`boto3`·`pyarrow`) 가용 — `docker compose exec nifi python -c "import boto3, pyarrow"`.
  - [ ] NiFi 컨테이너 내 Python 의존성 가용 여부 확인
- **C(Cardinality/CORRECT)**: 빈 원천(0행)은 B(경계)에서 다룸.
  - [ ] 단일 행(1행) 원천 → row_hash 1개 고유 단언
- **E(Existence/CORRECT)**: 원천 파일 부재 → B(경계) 빈 원천에서 커버 → "해당 없음".
- **R(Range/CORRECT)**: Parquet 컬럼 값 범위 → Conformance(계약 불변)로 커버 → "해당 없음".
- [ ] **T(Time/CORRECT)**: `--profile nifi` 기동 후 NiFi 헬스체크 대기 → 타임아웃(3분) 초과 시 에러 확인

## 재사용 자산

- 개인 `scripts/nifi/docker-compose.yml` (NiFi 2.8 + ZK 3.9.4)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| NiFi 설정 공수 | 개인 compose 자산 재사용, 단일 노드로 최소화 |
| 수집기 계약 불일치 | `hash_utils` 중앙화·Bronze 경로 규칙을 계약으로 고정 |
