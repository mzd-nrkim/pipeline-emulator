# 파이프라인 에뮬레이터 — Post-MVP 기능 단위 로드맵

> 작성일: 2026-07-14 / 상태: 로드맵 (트리거 발동 시 개별 착수)
> 선행: [pipeline-emulator-mvp-plan.md](./pipeline-emulator-mvp-plan.md) · [pipeline-emulator-week2-plan.md](./pipeline-emulator-week2-plan.md)
> 근거: [pipeline-emulator-decisions.md](../pipeline-emulator-decisions.md) "다음 계획"

---

## 왜 기능 단위인가

Week 2까지는 **시간 단위**(마감이 항목을 묶음)로 계획했다. 그 이후 축들은 성격이 다르다:

- 각 축이 **독립 토글**이다 — 설정 메뉴의 스위치 하나에 1:1 대응(decisions §설정 메뉴).
- **전환 트리거가 제각각**이다 — 고객사 API 오픈, "검색 데모 요구", "실시간 반영 시연 요구" 등 발동 조건이 서로 무관.
- **되돌리기 쉬운 컴포넌트 스왑**이다 — MVP 스택을 교체하지 않고 옆에 붙이거나 스위칭. 파이프라인 로직 재작성 없음.

→ 시간으로 묶을 근거가 없으므로, **각 축을 독립 기능 단위 계획서**로 분리했다. 이 문서는 우선순위·의존·설정 토글 대응을 관리하는 **인덱스**이고, 각 기능의 목표·작업·검증·재사용 자산은 개별 `pipeline-emulator-feat-<f>.md` 파일에 있다.

---

## 우선순위 (원본 근접도·시연 가치 기준)

```
검색 서빙(ES) ≈ 실시간 CDC  >  NiFi 수집기  >  ES 다중 노드
(+ 청킹·엔리치 실 API 전환, 풀 Presidio, CeleryExecutor 분산 — 트리거 종속)
```

| # | 기능 축 | 토글 | 전환 트리거 | 우선순위 | 계획서 |
|---|---------|------|-------------|:-------:|--------|
| F1 | 검색 서빙 (ES) | `SEARCH=off\|lite\|hybrid` | 검색이 데모 범위로 들어올 때 (데모 클라이맥스) | ★★★ | [feat-f1](./pipeline-emulator-feat-f1-search-es.md) |
| F2 | 실시간 CDC | `CDC=off\|on` | "소스 변경 → 실시간 반영" 시연 요구 | ★★★ | [feat-f2](./pipeline-emulator-feat-f2-realtime-cdc.md) |
| F3 | NiFi 수집기 | `COLLECTOR=script\|nifi` | 수집 흐름 자체가 시연 대상이 될 때 | ★★ | [feat-f3](./pipeline-emulator-feat-f3-nifi-collector.md) |
| F4 | 청킹·엔리치 실 API | `ENRICH=mock\|real` | 고객사 API 실제 오픈 | ★★ | [feat-f4](./pipeline-emulator-feat-f4-real-enrich-api.md) |
| F5 | 풀 Presidio 2-Layer | `MASK=regex\|presidio` | 마스킹 정밀도가 시연 포인트가 될 때 | ★★ | [feat-f5](./pipeline-emulator-feat-f5-presidio-2layer.md) |
| F6 | CeleryExecutor 분산 | `PROFILE=local\|celery` | "실제 분산 워커 동작"이 요구될 때 | ★ | [feat-f6](./pipeline-emulator-feat-f6-celery-executor.md) |
| F7 | ES 다중 노드 | `ES=single\|cluster` | 고가용성/부하가 시연 대상 (F1 on 전제) | ★ | [feat-f7](./pipeline-emulator-feat-f7-es-cluster.md) |

> 공통 원칙: **Mock API 인터페이스·DAG 태스크 경계를 원본과 동일 유지** → 모든 교체가 파이프라인 재작성 없이 컴포넌트 스왑으로 끝난다. MVP에서 심어둔 3계약(PII 래퍼·API 어댑터·CDC 필드)이 이 스왑의 선점 지점이다.
>
> 각 기능의 목표·작업·검증·재사용 자산은 위 "계획서" 링크의 개별 파일에 있다. 아래는 착수 판단용 요약이다.

---

## 기능별 요약 (착수 판단용)

각 항목의 상세 계획서는 위 표의 "계획서" 링크 참조.

### [F1. 검색 서빙 (ES)](./pipeline-emulator-feat-f1-search-es.md) — 데모 클라이맥스 ★★★
Gold `staged` payload를 실제 검색까지 연결. ES 단일노드→인덱싱→임베딩→RRF 하이브리드 단계적 도입. 노트북 리소스 부담은 `lite`→`hybrid` 단계 도입으로 헤지. **데모 임팩트 최상.**

### [F2. 실시간 CDC (Debezium)](./pipeline-emulator-feat-f2-realtime-cdc.md) ★★★
배치와 병행해 "소스 변경 → 실시간 반영" 시연. 핵심은 Debezium `op`→`change_operation` 정규화 **어댑터**로, MVP가 선점한 필드 계약에 실시간 소스를 물린다.

### [F3. NiFi 수집기](./pipeline-emulator-feat-f3-nifi-collector.md) ★★
Python 수집을 NiFi로 교체해 수집 실물 재현. Bronze 경로·Parquet 스키마·`row_hash` 계약 유지로 다운스트림 불변. 개인 compose 자산 재사용.

### [F4. 청킹·엔리치 실 API 전환](./pipeline-emulator-feat-f4-real-enrich-api.md) ★★
Mock→실 API URL 교체. MVP가 원본 스펙 지향으로 설계했으면 코드 변경 0의 설정 전환. 고객사 API 오픈이 트리거.

### [F5. 풀 Presidio 2-Layer 마스킹](./pipeline-emulator-feat-f5-presidio-2layer.md) ★★
MVP PII 래퍼의 Layer2 스위치 on + spaCy `ko_core_news_lg` 도입. 이름·주소 등 비패턴 PII까지 마스킹. `detect_and_mask()` 진입점 불변.

### [F6. CeleryExecutor 분산 전환](./pipeline-emulator-feat-f6-celery-executor.md) ★
valkey 브로커 + celery worker 분리. TaskFlow DAG라 코드 수정 0. 되돌리기 쉬운 변경(서비스 2개 + 환경변수 3개).

### [F7. ES 다중 노드 (3-master)](./pipeline-emulator-feat-f7-es-cluster.md) ★ (최하위)
ES 단일→3-master 클러스터로 HA·부하 시연. **F1 on 전제.** 노트북 리소스 부담 커 우선순위 최하.

---

## 설정 메뉴 ↔ 기능 축 대응 (참조)

각 기능 축(F1~F7)은 Week 2에 만든 설정 메뉴 토글과 1:1 대응한다. Week 2 시점엔 전부 "다음 계획" 배지로 비활성 노출되고, 각 F가 구현되면 해당 토글이 활성화된다.

| 토글 | 기본값 | 대응 기능 |
|------|--------|-----------|
| `SEARCH=off\|lite\|hybrid` | `off` | F1 |
| `CDC=off\|on` | `off` | F2 |
| `COLLECTOR=script\|nifi` | `script` | F3 |
| `ENRICH=mock\|real` | `mock` | F4 |
| `MASK=regex\|presidio` | `regex` | F5 |
| `PROFILE=local\|celery` | `local` | F6 |
| `ES=single\|cluster` | `single` | F7 |

> 이 대응이 유지되는 한, "로드맵 = 설정 메뉴에 이미 보이는 축들의 실체화"가 된다. 데모에서 로드맵을 설정 화면으로 보여주고, 각 F 구현 시 배지가 하나씩 활성으로 바뀌는 서사가 성립한다.
