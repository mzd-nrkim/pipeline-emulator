# [FEAT] 인프라 연결 뷰 실체화 (스텁 3엣지 → 유의미한 의존 그래프)

> 상태: 초안

인프라 뷰가 `dependency` 채널 **엣지 3개**(`es→kibana`, `mysql컨테이너→debezium`, `mysql컨테이너→nifi`)만 가져, 화면에 **서로 안 이어진 조각 2개**로 렌더된다. 게다가 `es`는 들어오는 의존 엣지가 없어 위상정렬이 소스로 오판 → **좌상단**에 배치(사용자가 "ES가 왜 맨 왼쪽 위냐"고 지적한 원인). "뷰"라 부를 실체가 없다.

> 근거(코드 확인, 2026-07-15):
> - `frontend/src/lib/mock/topology.ts:198-203` — dependency 엣지 3개뿐. `es→kibana`, `mysql-container→debezium/nifi`.
> - `frontend/src/lib/canvas/buildNodesAndEdges.ts:computeDepths` — in-degree 0 노드를 depth 0(좌상단) 배치. infra 뷰에서 `es`는 in-degree 0 → 좌상단.
> - 두 dependency 서브그래프가 연결점 없음 → 화면상 분리된 2조각.

## 결함
- **C-1 의존 데이터 빈약**: 실제 `docker-compose` 서비스 의존(airflow↔valkey, es↔ml-node, 각 도구↔mysql 등)이 topology의 `dependency` 채널에 거의 반영 안 됨.
- **C-2 레이아웃 오배치**: 방향성 없는 의존 그래프에 데이터흐름용 위상정렬을 그대로 적용 → `es` 등 좌상단 오판.

## 목표
- 인프라 뷰가 **실제 컨테이너/서비스 의존 관계**를 반영해 연결된(또는 의미 있는 그룹) 그래프로 렌더된다.
- 의존 그래프에 맞는 레이아웃(방향성 약한 그래프용)으로 배치돼 "시작점 오판"이 사라진다.

## 접근 방법
1. **의존 데이터 확충**: `docker-compose.yml` 서비스·`depends_on`·네트워크를 근거로 `dependency` 엣지를 확충(각 도구 노드 ↔ 인프라 컨테이너: mysql/valkey/es/airflow-meta 등).
2. **레이아웃 재고**: 인프라 뷰는 데이터흐름의 좌→우 위상정렬이 부적합 → 계층(컨테이너/서비스/스토리지 grouping) 또는 force-directed 배치로 분리. 최소한 in-degree 0 오판 방지(무방향 취급 옵션).
3. **연결성 점검**: 렌더 결과가 고립 조각 남발이 아니라 의미 있는 그룹(예: 스토리지 계층·수집 계층)으로 읽히는지 검증.

## 작업 목록

### A. 의존 데이터 확충
- [ ] A-1. `docker-compose.yml` 서비스·depends_on 조사 → 의존 엣지 목록화 (산출: 대응표)
- [ ] A-2. `topology.ts`에 `dependency` 엣지·컨테이너 노드 확충 (path: frontend/src/lib/mock/topology.ts)

### B. 레이아웃
- [ ] B-1. 인프라 뷰 전용 배치 전략 도입 (path: frontend/src/lib/canvas/buildNodesAndEdges.ts) — 데이터뷰 위상정렬과 분리
- [ ] B-2. in-degree 0 오판(es 좌상단) 해소 검증

### Z. 게이트
- [ ] Z-pre. `npm run check` 통과
- [ ] Z-post. e2e: 인프라 뷰 전환 시 연결 그래프 렌더(고립 조각 아님) 단언 강화

## Verification (Right-BICEP)
- [ ] **Right**: 인프라 뷰가 실제 서비스 의존을 반영, `es`가 좌상단 소스로 오판되지 않음.
- [ ] **B**: dependency 엣지 0개일 때 빈 뷰 안내(크래시 없음).
- [ ] **Cross-check**: 인프라 엣지가 `docker-compose` depends_on과 대조 일치.
- [ ] **Reference**: 데이터뷰↔인프라뷰 전환 왕복 후 상태 오염 없음.

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 배치 전략(계층 vs force) | plan-review | force-directed 라이브러리 도입 여부 |
| 인프라 뷰 우선순위 | 사용자 확인 | 데이터뷰 정합(bug plan) 이후 |
