# 프로젝트 리네임 계획서 — `pipeline-emulator` → `PipeScale`

> 작성일: 2026-07-14 / 상태: 초안 (실행 대기)
> 대상: `pipeline-emulator/` 프로젝트 전체 (독립 git repo 아님 · tools repo 미추적 → 순수 파일 이동)

---

## 1. 목표

기능 설명형 임시 이름 `pipeline-emulator`(및 한글 표기 "파이프라인 에뮬레이터")를 확정 프로젝트명 **PipeScale**로 전면 교체한다. 폴더명·파일명·문서 내 문자열·상호참조 링크를 **깨짐 없이** 일괄 정리한다.

- **성공 기준**: 리네임 후 `grep -r "pipeline-emulator"` 결과 0건, 모든 문서 간 상대링크가 유효(깨진 링크 0), 문서 렌더 시 제품명이 "PipeScale"로 일관 표기.
- **범위**: 문서(`docs/`)만 존재하는 현 시점 기준. (아직 코드·docker-compose·소스 없음 → 문서 리네임이 전부.)

---

## 2. 네이밍 규칙 (결정사항)

| 항목 | 값 | 사유 |
|------|-----|------|
| **표시 이름(브랜드)** | `PipeScale` | 문서 본문·제목에서 제품명으로 사용 |
| **경로/식별자** | `pipescale` (소문자) | 기존 kebab-case 관례 유지, macOS 대소문자 비구분 FS 충돌 회피, 링크 안정성 |
| **파일명 접두어** | `pipeline-emulator-` → `pipescale-` | 예: `pipeline-emulator-mvp-plan.md` → `pipescale-mvp-plan.md` |

> **"에뮬레이터" 단독 단어는 유지한다.** PipeScale은 여전히 "파이프라인 에뮬레이터"라는 *성격*을 가지므로, 일반 명사로 쓰인 "에뮬레이터"까지 기계적으로 지우지 않는다. 교체 대상은 **고유명사로서의** `pipeline-emulator` / "파이프라인 에뮬레이터"뿐이다. 첫 등장 설명이 필요한 곳은 `PipeScale(파이프라인 에뮬레이터)` 형태를 허용한다.

---

## 3. 작업 목록

### T1. 폴더 리네임
- [ ] `mv /Users/mz01-risingnrkim/workspace_mzd/pipeline-emulator /Users/mz01-risingnrkim/workspace_mzd/pipescale`
- [ ] IDE/에디터 열린 경로 갱신 (이 계획서 포함 열린 탭 경로 이동됨)

### T2. 파일명 리네임 (접두어 `pipeline-emulator-` → `pipescale-`)
접두어를 가진 파일만 대상. `lodestar-reuse-assessment.md`·`design-prompt-monitoring-dashboard.md`는 **접두어 없음 → 리네임 제외**.

- [ ] `docs/pipeline-emulator-decisions.md` → `docs/pipescale-decisions.md`
- [ ] `docs/plan/pipeline-emulator-mvp-plan.md` → `docs/plan/pipescale-mvp-plan.md`
- [ ] `docs/plan/pipeline-emulator-week2-plan.md` → `docs/plan/pipescale-week2-plan.md`
- [ ] `docs/plan/pipeline-emulator-sample-data-plan.md` → `docs/plan/pipescale-sample-data-plan.md`
- [ ] `docs/plan/pipeline-emulator-post-mvp-roadmap.md` → `docs/plan/pipescale-post-mvp-roadmap.md`
- [ ] `docs/plan/pipeline-emulator-feat-f1-search-es.md` → `docs/plan/pipescale-feat-f1-search-es.md`
- [ ] `docs/plan/pipeline-emulator-feat-f2-realtime-cdc.md` → `docs/plan/pipescale-feat-f2-realtime-cdc.md`
- [ ] `docs/plan/pipeline-emulator-feat-f3-nifi-collector.md` → `docs/plan/pipescale-feat-f3-nifi-collector.md`
- [ ] `docs/plan/pipeline-emulator-feat-f4-real-enrich-api.md` → `docs/plan/pipescale-feat-f4-real-enrich-api.md`
- [ ] `docs/plan/pipeline-emulator-feat-f5-presidio-2layer.md` → `docs/plan/pipescale-feat-f5-presidio-2layer.md`
- [ ] `docs/plan/pipeline-emulator-feat-f6-celery-executor.md` → `docs/plan/pipescale-feat-f6-celery-executor.md`
- [ ] `docs/plan/pipeline-emulator-feat-f7-es-cluster.md` → `docs/plan/pipescale-feat-f7-es-cluster.md`
- [ ] `docs/plan/pipeline-emulator-design-port-plan.md` → `docs/plan/pipescale-design-port-plan.md`

> 총 13개 파일. 이 계획서(`rename-to-pipescale.md`)는 이미 신규 관례를 따르므로 리네임 대상 아님.

### T3. 문서 내 문자열 치환
파일명 변경으로 **상호참조 링크가 전부 깨지므로 T2와 원자적으로 함께** 처리한다.

- [ ] **링크·식별자**: 모든 `pipeline-emulator` → `pipescale` (14개 파일). 특히 `.md` 상대링크 경로:
  - `pipeline-emulator-decisions.md` 링크 (6곳)
  - `pipeline-emulator-sample-data-plan.md` 링크 (3곳)
  - `pipeline-emulator-mvp-plan.md` / `-week2-plan.md` / `-post-mvp-roadmap.md` 링크
  - `pipeline-emulator-feat-f1~f7-*.md` 링크 (roadmap의 표·섹션 헤더 다수)
- [ ] **한글 제품 표기**: 고유명사 "파이프라인 에뮬레이터" → "PipeScale" (7개 파일). 문서 제목(`# 파이프라인 에뮬레이터 — …`) 포함. 첫 등장·설명 문맥은 `PipeScale(파이프라인 에뮬레이터)` 허용.
- [ ] "에뮬레이터" 단독(일반명사)은 **원칙적으로 유지** — 교체 여부는 문맥 판단.

### T4. 검증
- [ ] `grep -rn "pipeline-emulator" pipescale/` → **0건** 확인
- [ ] 잔여 파일명 확인: `find pipescale -name "*pipeline-emulator*"` → **0건**
- [ ] 링크 무결성: 각 문서의 `](./...md)`·`](../...md)` 대상 파일이 실제 존재하는지 스크립트/수동 확인 (깨진 링크 0)
- [ ] 제품 표기 일관성: 문서 제목·본문에서 "PipeScale" 사용, 남은 "파이프라인 에뮬레이터"가 의도된 병기뿐인지 확인

---

## 4. 실행 순서 & 주의

1. **T1 폴더 → T2 파일명 → T3 내용**을 이 순서로. T2·T3는 링크 정합을 위해 사실상 한 묶음(파일명 바꾸면 링크도 즉시 갱신).
2. **치환 방식**: `pipeline-emulator`는 안전한 전역 치환(하이픈 포함 고유 토큰). 반면 "에뮬레이터"·"파이프라인"은 일반어와 겹치므로 **전역 sed 금지**, 고유명사 "파이프라인 에뮬레이터" 문자열만 선별 치환.
3. **되돌리기**: git 미추적이라 백업이 없다 → 폴더 `mv` 직전 상태를 복구하려면 역방향 `mv`만 가능. 대량 내용 치환 전 `cp -r pipescale /tmp/pipescale.bak` 권장(선택).

---

## 5. 미결 확인 사항

- **경로 대소문자**: 기본값 `pipescale`(소문자)로 진행. 폴더명을 `PipeScale`(브랜드 그대로)로 원하면 실행 전 알려주세요.
- 향후 코드·`docker-compose.yml`·컨테이너명(`ui-backend` 등)이 생기면 그때 동일 규칙으로 확장.
