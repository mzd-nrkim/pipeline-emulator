# 파이프라인 에뮬레이터 — 데모 시나리오

## 1. 시연 흐름 개요

캔버스(Canvas) 도구 노드 DAG에서 노드를 트리거하면 `run_id`가 발급되고, drill-down 패널에서 그 run의 medallion 증거(카운트·PII diff)를 즉시 확인합니다.

```
[Canvas]
rdb-source ─┐
            ├──→ masking-task ──→ doc-type-switch ──→ chunking-task ──→ es-sink
s3-source  ─┘   (DAG 트리거)                                     └──→ s3-sink
                      │
                [drill-down 패널]
                run_id 발급 + medallion 증거
                (입출력 문서 수 · PII 카운트 · 마스킹 전후 비교)
```

---

## 2. 단계별 시연 흐름 (T4-1)

### Step 0. 대시보드 초기 화면

1. 브라우저에서 `/sample/pipeline`을 열면 **캔버스(Canvas) 뷰**가 기본 표시됩니다.
2. 도구 노드 DAG: rdb-source, s3-source, masking-task, doc-type-switch, chunking-task, es-sink, s3-sink, raw-sink.
3. 상단 "활성 실행" 패널에 `RUN_ID: RX-9042-ALPHA` (초기 상태) 표시.
4. 우측에 "실행 이력" 사이드 패널이 최근 run 목록을 표시합니다.

### Step 1. masking-task 노드 클릭 → drill-down 패널

**시연자 행동**: 캔버스에서 `masking-task` 노드(초록색·[task])를 클릭합니다.

**대시보드 확인 내용**:
- 우측에 **노드 상세** drill-down 패널이 열립니다.
- `id: masking-task`, `tool: pii_masker`, `config.dagId: silver_2_masking` 표시.
- "트리거" 버튼과 **medallion 증거** 섹션이 보입니다.
- 아직 트리거 전이므로 medallion 수치는 이전 스냅샷 상태.

### Step 2. DAG 트리거 → run_id 발급

**시연자 행동**: drill-down 패널의 **트리거** 버튼을 클릭합니다.

**대시보드 확인 내용**:
- `dag_run_id`가 패널에 즉시 표시됩니다 (예: `scheduled__2026-07-15T00:00:00+00:00`).
- 상단 "활성 실행" 패널의 `RUN_ID`가 이 `dag_run_id`로 갱신됩니다.
- `StatusDot`이 `completed` 색상으로 전환됩니다.

### Step 3. Medallion 증거 확인

**시연자 행동**: 트리거 직후 drill-down 패널 하단의 **medallion 증거** 섹션을 확인합니다.

**대시보드 확인 내용**:
- `medallion 증거 · {run_id}` 제목과 함께 **입력 문서** / **출력 문서** 카운트 표시.
- **마스킹 방식**: `REGEX_PATTERN`
- **감지된 PII 유형**: 전화번호·주민번호·이메일·계좌번호 (실처리), 이름·주소 (예정).
- **샘플 변환** 비교: 원문 `010-1234-5678 → 010****1234` 마스킹 전후 표시.
- "죽은 참고 그림"이 아닌 **이 run의 증거**임을 강조.

### Step 4. chunking-task 노드 → 트리거 → 증거 확인

**시연자 행동**: 캔버스에서 `chunking-task` 노드를 클릭, 트리거합니다.

**대시보드 확인 내용**:
- `dag_run_id: gold_3_chunking__*` 발급.
- 활성 RUN_ID가 chunking run으로 갱신.
- drill-down 패널에 chunking 노드 config(chunkSize, overlap, strategy) 표시.

### Step 5. mock 노드 — 상태 표시 전용 배지

**시연자 행동**: `es-sink` 또는 `raw-sink` 노드를 클릭합니다.

**대시보드 확인 내용**:
- drill-down 패널에 **"상태 조회 전용 · 실동작은 F2/F3/F7"** 배지가 표시됩니다.
- 트리거 버튼 없음 — ES/NiFi 등 미구현 도구 노드의 계약만 선점한 상태임을 시각적으로 안내.

### Step 6. 실행 이력 패널

**시연자 행동**: 우측 "실행 이력" 사이드 패널의 항목을 클릭합니다.

**대시보드 확인 내용**:
- 최근 DAG run 목록이 최신순으로 정렬됩니다.
- 각 행에서 `실행 ID`, `시작 시각`, `소요 시간`, `결과(성공/실패)` 확인 가능.

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

**Week 3 아키텍처 (7서비스 + 캔버스)**:
```
SeaweedFS (파일 저장소)
    ↓
MySQL (파이프라인 데이터: Bronze/Silver/Gold 테이블)
    ↓
Airflow (6개 DAG: bronze_0 ~ gold_5)
    ↓
ui-backend (FastAPI: /stages, /runs, /sse/stages, /config, /nodes/{id}/trigger)
    ↓
ui (SvelteKit: Canvas DAG 뷰 + drill-down medallion 증거)

postgres (모니터링 앱 상태 — 별도 서비스 DB)
```

**DB 분리 원칙**: 파이프라인 데이터(MySQL) ↔ 모니터링 앱 상태(postgres) 분리

### Week 3 주요 성과

1. **n8n형 캔버스 DAG**: 도구 노드(source·task·switch·sink) 기반 파이프라인 시각화
2. **실동작 트리거**: 캔버스 노드에서 Airflow DAG 직접 트리거 → run_id 즉시 발급
3. **Medallion 증거 연결**: 트리거 run_id에 바인딩된 PII 카운트·마스킹 전후 비교를 drill-down 패널에서 즉시 확인 ("죽은 참고 그림" → "이 run의 증거")
4. **계약층 고정**: mock/real 어댑터 스왑, F2/F3/F7 미구현 노드 상태 표시 선점

### 흐름 다이어그램 설명

시연 시 다음 순서로 진행:
1. 캔버스 초기 화면 → 도구 노드 DAG 구조 설명
2. masking-task 클릭 → drill-down 패널 → 트리거 → run_id 발급
3. medallion 증거 확인 (PII 카운트·마스킹 전후 비교)
4. chunking-task 트리거 → run_id 갱신 흐름 반복
5. mock 노드(es-sink) → 상태 조회 전용 배지 설명
6. 설정 페이지 → 로드맵 배지 설명 → 재시작 필요 배너 시연
7. Q&A: ES 검색 서빙, Presidio, 분산 실행 로드맵 설명

---

## 5. 사전 점검 체크리스트 (리허설 전)

- [ ] `docker-compose up -d` — 7서비스 전체 기동 확인
- [ ] `http://localhost:3000/sample/pipeline` — 캔버스 뷰 접속 확인
- [ ] `http://localhost:8001/health` — ui-backend 헬스 확인
- [ ] Airflow `http://localhost:8080` — DAG 목록 확인 (`silver_2_masking`, `gold_3_chunking` 포함)
- [ ] masking-task 트리거 → run_id 발급 확인
- [ ] drill-down 패널 medallion 증거 렌더 확인 (PII 카운트, 마스킹 전후)
- [ ] 실행 이력 패널 항목 표시 확인
- [ ] SSE 이벤트 수신 확인 (`/sse/stages` 연결 후 5초 내 이벤트)
