# [PLAN·단기] 컨트롤/실행 플레인 분리 + 데이터 레지던시 경계 확립

> 상태: 초안 (실행 가능 — 단, 아래 "선행 의존" 충족 후 착수 권장)

"서비스는 서버 / 실행은 로컬 docker" 구조로 가려면 **컨트롤 플레인(UI·오케스트레이션)**과 **실행 플레인(로컬 docker)**을 명시적으로 분리해야 한다. 서버는 사용자 PC의 docker에 인바운드로 손을 뻗을 수 없으므로(NAT·방화벽), 로컬에서 아웃바운드로 붙는 **로컬 에이전트**가 필요하다. 다행히 현재 `ui-backend`가 이미 로컬 Airflow REST를 프록시하므로 **에이전트 원형이 이미 존재**한다 — 이 단기 계획은 그 구조를 "분리 배포"로 정리하고, **원본 데이터는 로컬에 남고 서버로는 메타데이터/상태/설정만 흐른다**는 경계를 코드·문서로 못박는다.

> 근거(코드 확인, 2026-07-15):
> - `ui-backend/app/services/airflow.py` — `AIRFLOW_BASE_URL`(기본 `http://airflow:8080`)로 로컬 Airflow REST 프록시. = 로컬 에이전트 원형.
> - `frontend/src/lib/api/real-adapter.ts` — `BASE`(로컬 ui-backend) 대상 fetch. = 브라우저가 localhost 백엔드를 직접 호출하는 현 구조(모델 B1에 근접).
> - `docker-compose.yml` — airflow/valkey/es/mysql/presidio 등 실행 플레인 서비스 정의.

## 선행 의존
- `pipeline-emulator-bug-canvas-real-alignment.md`(real 트리거 404·캔버스↔DAG 정합) **선행**. 에이전트가 프록시할 실행 플레인이 실제로 동작해야 분리가 의미를 갖는다.

## 목표
- 컨트롤 플레인(SvelteKit 프론트 + 오케스트레이션)과 실행 플레인(로컬 에이전트 = `ui-backend` + `docker-compose`)이 **분리 배포 가능**해진다.
- **데이터 트러스트 경계**가 확립된다 — 원본/PII는 로컬을 벗어나지 않고, 서버로는 run 상태·config·메타데이터만 흐른다.
- 단기 배포 모델(데스크톱 번들 vs 호스티드 UI+localhost)이 하나로 확정되고 동작한다.

## 접근 방법
1. **트러스트 경계 정의(문서 우선)**: 서버↔로컬 간 흐르는 데이터 분류표 — "서버로 나가도 되는 것(run id·상태·소요·config 스키마)" vs "절대 로컬 이탈 금지(원본 문서·PII·마스킹 전 데이터)".
2. **배포 모델 택1** (plan-review 확정):
   - **A. 데스크톱 번들**: 프론트+에이전트+compose를 로컬 패키징. 서버는 공유/라이선스만. (단일 사용자·데모 최적)
   - **B1. 호스티드 UI + 브라우저→localhost 에이전트**: 프론트는 서버 배포, 사용자 브라우저 JS가 `localhost:에이전트` 직접 호출. 현 구조와 최근접. (https→http localhost mixed-content/CORS 처리 필요)
3. **분리 배포 프로파일**: 프론트/에이전트 각각 독립 기동 가능하게 설정 분리(에이전트 base URL 주입, CORS 허용 오리진, 헬스체크 엔드포인트).
4. **연결 상태 UX**: 에이전트 미연결/오프라인 시 UI가 "로컬 에이전트 연결 안 됨" 명시(현재는 트리거 실패가 404로만 뜸).

## 작업 목록

### A. 트러스트 경계 (문서·계약)
- [ ] A-1. 서버↔로컬 데이터 분류표 작성 (나가도 되는 것 / 이탈 금지) — docs/ 결정노트
- [ ] A-2. 어댑터 계약에 경계 반영: real-adapter가 서버로 보내는 payload에 원본데이터 미포함 확인

### B. 배포 모델 확정·구성
- [ ] B-1. 배포 모델 A vs B1 확정 (plan-review)
- [ ] B-2. 프론트/에이전트 분리 기동 설정 — 에이전트 base URL 주입, CORS 허용 오리진 (path: frontend real-adapter BASE, ui-backend main.py)
- [ ] B-3. (B1 채택 시) https 페이지→http localhost mixed-content 대응 방안 확정(에이전트 로컬 https or 허용 스킴)

### C. 연결 상태·헬스
- [ ] C-1. 에이전트 헬스체크 엔드포인트 (path: ui-backend)
- [ ] C-2. UI 연결상태 표시 — 미연결 시 명확 안내 (path: +page.svelte / ToolCanvasView)

### Z. 게이트
- [ ] Z-pre. `npm run check` 통과
- [ ] Z-post. 분리 기동 스모크: 프론트(서버측)↔에이전트(로컬) 각각 기동 후 트리거 왕복 확인

## Verification (Right-BICEP)
- [ ] **Right**: 프론트/에이전트 분리 기동 상태에서 트리거 → run 성공, 상태 표시.
- [ ] **B**: 에이전트 오프라인 → UI "연결 안 됨" 안내(무한대기·404 원문 노출 아님).
- [ ] **Cross-check**: 서버로 나가는 payload에 원본/PII 필드 부재(A-1 분류표 대조).
- [ ] **Error**: CORS/mixed-content 차단 시 콘솔·UI에 원인 표시.

## 열린 항목
| 항목 | 상태 | 비고 |
|------|------|------|
| 배포 모델 A vs B1 | plan-review 확정 | 데모=A 단순 / 제품지향=B1 |
| 장기 self-hosted runner(B2)로의 승격 경로 | 아이디어 계획서 참조 | `...idea-self-hosted-runner-architecture.md` |
