# 파이프라인 캔버스 — 도구 오케스트레이션 정체성 확립 + 단일소스·2뷰 재설계

`/sample/pipeline` 샘플 토폴로지 검증에서 노드의 역할·의미·배치·매핑 결함이 다수 확인됐다. 논의 결과 이 제품의 정체성을 **n8n식 도구 오케스트레이션 캔버스**(도구선택 + 노드연결 + 조건부여 + 설정)로 정립하고, 노드 = "dockerized 프로그램", 엣지 = "뷰별 관계"로 재정의한다. 기존 결함의 상당수는 **데이터 계보(medallion) 렌즈**로 본 오판이었고, 실제로는 **하나의 캐노니컬 모델에서 데이터흐름 뷰 / 인프라연결 뷰 2가지로 투영**하면 자연스럽게 해소된다. 출시는 데이터흐름 뷰 first, 인프라 뷰 fast-follow.

> 근거: 샘플 토폴로지 데이터 검증·설계 논의 세션(2026-07-15). `topology.ts` · `buildNodesAndEdges.ts` · `ToolCanvasView.svelte` 정독.
> 관련: [pipeline-emulator-refactor-tool-orchestrator-canvas.md](./pipeline-emulator-refactor-tool-orchestrator-canvas.md) · [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md) · [pipeline-emulator-feat-dag-graph-toggle.md](./pipeline-emulator-feat-dag-graph-toggle.md)

---

## 목표

- 캔버스가 **도구 오케스트레이션 도구**(노드=프로그램, 엣지=관계, config=1급 기능)로 정체성이 확립된다.
- **단일 캐노니컬 topology 모델**에서 **데이터흐름 뷰 / 인프라연결 뷰** 2가지로 투영이 가능해진다(뷰 토글).
- 데이터흐름 뷰에서 **모든 엣지가 좌→우 단방향**으로 흐르고(지그재그 소멸), 노드가 **trigger/action/switch**로 분류되며, **Switch가 실제로 다중 분기**한다.
- 검증에서 나온 배치 결함(D1)·무분기 스위치(D5)·오케스트레이터 중복(D6)이 해결되고, source/sink 오분류(D2·D3)와 Kibana 오연결(D4)은 **뷰 분리로 자연 해소**된다.
- 각 노드의 **설정(config) 편집 폼**(도구 API param / 컨테이너 config)이 드릴다운에서 1급 기능으로 제공된다(기존 씨앗 확장).

## 접근 방법

1. **캐노니컬 모델 재설계 (단일 `kind` 폐기 → 직교 facet + 타입 엣지)**
   - 노드: `kind` 스칼라 대신 `role`(`ingest|transform|route|store|index|broker|visualize`) + `trigger?:boolean` facet. 도구 카테고리·벤더·아이콘은 `toolCatalog`에서 유도.
   - 엣지: `channels: ('data'|'dependency')[]` 태깅 + `condition?`(switch 분기 라벨). 하나의 엣지가 데이터흐름·인프라의존 중 어느 뷰에 나타날지 결정.
   - 이로써 "데이터흐름 그래프"와 "인프라 의존 그래프"라는 **겹치되 다른 두 그래프**를 한 소스에 담는다.

2. **뷰 투영 함수 (`buildNodesAndEdges(topo, view)`)**
   - `view` 채널로 엣지 필터 → 가시 부분그래프만 남김.
   - 가시 엣지셋 기준 **위상정렬 rank로 X좌표 산출**(뷰마다 레이아웃이 정확). Y는 rank 내 순번.
   - 뷰별 색상: 데이터흐름 = `role`/`trigger` 기준, 인프라 = 도구 카테고리 기준.
   - 해당 뷰에서 연결이 없는 **고아 노드는 숨김**(예: Kibana는 데이터뷰에서 미표시).

3. **레이아웃 위상화 (D1 근본 해소)**
   - `KIND_X` 고정 좌표 폐기 → 엣지 기반 위상정렬(소스로부터 최장경로 depth × 열간격). 사이클/고아 방어 fallback.

4. **topology.ts 데이터 재저작 (데이터흐름 채널 우선)**
   - **D5**: `수집유형 분기`(switch)를 실제 다중 출력으로 만들거나, 후속 분기 경로가 없으면 제거하고 `s3-bronze→airflow` 직결.
   - **D4**: `valkey→kibana` 데이터 엣지 제거. Kibana는 `es→kibana`를 **`dependency` 채널로만** 태깅(데이터뷰 미표시, 인프라뷰 표시).
   - **D6**: Airflow 노드는 데이터뷰에서 오케스트레이터=캔버스 자신과 중복 → trigger 성격으로 재정의하거나 데이터뷰에서 숨김(택1은 plan-review에서 확정).
   - **D3**: Debezium/NiFi는 데이터뷰에서 **trigger 노드로 정상**(MySQL은 그 노드의 config). 진짜 RDB origin은 **인프라뷰의 컨테이너 노드**로만 `dependency` 태깅(fast-follow).

5. **뷰 토글 UI**
   - `[mode=mode]/pipeline/+page.svelte`(또는 `ToolCanvasView`)에 뷰 셀렉터 추가. 데이터흐름 뷰 default, 인프라 뷰는 스텁(스키마는 지원, 렌더는 fast-follow). 기존 `[mode=mode]` 라우팅과 정합.

6. **설정(config) 1급화**
   - `toolCatalog.configFields` 확장, 드릴다운 편집 폼(이미 존재) 유지·강화. 실 API 연동은 별도 F-계획(F2/F3/F7 등) 범위 — 여기서는 config 조정 UI까지.

7. **도구 팔레트(도구선택)는 범위 경계**
   - 카탈로그에서 노드 추가/삭제하는 팔레트는 이번 스코프 밖(열린 항목). 이번엔 기존 노드의 정합·2뷰·설정에 집중.

> **결함↔해소 매핑 요약** (검증 세션 D1~D7):
> - 그대로 유효: **D1**(레이아웃 위상화) · **D5**(Switch 다중분기) · **D6**(Airflow 중복)
> - 뷰 분리로 해소: **D2**(S3 Bronze는 `role:store`, 분류 비문제) · **D3**(Debezium=데이터뷰 trigger / MySQL origin=인프라뷰 컨테이너) · **D4**(Kibana=인프라뷰 전용)
> - 낮은 우선순위: **D7**(config 값 정합 — `ssn`→`rrn` 등)

## 작업 목록

> 현재 파악 수준의 상위 체크박스 — `/plan-review`로 원자 단위 2레벨 상세화 예정.

- [ ] `api/types.ts`: `ToolNode.kind` 스칼라 → `role` + `trigger` facet, `Edge.channels`/`condition` 추가 (타입 유니온 정의)
- [ ] `buildNodesAndEdges.ts`: `view` 파라미터화 + 채널 필터 + 위상정렬 X좌표 + 뷰별 색상 매핑 (`KIND_X` 제거, `KIND_STYLE`→role/category)
- [ ] `topology.ts` 재저작: switch 다중분기 or 제거(D5), kibana `es→kibana` dependency 채널(D4), airflow 데이터뷰 처리(D6), 각 엣지 `channels` 태깅
- [ ] 뷰 토글 UI: 데이터흐름 default 셀렉터 (`+page.svelte`/`ToolCanvasView.svelte`)
- [ ] 드릴다운 config 편집·Airflow 트리거 회귀 확인 (설정 1급화 기존 기능 보존)
- [ ] (fast-follow) 인프라뷰 `dependency` 엣지 + 컨테이너 노드(MySQL origin·broker 등) 저작 + 인프라뷰 렌더
- [ ] (D7, 선택) config 값 정합: Presidio `ssn`→`rrn`, Debezium `walMode` 키명, DAM 형식 주석
- [ ] Verification 수행

## Verification

- [ ] **데이터흐름 뷰**: `/sample/pipeline`에서 모든 엣지가 좌→우 순방향(역방향 화살표 0개), S3 Bronze가 소스~airflow 사이 열에 위치, 지그재그 소멸.
- [ ] **Switch**: 다중 출력으로 분기(또는 제거되어 단일출력 switch가 남지 않음).
- [ ] **Kibana**: 데이터흐름 뷰에서 미표시(Valkey→Kibana 엣지 없음).
- [ ] **뷰 토글**: 데이터흐름↔인프라 전환 동작. 인프라 뷰(fast-follow) 활성 시 `es→kibana`·MySQL origin 컨테이너 등장.
- [ ] **타입/빌드**: `svelte-check`(또는 `pnpm check`) 통과, 브라우저 콘솔 에러 0.
- [ ] **회귀 없음**: 노드 클릭 드릴다운, config 편집 폼, Airflow 트리거 버튼 정상.
- [ ] **결함 해소 확인**: D1·D5·D6 수정 반영, D2·D3·D4가 뷰 분리로 사라졌는지 육안 확인.

## 열린 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 엣지 채널을 "설정에서 뷰 선택" 방식으로 노출 | 확정(2뷰 토글) | 사용자 요청 = 두 옵션 제공·전환. 데이터뷰 default |
| Airflow 노드: 데이터뷰에서 숨김 vs trigger로 재정의 | plan-review에서 확정 | 캔버스=오케스트레이터 전제 |
| Switch: 실제 3분기(B1) vs 제거(B2) | 후속 처리 경로 유무에 따름 | 억지 분기 지양 |
| 도구 팔레트(노드 추가/삭제 = 도구선택 UI) | 범위 밖 | 별도 계획 |
| 실 도구 API 연동(설정 기능의 "API 사용") | 범위 밖 | F2/F3/F7 등 기존 F-계획 |
| `role`/facet 유니온 최종 셋 | Phase 1 착수 시 확정 | 최소 셋 우선 |

## 참고 (파일 위치)

- 토폴로지 데이터: `frontend/src/lib/mock/topology.ts`
- 레이아웃 변환: `frontend/src/lib/canvas/buildNodesAndEdges.ts`
- 렌더 컴포넌트: `frontend/src/lib/components/ToolCanvasView.svelte`
- 타입: `frontend/src/lib/api/types.ts`
- 도구 카탈로그: `frontend/src/lib/canvas/toolCatalog.ts`
- 라우트/모드: `frontend/src/routes/[mode=mode]/pipeline/+page.svelte` · `+page.ts`
