# F4. 청킹·엔리치 실 API 전환 — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `ENRICH=mock|real` (기본 `mock`)

---

## 목표

Mock API를 고객사 실 API로 무비용 교체한다. 계약이 맞으면 사실상 설정 전환.

## 전환 트리거

고객사 API 실제 오픈.

## 작업

- [ ] `CHUNKING_API_URL`/`ENRICH_API_URL`를 실 API 엔드포인트로 교체 (`ENRICH=real`)
- [ ] Pydantic 요청/응답 스키마가 실 API 스펙과 일치하는지 검증 (MVP에서 원본 스펙 지향 설계 → URL 교체로 끝나는 게 목표)
- [ ] 스펙 불일치 시에만 어댑터 보정

## 검증 기준

- [ ] 실 API 경유 청킹·엔리치 결과가 gold_3/gold_4 DAG 계약을 그대로 통과
- [ ] Mock↔real 전환이 URL 교체만으로 완료 (파이프라인 로직 재작성 0)
- [ ] `gold_chunked_documents`·`gold_enriched_documents` 스키마 불변

## 재사용 자산

- MVP Mock API 인터페이스 (원본 API 스펙 지향 설계)
- MVP API 어댑터 URL 경계 (`CHUNKING_API_URL`/`ENRICH_API_URL`)

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| 실 API 스펙이 Mock 가정과 불일치 | 어댑터 계층에서 요청/응답 변환, Pydantic 스키마로 조기 검출 |
| 고객사 API 오픈 지연 | 트리거 종속 — 오픈 전까지 Mock 유지, 우선순위 낮게 유지 |

## 비고

모듈화의 이상적 케이스 — 계약이 맞으면 코드 변경 0. MVP에서 Mock 인터페이스를 원본 API 스펙에 맞춰 설계하는 것이 관건이었고, 그 선점이 본 기능의 비용을 결정한다.
