# pipeline-emulator — n8n형 도구 오케스트레이션 캔버스로 구조 전환

현재 PipeScale는 Bronze→Silver→Gold medallion 단계를 읽기전용으로 시각화하는 **관찰(observability) 데모**다. 팀장 피드백은 이것을 n8n처럼 **인프라 도구(NiFi/Debezium/Airflow/ES)를 REST API로 간접 조종하는 시뮬레이터**로 보이게 하는 것이다. 즉 화면의 주인공을 "데이터 계층"에서 "도구 제어면"으로 옮기고, 기존 medallion 흐름은 도구 실행 결과를 보여주는 **부가 관찰 뷰**로 강등한다.

> 근거 대화: 노드=도구(데이터 계층 아님), 캔버스=도구 API 감싸는 제어면, medallion=부가뷰(run_id 연결), 노드 카탈로그=Source/Task/Switch/Sink, 캔버스=단일 backbone 못박지 않는 일반 DAG(fan-in/out/branch), 입도=도구 노드(굵게)+클릭 시 내부 DAG/프로세서 부가뷰 2계층.

---

## 목표

- 메인 화면이 **도구 노드 캔버스**가 된다 — 각 노드가 NiFi/Debezium/Airflow/ES의 제어 API를 감싸고, 노드에서 config·트리거·조건을 조작하면 로컬 스택이 실제로 움직인다(시늉 아님).
- 기존 medallion(Bronze~Serving) 뷰가 **부가 관찰 뷰**로 강등되고, 캔버스 실행과 **`run_id`로 연결**되어 "방금 돌린 것의 결과"로 살아있다.
- 노드 카탈로그가 **Source·Task·Switch·Sink** 4종으로 정의되고, Source는 소스 이질성(RDB 스키마매핑 / S3 포맷검출 / 비정형 OCR)을 자기 안에 가두는 **다형(polymorphic) 어댑터**로 동작한다.
- 캔버스가 단일 backbone에 고정되지 않고 **fan-in·fan-out·branch를 모두 지원하는 일반 DAG**로 표현된다(목적지가 여럿이면 backbone도 여럿).
- 노드 입도가 **2계층**이다 — 캔버스엔 도구 노드가 굵게, 클릭하면 그 도구 내부(Airflow DAG 6개·NiFi 프로세서 등)가 부가뷰에서 펼쳐진다.

## 접근 방법

### A. 스코프 갈림길 먼저 확정 (선행 결정)

착수 전 팀장과 **"n8n처럼 보이게(A) vs n8n처럼 동작하게(B)"**를 못박는다 — 스코프가 10배 갈린다.

- **A. 룩앤필 + 제한 조작(권장)**: 노드/배선/조건 UI는 n8n 감성이되, 토폴로지는 미리 정의된 것을 로드해 사용자는 **config 토글·조건 분기·트리거**만 조작. 대부분 프론트 + 기존 REST 감싸기로 달성, 2주 MVP 정신과 양립.
- **B. 완전 저작(대형)**: 사용자가 노드를 드래그·배선·저장해 DAG를 조립 → Airflow DAG 동적 생성/직렬화 백엔드 필요. 데모 아티팩트 범위를 크게 초과.

> 이 계획서 작업 목록은 **A 전제**로 작성한다. B로 확정되면 별도 계획으로 분리한다.

### B. 노드 = 도구 어댑터 (API 감싸기)

각 도구 노드가 해당 제어 API를 감싸는 어댑터를 갖는다. 이미 `ui-backend/app/services/airflow.py`(Airflow REST)·`mysql_aggregator.py`가 있어 확장 기반이 있다.

| 도구 노드 | 감싸는 API | 조작(A 범위) |
|-----------|-----------|--------------|
| Airflow | Airflow REST (`/dags/*/dagRuns`, Variables) | DAG 트리거, 변수(masking on/off 등) 설정, pause |
| NiFi | NiFi REST (프로세서 그룹) | start/stop, 프로퍼티 조회 *(에뮬레이터는 Python 수집 스크립트 → mock 반응 or 스크립트 트리거)* |
| Debezium | Kafka Connect REST | 커넥터 상태 조회 *(MVP는 배치 수집 → 상태 표시 위주)* |
| Elasticsearch | ES REST (인덱스/검색) | 인덱스·검색 설정 *(검색 서빙 축, 데모 확장)* |

> 원본↔에뮬레이터 대체(NiFi→Python, Debezium→배치, ES→미구현)를 감안해, 감싸는 대상이 로컬에 없는 노드는 **상태 표시 + 계약만 선점**하고 실동작은 해당 기능 축(f2/f3/f7) 도입 시 연결한다.

### C. 노드 카탈로그 4종 정의

- **Source (polymorphic 어댑터)**: 소스별 추출·파싱을 자기 안에 가두고 **표준 문서 봉투(canonical envelope)**로 내놓는다. 변형 지점은 ①추출 방식(CDC/batch/파일), ②파싱(컬럼→필드 / 포맷검출→파서 / OCR→텍스트), ③봉투 변환 셋뿐. OCR은 새 파이프라인이 아니라 이미지 Source 노드 안의 파싱 스텝.
- **Task**: 공통 처리 노드(구조화·마스킹·청킹·엔리치). 기존 DAG 단계가 여기 매핑.
- **Switch**: 조건 분기(`doc_type`·config 기반). 팀장이 원한 "조건문 조작" 부가기능의 실체. 소스 이질성 중 봉투로 못 합친 잔여 발산을 흡수.
- **Sink**: 출구 추상화(S3 / 고객 DB / ES). 저장 방식이 소스·목적별로 달라도 backbone은 불변, Sink 노드만 교체.

### D. 캔버스 토폴로지 = 일반 DAG

단일 척추를 전제하지 않는다. **fan-in(여러 Source→표준 봉투 합류) + fan-out(여러 Sink/목적지) + branch(Switch)**를 모두 표현. 수렴은 "목적지가 문서 코퍼스 하나"일 때의 특수해일 뿐 일반 법칙이 아님을 데이터 모델에 반영한다. `@xyflow/svelte`는 임의 분기·병합을 이미 지원.

### E. medallion 부가뷰 강등 + run_id 연결

기존 Bronze~Serving 그리드/레이어 그래프를 **별도 탭이 아니라** 도구 노드 클릭 시 펼쳐지는 drill-down/부가 패널로 재배치. 캔버스 실행(`Run`)의 `run_id`를 medallion 카운트·PII diff에 바인딩해, 부가뷰가 "죽은 참고 그림"이 아니라 "이 run의 증거"가 되게 한다. 기존 `Run.stageCounts`·`Stage.docsIn/Out` 계약 재사용.

### F. 타입 계약 확장

`frontend/src/lib/api/types.ts`에 노드 그래프 계약을 추가한다(기존 `Stage`/`Run`/`Dimension`은 부가뷰용으로 유지). 신규: `ToolNode`(kind: source|task|switch|sink, tool, config), `Edge`(from/to/condition?), `CanvasTopology`(nodes/edges), `SourceKind`(rdb|s3|unstructured). mock-adapter에 샘플 토폴로지 선(先)제공 → real-adapter는 ui-backend 연동 시 채움.

## 작업 목록

> /plan-review로 원자 단위 2레벨 체크리스트로 상세화 예정. 아래는 현재 파악 수준.

- [ ] **선행**: A/B 스코프 팀장 확정 (본 계획은 A 전제) — 확정 결과 계획서 반영
- [ ] 노드 카탈로그 4종(Source/Task/Switch/Sink) 개념·config 스키마 확정 문서화 (`docs/`)
- [ ] `types.ts` 노드 그래프 계약 추가 (`ToolNode`/`Edge`/`CanvasTopology`/`SourceKind`)
- [ ] mock-adapter에 샘플 캔버스 토폴로지 데이터 추가 (fan-in/branch/fan-out 각 1케이스 포함)
- [ ] 캔버스 컴포넌트: 기존 `PipelineGraphView.svelte`를 도구 노드 캔버스로 전환/신설 (도구 노드 렌더 + Source/Switch/Sink 노드 타입 시각 구분)
- [ ] 노드 클릭 → 부가 drill-down 패널 (도구 내부 DAG/프로세서 + medallion 카운트·PII diff, run_id 바인딩)
- [ ] medallion(Bronze~Serving) 기존 뷰를 부가 패널로 재배치 (별도 탭 제거)
- [ ] Switch 노드 조건 조작 UI (config/doc_type 기반 분기 표현 — A 범위: 표시·토글)
- [ ] 도구 어댑터 계층: `ui-backend`에 노드→도구 API 매핑 (Airflow REST 우선, NiFi/Debezium/ES는 상태·계약 선점)
- [ ] 캔버스 실행 트리거 → `run_id` 발급 → 부가뷰 결과 연결 배선
- [ ] 데모 시나리오 문서(`demo-scenario.md`) 갱신 — 새 캔버스 기준 시연 흐름

## Verification

- **스코프 게이트**: 팀장이 A/B 중 하나로 확정했고, 계획이 그 전제와 일치한다.
- **캔버스 렌더**: `/[mode]/pipeline`(또는 신 경로)에서 도구 노드 캔버스가 뜨고 Source/Task/Switch/Sink 4종이 시각적으로 구분된다. 샘플 토폴로지에 fan-in·branch·fan-out이 각 1개 이상 보인다.
- **간접 조종(A/실동작)**: Airflow 노드에서 트리거·변수 설정 시 실제 Airflow REST 호출이 나가고(`ui-backend` 로그로 확인), DAG 실행이 발생한다. mock 대상 노드(NiFi/Debezium)는 상태 표시가 계약대로 렌더된다.
- **run_id 연결**: 캔버스에서 실행하면 부가 medallion 뷰의 카운트·PII diff가 그 `run_id` 결과로 갱신된다(정적 그림 아님).
- **부가뷰 강등**: medallion이 독립 탭이 아니라 노드 drill-down 패널로만 접근된다.
- **타입/정적**: `types.ts` 신규 계약이 `svelte-check`/tsc 통과, mock-adapter 샘플이 계약을 만족한다.
- **노드 입도 2계층**: 도구 노드 클릭 시 그 도구 내부(Airflow=DAG 6개 등)가 부가뷰에서 펼쳐진다.
