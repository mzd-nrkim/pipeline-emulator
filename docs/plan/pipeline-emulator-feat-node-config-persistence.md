# [FEAT] 노드 설정 저장 + 도구 API 전수조사·기능 리스트업

> 상태: 초안

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

## 작업 목록

### A. 도구 API 전수조사 (산출: docs/)
- [ ] A-1. 도구별 설정 API 조사표 작성 (엔드포인트·런타임가능·근거 링크) — Airflow/Debezium/NiFi/Presidio/Docling/KURE/Valkey/ES/MySQL/DAM
- [ ] A-2. 현 `configFields` 각 항목을 `runtime/restart/code/readonly`로 분류

### B. 스키마·카탈로그 정합
- [ ] B-1. `ConfigField`에 `applyMode` 필드 추가 (path: frontend/src/lib/canvas/toolCatalog.ts 타입)
- [ ] B-2. 조사 결과로 각 configField `applyMode` 태깅 + 근거 없는 필드 제거/보정

### C. 저장·적용 경로
- [ ] C-1. `setNodeConfig` 실구현 — runtime 항목 백엔드 반영 (path: real-adapter.ts + ui-backend/app/api/nodes.py)
- [ ] C-2. 적용 결과 read-back·에러 표시 (path: +page.svelte 설정 폼)

### D. UI
- [ ] D-1. 필드별 `applyMode` 배지, "로컬만 반영" 일괄 경고 제거 (path: ToolCanvasView.svelte / +page.svelte:200-234)
- [ ] D-2. readonly/restart 항목은 입력 비활성 or 경고 인라인

### Z. 게이트
- [ ] Z-pre. `npm run check` 통과
- [ ] Z-post. e2e: 설정 저장 → read-back 시나리오(가능 항목 1개 이상)

## Verification (Right-BICEP)
- [ ] **Right**: runtime 항목 변경 → 저장 → 백엔드 반영 확인(예: Airflow Variable set → get 일치).
- [ ] **B**: 빈 config·미지원 도구 → 크래시 없이 "설정 없음/readonly".
- [ ] **Cross-check**: 각 configField가 조사표의 실제 API 파라미터와 대응(수기 대조).
- [ ] **Error**: 백엔드 미기동/거부 → UI 에러 표시.

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 어느 도구까지 실 적용할지 | plan-review | Airflow 우선, 나머지 단계 |
| restart 필요 항목의 UX(재기동 트리거?) | 후속 | 범위 밖 가능 |
