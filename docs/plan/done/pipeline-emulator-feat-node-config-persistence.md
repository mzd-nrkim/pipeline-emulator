# [FEAT] 노드 설정 저장 + 도구 API 전수조사·기능 리스트업

> 상태: 통테통과-완료

노드 설정 폼(`toolCatalog.configFields`)이 **UI 입력만 있고 저장·적용이 안 된다**(`setNodeConfig` = mock noop). 또한 `configFields`가 **실제 도구 API 근거 없이 손으로 나열**돼 있어, 각 필드가 실제로 무엇을 제어하는지(코드 정의 레벨 vs REST 런타임 레벨) 혼재한다. 도구별 API를 전수조사해 "실제로 설정 가능한 것"을 확정하고, 설정 저장·적용 경로를 만든다.

> 근거(코드 확인, 2026-07-15):
> - `frontend/src/lib/api/mock-adapter.ts` — `setNodeConfig` = noop. `real-adapter.ts` — `POST /nodes/{id}/config` 존재.
> - `ui-backend/app/api/nodes.py:config_node` — 실제로 지원하는 건 **`is_paused` · Airflow `Variable`** 뿐. `configFields`의 대부분(`triggerRule/retries/poolSlots` 등)은 이 엔드포인트가 처리하지 않음.
> - `frontend/src/lib/canvas/toolCatalog.ts` — 도구별 configField 수십 개가 근거 없이 나열(예: Airflow `triggerRule`은 DAG **코드 정의** 값이지 REST 런타임 변경 대상 아님).
> - `ToolCanvasView`/`+page.svelte:228` — UI가 직접 "⚠ 설정 변경은 로컬 상태에만 반영됩니다" 경고 노출 = 미구현 자인.

## 결함
- **C-1 설정 저장 부재**: 폼 입력이 `localConfig` state에만 남고 어디에도 영속화·적용 안 됨.
- **C-2 API 전수조사 부재**: 각 도구가 실제 노출하는 설정 API(엔드포인트·파라미터·런타임 변경 가능 여부)를 조사한 근거 없음. 필드 레벨 혼재(코드정의 vs REST런타임 vs 컨테이너env).

## 목표
- 각 도구별 **"실제로 런타임 설정 가능한 파라미터" 화이트리스트**가 API 근거와 함께 확정된다(전수조사 산출물).
- 설정 폼 변경이 **백엔드를 통해 실제 대상에 적용**되거나(가능 항목), **불가 항목은 명시적으로 read-only 표기**된다(껍데기 경고 제거).

## 접근 방법
1. **도구 API 전수조사(문서 산출)**: 도구별로 (a) 설정 API 존재 여부·엔드포인트, (b) 런타임 변경 가능 파라미터 vs 코드/컨테이너 재기동 필요 파라미터, (c) 이 프로젝트에서 실제 제어 가능한 범위를 표로 정리.
   - 대상: Airflow(REST: Variable/is_paused/DagRun conf) · Debezium(Kafka Connect config API) · NiFi(REST) · Presidio(요청 파라미터) · Docling/KURE(재기동/요청) · Valkey/ES/MySQL(연결·인덱스 설정) · DAM(외부 API).
2. **configField 재분류**: 각 필드에 `applyMode: 'runtime' | 'restart' | 'code' | 'readonly'` 메타 부여 → UI가 적용 가능 여부를 시각 구분.
3. **저장 경로 구현(runtime 항목 우선)**: `setNodeConfig` 실동작화. 최소 Airflow Variable/conf부터 실제 적용, 확장은 도구별 단계.
4. **껍데기 경고 교체**: "로컬만 반영" 일괄 경고 → 필드별 `applyMode` 배지로 대체.

## 실행 시 필수 고려사항

- **회귀 범위**: `ConfigField`에 `applyMode` 추가는 **타입 변경**이라 `toolCatalog.ts`의 모든 configField 엔트리·이를 소비하는 UI(`ToolCanvasView.svelte`, `+page.svelte` 설정 폼)에 파급된다. optional 필드로 도입해 기존 엔트리 미태깅 시 안전 기본값(`readonly`)을 갖게 하면 회귀 표면을 좁힐 수 있다. `setNodeConfig` 실동작화는 mock noop → 실호출 전환이므로 **mock 모드 경로(mock-adapter)는 noop 유지**해 sample/mock 화면 회귀 없음.
- **환경 전제**: runtime 항목 실적용·read-back 검증은 **ui-backend + Airflow 기동** 전제(`config_node`가 Airflow Variable/is_paused 호출) → Z-post에서만 유효. `frontend/node_modules`는 gitignored → `npm run check`/e2e는 머지 후 원본 main.
- **A-1 조사 산출물 위치**: 도구 API 전수조사표는 **계획 산출물(docs)** — `plans/`가 아닌 `docs/`(조사결과) 라우팅. B-2 태깅의 근거이므로 A-1 완료 전 B는 착수 불가(A→B 순차 의존).
- **실행 순서·병렬성**: A(조사) → B(`toolCatalog.ts` 타입·태깅) → {C(저장 경로 `real-adapter.ts`+`nodes.py`), D(UI 배지)} 순. B-1(타입 추가)은 B-2·D의 선행. C와 D는 다른 파일군이라 B 이후 병렬 가능. B-1·B-2·D-1은 `toolCatalog.ts`/svelte에 걸쳐 있어 configField 정의는 B에 몰고 UI는 D로 분리.
- **미선택 결정 근거**: "어느 도구까지 실 적용"은 **실물 API 확인 후 결정** — Airflow REST(Variable/is_paused/DagRun conf)가 유일하게 이 프로젝트에서 검증된 런타임 경로라 **Airflow 우선**, 나머지(Debezium/NiFi 등)는 조사표상 runtime 가능해도 단계적 확장(범위 밖 가능). restart 필요 항목의 재기동 트리거 UX는 후속 계획.
- **껍데기 경고 미조기제거 주의**: "로컬만 반영" 경고(`+page.svelte:228`)는 C(실저장)가 동작하기 전까지 제거하면 사용자가 미적용을 미인지 → **D(경고 교체)는 C 완료 후**. readonly/restart 필드는 여전히 인라인 경고 유지.

## 작업 목록

### A. 도구 API 전수조사 (산출: docs/)

- [x] A-1. 도구별 설정 API 조사표 작성 (엔드포인트·런타임가능·근거 링크) — **실물 API 확인 후 작성** (path: docs/ 조사 산출물, 앵커: 신규 조사표 문서, 의도: "실제 런타임 설정 가능" 화이트리스트 근거화)
  - [x] Airflow(REST: Variable/is_paused/DagRun conf) API·런타임 가능 파라미터 정리 (path: docs/ 조사표)
  - [x] Debezium(Kafka Connect config)·NiFi(REST)·Presidio(요청 파라미터) 정리 (path: docs/ 조사표)
  - [x] Docling/KURE(재기동/요청)·Valkey/ES/MySQL(연결·인덱스)·DAM(외부 API) 정리 (path: docs/ 조사표)
- [x] A-2. 현 `configFields` 각 항목을 `runtime/restart/code/readonly`로 분류 (path: docs/ 조사표에 매핑 열, 앵커: configField ↔ applyMode 대응, 의도: B-2 태깅 근거)

### B. 스키마·카탈로그 정합

- [x] B-1. `ConfigField`에 `applyMode: 'runtime'|'restart'|'code'|'readonly'` optional 필드 추가 (path: frontend/src/lib/canvas/toolCatalog.ts, 앵커: `ConfigField` 타입 정의, 의도: 기본값 readonly로 회귀 표면 축소)
- [x] B-2. 조사 결과로 각 configField `applyMode` 태깅 + 근거 없는 필드 제거/보정 (path: frontend/src/lib/canvas/toolCatalog.ts, 앵커: toolCatalog configFields 배열, 의도: A-1 조사표와 1:1 정합)

### C. 저장·적용 경로

- [x] C-1. `setNodeConfig` 실구현 — runtime 항목 백엔드 반영 (path: frontend/src/lib/api/real-adapter.ts + ui-backend/app/api/nodes.py, 앵커: real-adapter `setNodeConfig`·`config_node`, 의도: mock noop → 실 POST 적용)
  - [x] `real-adapter.setNodeConfig`가 `POST /nodes/{id}/config` 호출하도록 구현 (path: frontend/src/lib/api/real-adapter.ts, 앵커: `setNodeConfig`)
  - [x] `config_node`가 runtime 항목(Airflow Variable/conf 우선) 실제 적용하도록 확장 (path: ui-backend/app/api/nodes.py, 앵커: `config_node`)
  - [x] `mock-adapter.setNodeConfig`는 noop 유지(회귀 방지) 확인 (path: frontend/src/lib/api/mock-adapter.ts, 앵커: `setNodeConfig`)
- [x] C-2. 적용 결과 read-back·에러 표시 (path: frontend/src/routes/.../+page.svelte, 앵커: 설정 폼 저장 핸들러, 의도: set→get 일치·실패 시 에러 노출)

### D. UI

- [x] D-1. 필드별 `applyMode` 배지 도입 + "로컬만 반영" 일괄 경고 제거 (**C 완료 후**) (path: frontend/src/lib/components/ToolCanvasView.svelte 및 +page.svelte:200-234, 앵커: 설정 폼 필드 렌더·228 경고, 의도: 미적용 오인 방지 후 배지로 교체)
- [x] D-2. readonly/restart 항목은 입력 비활성 or 경고 인라인 (path: 설정 폼, 앵커: 필드별 렌더 분기, 의도: 적용 불가 필드 시각 구분)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (워크트리/정적)

- [x] ui-backend `nodes.py` 변경분 `python -m py_compile` 정적 통과
- [x] `mock-adapter.setNodeConfig` noop 잔존(회귀 방지) grep 확인
- (Node 정적 게이트: frontend `npm run check`/`build`는 Z-pre 제외 → 머지 후 원본 main)

#### Z-post. push 후 (앱 기동 환경)

- [x] 머지 직후 원본 main에서 frontend `npm run check` + `npm run build` 통과 (Node 정적 게이트)
- [x] e2e: 설정 저장 → read-back 시나리오(가능 항목 1개 이상, 예: Airflow Variable set→get 일치) — ui-backend+Airflow 기동 전제
  - [x] `node-config.spec.ts`(또는 기존 e2e에 config 케이스) 신규 작성 — runtime 필드 저장→read-back 단언 (미존재 시 필수)
    - teardown: 테스트가 set 한 Airflow Variable/config를 원값 복원 또는 삭제(`airflow variables delete` 상당)

## TC (Right-BICEP · CORRECT)

- [x] **Right (정상)**: runtime 항목 변경 → 저장 → 백엔드 반영 확인(예: Airflow Variable set → get 일치).
- [x] **B (경계)**: 빈 config·미지원 도구 → 크래시 없이 "설정 없음/readonly".
- [x] **I (역/교차검증)**: 각 configField가 조사표의 실제 API 파라미터와 대응(수기 대조); set→get read-back 값 일치(역연산).
- [x] **C (에러)**: 백엔드 미기동/거부(4xx/5xx) → UI 에러 표시(무한 로딩·조용한 실패 아님).
- **P (성능)**: 단건 config POST — 성능 이슈 없음 → "해당 없음".
- CORRECT-Conformance: `applyMode` 값이 4종(`runtime/restart/code/readonly`) enum 밖이면 타입 에러로 차단.
- CORRECT-Existence: readonly/code 필드에 저장 시도 → 백엔드 호출 없이 UI에서 차단(무의미 POST 방지).
- CORRECT-Reference: 저장 후 다른 노드 선택 → 원노드 재선택 시 적용값 유지(로컬 state 오염 없음).
- Ordering: 설정 필드 간 적용 순서 의존 없음 → "해당 없음".

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 어느 도구까지 실 적용할지 | plan-review | Airflow 우선, 나머지 단계 |
| restart 필요 항목의 UX(재기동 트리거?) | 후속 | 범위 밖 가능 |
