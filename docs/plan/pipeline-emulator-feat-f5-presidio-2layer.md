# F5. 풀 Presidio 2-Layer 마스킹 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★
> 방향전환 판단(2026-07-15): **그대로 도구노드 편입**. Presidio Layer2 on/off를 도구 노드 config param으로 관리. 다운스트림 진입점은 `detect_and_mask()` 단일 인터페이스 유지.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `MASK=regex|presidio` (기본 `regex`)

---

## 목표

정규식(Layer1)에 spaCy 한국어 NER(Layer2)을 더해 이름·주소 등 비패턴 PII까지 마스킹한다.

## 전환 트리거

마스킹 정밀도가 시연 포인트가 될 때.

## 작업

- [ ] MVP PII 래퍼의 **Layer2 스위치를 on** (`MASK=presidio`) — 래퍼는 MVP에서 이미 신설됨
- [ ] spaCy `ko_core_news_lg`(~0.5GB) 도입, `_create_nlp_engine()` 교체
- [ ] 샘플 데이터에 이미 심어둔 KR_NAME·KR_ADDRESS가 마스킹되는지 검증, `masking_method="presidio_2layer"`

## 검증 기준

- [ ] 이름("김철수"→"김*")·주소가 마스킹됨 (Layer2 NER 동작)
- [ ] `pii_pattern_types`에 NER 엔티티(KR_NAME·KR_ADDRESS) 반영
- [ ] `masking_method`가 "regex"→"presidio_2layer"로 전이
- [ ] `detect_and_mask()` 진입점 시그니처 불변 (다운스트림 영향 0)

## 재사용 자산

- 원본 `services/airflow/libs/structuring/pii/engine.py` (Presidio 2-Layer 엔진)
- MVP PII 엔진 래퍼 (Layer2 on/off 스위치 — MVP에서 신규 제작)
- 샘플 데이터에 이미 심은 비패턴 PII (KR_NAME·KR_ADDRESS)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| spaCy `ko_core_news_lg` ~0.5GB 부담 | 토글 종속 — off면 미로드. 데모 시점에만 활성 |
| NER 오탐/미탐 | 원본 엔진 로직 그대로 이식, 임계값 원본 정책 유지 |

## 비고

모듈화에서 MVP가 유일하게 신규로 만든 래퍼(Layer2 off 스위치)의 회수 지점. `detect_and_mask()` 단일 진입점 덕분에 Silver-2 이하는 마스킹 방식 변화를 모른다.
