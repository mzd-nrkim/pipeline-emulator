# 파이프라인 에뮬레이터 — 데모 시나리오

## 1. 시연 흐름 개요

파이프라인 에뮬레이터는 문서가 Bronze → Silver → Gold staged 단계를 거쳐 처리되는 과정을 실시간 대시보드로 시연합니다.

```
[투입] → [Bronze 등록] → [Silver 구조화] → [Silver 마스킹] → [Gold 청킹] → [Gold 엔리치먼트] → [Gold Staged]
                                                                                                         ↓
                                                                                              (Serving — 예정)
```

---

## 2. 단계별 시연 흐름 (T4-1)

### Step 0. 대시보드 초기 화면

1. 브라우저에서 대시보드를 열면 파이프라인 페이지(`/pipeline`)가 기본 표시됩니다.
2. 8개 단계 노드가 Bronze / Silver / Gold / Serving 레이어로 구분되어 CSS Grid 레이아웃으로 표시됩니다.
3. `검색 서빙` 노드는 **예정** 배지로 표시됩니다.
4. 각 노드에는 처리 상태(`none` / `in_progress` / `completed` / `failed`)와 통과 문서 수가 표시됩니다.

### Step 1. 문서 투입 (데이터 수집 단계)

**시연자 행동**: 스크립트나 mock API로 샘플 문서를 SeaweedFS에 업로드합니다.

**대시보드 확인 내용**:
- `데이터 수집` 노드가 활성 상태로 전환됩니다.
- SSE 스트림을 통해 5초 이내 노드 카운트가 갱신됩니다.
- 노드를 클릭하면 세부 패널에서 `docsIn`, `docsOut`, `마지막 처리 시각` 확인 가능합니다.

### Step 2. Bronze 등록 (bronze_0_registration DAG)

**시연자 행동**: Airflow 웹 UI 또는 API로 `bronze_0_registration` DAG를 트리거합니다.

**대시보드 확인 내용**:
- `Bronze 등록` 노드 상태가 `in_progress` → `completed`로 전환됩니다.
- `docsOut` 카운트가 MySQL `bronze_document_hub` 레코드 수를 반영합니다.
- 세부 패널에서 실행 소요 시간(`durationMs`) 확인 가능합니다.

### Step 3. Silver 구조화 (silver_1_structuring DAG)

**시연자 행동**: `silver_1_structuring` DAG를 트리거합니다.

**대시보드 확인 내용**:
- `Silver 구조화` 노드가 `completed` 상태로 전환됩니다.
- 처리 문서 수가 `silver_structured_documents` (is_latest=1) 기준으로 표시됩니다.

### Step 4. Silver 마스킹 — PII 현황 시연 (silver_2_masking DAG)

**시연자 행동**: `silver_2_masking` DAG를 트리거합니다.

**대시보드 확인 내용**:
- `Silver 마스킹` 노드를 클릭합니다.
- 세부 패널에 **PII 마스킹 현황** 섹션이 표시됩니다:
  - 마스킹/비마스킹 문서 수 집계
  - PII 유형별 건수 (이름, 전화번호, 주민번호 등)
  - 현재 마스킹 방식 (`regex` 기본값, Presidio는 예정)
  - 미적용 유형은 **예정** 표시

### Step 5. Gold 처리 3단계 (chunking → enrichment → field mapping)

**시연자 행동**: `gold_3_chunking` → `gold_4_enrichment` → `gold_5_field_mapping` DAG를 순차 트리거합니다.

**대시보드 확인 내용**:
- Gold 레이어 3개 노드(`Gold 청킹`, `Gold 엔리치먼트`, `Gold Staged`)가 순차적으로 `completed` 상태로 전환됩니다.
- 각 단계별 문서 수가 MySQL 집계값으로 실시간 갱신됩니다.
- `실행 이력` 패널에서 최근 5개 DAG 실행 목록을 확인할 수 있습니다.

### Step 6. 실행 이력 탭

**시연자 행동**: 상단 탭에서 `실행 이력` 을 클릭합니다.

**대시보드 확인 내용**:
- 6개 DAG의 최근 실행 목록이 최신순으로 정렬됩니다.
- 각 행에서 `실행 ID`, `시작 시각`, `소요 시간`, `결과(성공/실패)` 확인 가능합니다.

---

## 3. 설정 메뉴 로드맵 스토리 (T4-2)

설정 페이지(`/settings`)에서 에뮬레이터 구성 축 7개를 시연합니다.

### 현재 구현된 축 (조작 가능)

| 축 | 기본값 | 설명 |
|----|--------|------|
| 마스킹 방식 | regex | 현재 정규식 기반 PII 마스킹 |
| 검색 서빙 | off | ES 검색 서빙 활성화 스위치 |
| 청킹 방식 | rule_based | Gold 청킹 알고리즘 선택 |
| 엔리치먼트 | rule_based | Gold 엔리치먼트 방식 선택 |

### 예정 축 (비활성 + "다음 계획" 배지)

| 축 | 배지 | 로드맵 설명 |
|----|------|------------|
| Presidio 레이어 | 다음 계획 | NLP 기반 PII 감지 — post-MVP 로드맵 |
| 분산 실행 | 다음 계획 | CeleryExecutor 전환 — ES 스트레치 이후 |
| ES 클러스터 | 다음 계획 | 검색 서빙 on 활성화 전제 |

**시연 포인트**:
- 조작 가능한 축을 변경하면 화면 상단에 **재시작 필요** 안내 배너가 표시됩니다.
- "백엔드 즉시 반영은 지원되지 않습니다" 메시지로 Week 2 범위를 명확히 안내합니다.
- 미구현 축의 "다음 계획" 배지를 통해 로드맵 자체가 데모의 일부로 작동합니다.

---

## 4. 발표 자료 준비 (T4-3)

### 아키텍처 설명 포인트

**Week 2 아키텍처 (7서비스)**:
```
SeaweedFS (파일 저장소)
    ↓
MySQL (파이프라인 데이터: Bronze/Silver/Gold 테이블)
    ↓
Airflow (6개 DAG: bronze_0 ~ gold_5)
    ↓
ui-backend (FastAPI: /stages, /runs, /sse/stages, /config)
    ↓
ui (SvelteKit: 대시보드 + 설정)

postgres (모니터링 앱 상태 — 별도 서비스 DB)
```

**DB 분리 원칙**: 파이프라인 데이터(MySQL) ↔ 모니터링 앱 상태(postgres) 분리

### Week 2 주요 성과

1. **실시간 모니터링**: SSE 기반 `/sse/stages` 스트림으로 5초 간격 단계별 카운트 갱신
2. **통합 대시보드**: 8개 단계 노드, PII 마스킹 현황, 실행 이력을 단일 화면에서 제공
3. **설정 메뉴**: 구성 축 7개 노출, 미구현 축은 로드맵으로 자동 시각화
4. **증분 아키텍처**: Week 1 MVP(Airflow + MySQL) 자산을 버리지 않고 ui-backend로 흡수

### 흐름 다이어그램 설명

시연 시 다음 순서로 진행:
1. 대시보드 초기 화면 → 8개 노드 레이어 구조 설명
2. 문서 투입 → Bronze 등록 실행 → 카운트 갱신 확인
3. Silver 마스킹 → PII 현황 패널 상세 설명
4. Gold 3단계 완료 → 실행 이력 조회
5. 설정 페이지 → 로드맵 배지 설명 → 재시작 필요 배너 시연
6. Q&A: ES 검색 서빙, Presidio, 분산 실행 로드맵 설명

---

## 5. 사전 점검 체크리스트 (리허설 전)

- [ ] `docker-compose up -d` — 7서비스 전체 기동 확인
- [ ] `http://localhost:3000/pipeline` — 대시보드 접속 확인
- [ ] `http://localhost:8001/health` — ui-backend 헬스 확인
- [ ] Airflow `http://localhost:8080` — DAG 목록 확인
- [ ] 샘플 문서 5건 준비 (SeaweedFS 업로드용)
- [ ] 설정 페이지 7개 축 표시 확인
- [ ] SSE 이벤트 수신 확인 (`/sse/stages` 연결 후 5초 내 이벤트)
