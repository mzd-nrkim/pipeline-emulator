# F1. 검색 서빙 (ES) — 기능 계획서

> 작성일: 2026-07-14 / 상태: 대기 (트리거 발동 시 착수) / 우선순위: ★★★
> 방향전환 판단(2026-07-15): **경미 수정**. DAG 기준 서술을 "검색(ES) 도구 노드" 프레이밍으로 조정. 기능 자체(BM25·벡터·하이브리드)는 유효.
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 토글: `SEARCH=off|lite|hybrid` (기본 `off`)

---

## 목표

Gold `staged`에서 멈춘 payload를 실제 검색까지 연결한다. "파이프라인이 흐르고 최종 검색까지 시연"되는 데모 클라이맥스를 완성한다.

## 전환 트리거

검색이 데모 범위로 들어오거나 팀 범위가 확장될 때.

## 작업 (단계적 도입)

- [ ] ES 단일 노드 컨테이너 도입 (`SEARCH=lite`)
- [ ] `gold_6_es_indexing` DAG 신설 — Gold `es_field_info` payload → ES 인덱싱 (`indexing_status` staged→indexed)
- [ ] 내장 ML 임베딩(E5) — 벡터 필드 생성
- [ ] BM25 + Vector RRF 하이브리드 검색 (`SEARCH=hybrid`)
- [ ] 대시보드 검색 노드를 "예정"→활성으로 전환, 검색 UI(질의·결과·하이브리드 스코어) 추가

## 검증 기준

- [ ] 더미 문서 검색 질의 → BM25 결과 반환 (`lite`)
- [ ] 임베딩 벡터 생성 후 Vector·RRF 하이브리드 결과 반환 (`hybrid`)
- [ ] 대시보드 흐름 끝 검색 노드가 "예정"→활성으로 동작
- [ ] `indexing_status`가 staged→indexed로 전이

## 재사용 자산

- 원본 `hyundaimotor-lllm/docs/기술검토확정/13_벡터_임베딩/` (ES ML 노드 내장 모델 전환)
- 원본 `gold_6_pdis_cft_indexing` DAG
- Gold `es_field_info` payload — MVP에서 이미 채운 `target_index`·`routing`

## 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| 노트북 리소스 부담(ES + 임베딩) | `lite`(단일노드+BM25) → `hybrid`(임베딩) 단계적 도입 |
| 임베딩 모델 무게 | 경량 임베딩 모델 확정 후 도입 (decisions 미결 항목) |

## 관련 확장

- F7(ES 다중 노드)는 본 기능 `on`이 전제. HA·부하 시연 필요 시 후속.
