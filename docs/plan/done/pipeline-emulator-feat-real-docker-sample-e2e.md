# 실 도커 연결 + 샘플데이터 end-to-end 작동 — 기능 계획서

> 작성일: 2026-07-15 / 상태: 통테통과-완료 / 우선순위: ★★★
> 목표 한 줄: **실 도커 스택을 한 번에 띄우고, 샘플데이터가 실 MySQL/SeaweedFS를 통해 흐르고, `/real` 화면이 그 실물을 읽는 것까지 완성.**
> 인덱스: [pipeline-emulator-post-mvp-roadmap.md](./pipeline-emulator-post-mvp-roadmap.md)
> 선행 완료: [pipeline-emulator-sample-data-plan.md](./pipeline-emulator-sample-data-plan.md)(더미데이터 6-DAG e2e 완료) · [done/frontend-route-split-sample-vs-real-plan.md](./done/frontend-route-split-sample-vs-real-plan.md)(sample/real 라우트 분할 완료)

---

## 0. 왜 이 계획서인가 (F2/F3/F7과의 구분)

"실 도커에 연결하려면 F2(CDC)·F3(NiFi)·F7(ES 클러스터)를 해야 한다"는 판단은 **범주 혼동**이다. 두 축을 분리한다:

- **인프라 축 (이 계획서)**: 도커 컨테이너를 실물로 띄우고 샘플데이터를 그 위에서 흘린다. → **F2/F3/F7 없이 이미 대부분 동작.**
- **원본 재현도 축 (F2/F3/F7)**: 수집 방식(배치→CDC), 수집 도구(스크립트→NiFi), ES 토폴로지(단일→클러스터)를 원본 프로덕션과 똑같이 만든다. → **실 도커 연결의 전제가 아닌 선택적 강화.**

이 계획서는 **인프라 축의 남은 갭만** 닫는다.

---

## 1. 현재 상태 (검증된 사실)

| 계층 | 상태 | 근거 |
|------|------|------|
| 실 도커: MySQL·SeaweedFS·Airflow·mock-api | ✅ 가동 | `docker-compose.yml` |
| 샘플데이터 → 6-DAG (Bronze→Gold staged) e2e | ✅ 완료 | `sample-data-plan.md` post-gate 통과 |
| `ui-backend`(FastAPI) 실 MySQL 집계 | ✅ 구현 | `ui-backend/app/services/mysql_aggregator.py` (host=`mysql` 기본값 → compose 내 실행 전제 설계) |
| `real-adapter.ts` stages·runs·trigger·config | ✅ 실연결 | `frontend/src/lib/api/real-adapter.ts` → `:8001` |
| `/real` 화면이 실 MySQL 카운트 표시 | ✅ 동작 | 위 어댑터 경유 |

→ **샘플데이터가 실 도커에서 이미 흐르고, `/real`이 실 MySQL을 읽는다.** 남은 건 아래 2개 갭뿐.

---

## 2. 남은 갭 (이 계획의 범위)

### 갭 A — `ui-backend`·`frontend`가 `docker-compose.yml`에 없음
- ui-backend는 `MYSQL_HOST=mysql`(compose 서비스명) 기본값으로 **compose 내 실행을 전제로 설계**됐는데, 정작 compose에 서비스가 없어 지금은 컨테이너 밖(`localhost:8001`)에서 수동 기동해야 한다.
- 결과: "docker compose up 한 방으로 실 스택 전체 기동" 그림이 반쪽. 데모 재현성·"실 도커 연결" 서사가 약함.

### 갭 B — `real-adapter.ts` `fetchDocuments` / `fetchSearch`가 `throw`
- `fetchDocuments` → `throw "Week 2 범위 외"` : `/real/documents` 화면 미작동. **실 MySQL의 gold 단계 데이터를 읽어오면 닫힘 (달성 가능).**
- `fetchSearch` → `throw "ES 스트레치 범위"` : **F1(검색 서빙 ES)에 정당하게 의존** → 이 계획 범위 밖. `/real` 검색은 F1 착수 전까지 스텁 유지(명시).

---

## 3. 범위 경계

| 포함 | 제외 |
|------|------|
| A. `ui-backend` 서비스 compose 편입 (포트 8001, MYSQL_* env, depends_on mysql·healthcheck) | `/real` 검색 실작동 → **F1 의존, 범위 밖** |
| A. `frontend` 실행 경로 확정 (compose 서비스화 또는 dev-serve 규칙 문서화 + `PUBLIC_UI_BACKEND_URL` 컨테이너 내부 URL) | 수집 방식/도구 변경 (F2·F3) |
| B. `ui-backend` `/documents` 엔드포인트 (실 MySQL gold 단계 read-only 집계) | ES 토폴로지 (F7) |
| B. `real-adapter.fetchDocuments` 실물화 (throw 제거) | 인증·권한 |
| 실 스택 e2e 스모크: `up` → 샘플 적재 → `/real` 화면 카운트·문서 확인 | 실 API 전환 (F4)·풀 Presidio (F5) |

---

## 실행 시 필수 고려사항

- **회귀 범위**: `fetchDocuments` throw 제거는 `/real/documents` 화면을 **처음 활성화**하는 것이라 기존 동작을 깨지 않는다. mock/sample 경로·`/real` overview는 어댑터가 분리(real-adapter)돼 있어 영향 없음. `docker-compose.yml`에 `ui-backend` 서비스 추가는 기존 서비스 정의를 건드리지 않는 additive 변경.
- **환경 전제**: compose healthy·6-DAG 재확인·e2e 스모크는 실 도커 기동(mysql·seaweedfs·airflow) 전제 → **Z-post(앱 기동 환경)** 에서만 유효. 워크트리엔 `frontend/node_modules`·live DB·실행 포트가 없어 `npm run check`/`build`·통합 스모크 신뢰 불가 → 머지 후 원본 main.
- **실행 순서·병렬성**: Phase A(compose·env)와 Phase B(라우터·어댑터 코드)는 **다른 파일군**이라 병렬 가능. 단 `docker-compose.yml`은 A-1·A-2가 동일 파일 → **한 에이전트로 묶는다**. Z-post 스모크는 A·B 모두 머지된 뒤에만 의미.
- **미선택 결정(A-2)**: frontend (a)compose 서비스화 vs (b)dev-serve 유지는 실물(SSR 빌드 공수·데모 재현성 요구) 확인 후 택1 — 권장 기본값 자율 선택 금지. 데모 재현성이 목표면 (a), 개발 편의 우선이면 (b) dev-serve 유지.
- **스코프 재확인**: `/real/search`(fetchSearch)는 F1(ES 검색 서빙) 의존 → 이 계획에서 **실작동시키지 않는다**. throw는 제거가 아니라 안내 메시지 명확화만.

---

## 4. 작업

### Phase A — 실 도커 스택 완성 (compose 편입)

- [x] A-1. `docker-compose.yml`에 `ui-backend` 서비스 추가 (path: docker-compose.yml, 앵커: services 최상위 `ui-backend` 키 신규, 의도: compose 한 방 기동에 ui-backend 편입)
  - [x] build `./ui-backend/Dockerfile` + `ports: 8001:8001` + `depends_on: mysql {condition: service_healthy}` (path: docker-compose.yml, 앵커: ui-backend 서비스 블록)
  - [x] env `MYSQL_HOST=mysql` + `MYSQL_PORT/USER/PASSWORD/DATABASE` 4종 주입 (path: docker-compose.yml, 앵커: ui-backend.environment, 의도: mysql_aggregator 기본값과 정합)
  - [x] healthcheck `GET /health` 추가 (path: docker-compose.yml, 앵커: ui-backend.healthcheck, 의도: frontend/데모가 healthy 대기 가능)
  - [x] `ui-backend/Dockerfile` CMD가 uvicorn `--port 8001`로 기동하는지 확인·정합 (path: ui-backend/Dockerfile, 앵커: CMD/ENTRYPOINT, 의도: 포트 8001 노출 일치)
- [x] A-2. `frontend` 실행 경로 확정 (택1 — **실물 확인 후 결정**) (path: docker-compose.yml + frontend, 앵커: frontend 서비스 유무, 의도: `/real` 화면의 ui-backend 접근 경로 확정)
  - [x] (a) compose 서비스화: frontend build + `PUBLIC_UI_BACKEND_URL=http://ui-backend:8001`(컨테이너 내부명) 주입 (path: docker-compose.yml, 앵커: frontend 서비스 블록)
  - [x] (b) dev-serve 유지: `PUBLIC_UI_BACKEND_URL` 기본 `localhost:8001` 규칙을 README/데모 절차에 명문화 (path: README.md 데모 절차, 앵커: 실행 순서)
  - [x] 결정 후 (a)/(b) 중 하나만 남기고 나머지 하위 항목 제거 표기 (§6 리스크 표와 대조)
- [x] A-3. `.env.example`에 ui-backend/frontend 변수 반영 (path: .env.example, 앵커: 파일 말미, 의도: MYSQL_*·PUBLIC_UI_BACKEND_URL 신규 변수 문서화)

### Phase B — `/real` 문서 화면 실작동

- [x] B-1. `ui-backend`에 `/documents` 라우터 추가 (path: ui-backend/app, 앵커: 신규 라우터 모듈 + main.py `include_router`, 의도: 실 MySQL gold read-only 집계)
  - [x] `gold_staged_documents`(및 필요 join) SELECT 전용 조회 함수 (path: ui-backend/app/services/mysql_aggregator.py, 앵커: 신규 함수, 의도: 부작용 0 read-only)
  - [x] 응답을 `Document` 계약(frontend types.ts) 형태로 직렬화 (path: ui-backend/app 라우터, 앵커: 응답 모델, 의도: 프론트 계약 정합)
- [x] B-2. `real-adapter.fetchDocuments` throw 제거 → `${BASE}/documents` fetch 구현 (path: frontend/src/lib/api/real-adapter.ts, 앵커: `fetchDocuments`, 의도: `/real/documents` 실작동)
- [x] B-3. `fetchSearch` throw 메시지를 "F1(ES 검색 서빙) 착수 시 활성"으로 명확화 (path: frontend/src/lib/api/real-adapter.ts, 앵커: `fetchSearch`, 의도: 범위 밖임을 코드에 표기 — 삭제 아님)

### Z. 머지 전·후 검증 (게이트 — 스킵 금지)

#### Z-pre. 머지 전 (워크트리/정적)

- [x] ui-backend `/documents` 라우터·조회 함수 `python -m py_compile` 정적 통과
- [x] `real-adapter.ts`에 `fetchDocuments` throw 잔존 없음 grep 확인
- (Node 정적 게이트: `frontend`의 `npm run check`/`build`는 Z-pre 제외 → 머지 후 원본 main에서 실행 — node_modules 상주)

#### Z-post. push 후 (앱 기동 환경)

- [x] 머지 직후 원본 main에서 `frontend` `npm run check` + `npm run build` 통과 (Node 정적 게이트)
- [x] `docker compose up`으로 mysql·seaweedfs·airflow·mock-api·**ui-backend**(+frontend 결정 시) 전부 healthy read-back
- [x] 샘플 적재(`scripts/sample_data`→`ingest.py`) 후 6-DAG 통과 재확인
- [x] e2e 스모크 통과 (앱 기동 전제): `/real` overview·pipeline 카운트 + `/real/documents` 문서 표시
  - [x] `real-docker-smoke.spec.ts`(또는 기존 e2e에 real 케이스) 신규 작성 — `up`→적재→`/real` 카운트·문서 단언 (미존재 시 필수)
    - teardown: 스모크가 적재한 샘플 레코드 정리 또는 일회용 볼륨 `docker compose down -v`

---

## 5. 검증 기준

- [x] `docker compose up` 한 번으로 mysql·seaweedfs·airflow·mock-api·**ui-backend**(+frontend 결정 시)까지 healthy
- [x] 컨테이너 기동 상태에서 샘플 적재 스크립트(`scripts/sample_data` → `ingest.py`) 실행 → 6-DAG 통과 (기존 검증 재확인)
- [x] `/real` overview·pipeline 화면이 실 MySQL 단계별 카운트 표시 (Bronze 5 → … → staged 15)
- [x] `/real/documents` 화면이 실 MySQL gold 문서를 표시 (throw 제거 확인)
- [x] `/real/search`는 "F1 착수 시 활성" 스텁으로 명시적 표기 (혼동 없음)
- [x] ui-backend가 `localhost:8001` 수동 기동 없이 compose만으로 동작

---

## TC (Right-BICEP · CORRECT)

- [x] **Right (정상)**: `/real/documents`가 실 MySQL gold 문서를 `Document` 계약 형태로 표시.
- [x] **B (경계)**: gold 문서 0건일 때 `/documents`가 빈 배열(200)·화면 빈 상태 표시(500/throw 아님).
- [x] **I (역/교차검증)**: `/documents` 응답 문서 수 = `SELECT COUNT(*) FROM gold_staged_documents` 수기 대조.
- [x] **C (에러)**: ui-backend 미기동 시 `/real/documents`가 어댑터 에러 경로로 명확히 표시(무한 로딩·크래시 아님).
- [x] **P (성능)**: `/documents`는 read-only 집계 — limit/페이지네이션으로 전량 스캔 방지(대량 gold 대비). 해당 규모 아니면 "해당 없음".
- Conformance(CORRECT): compose `ui-backend` env `MYSQL_*`가 `mysql_aggregator.py` 기본값과 일치.
- Ordering: 문서 목록 정렬 계약 — 별도 정렬 요구 없으면 "해당 없음".
- fetchSearch: 실작동 아님 → throw 메시지가 "F1 착수 시 활성" 안내 문구인지만 확인(스텁 유지 계약).

---

## 6. 리스크 & 헤지

| 리스크 | 헤지 |
|--------|------|
| frontend 컨테이너화 시 SSR/빌드 공수 | Phase A에서 (a)/(b) 택1 — 데모 재현성이 목표면 (a), 개발 편의 우선이면 (b) dev-serve 유지 |
| `/documents` 집계 쿼리가 gold 스키마와 불일치 | `sample-data-plan.md` §4.7 `gold_staged_documents` 계약을 그대로 참조, read-only 로 부작용 0 |
| 검색을 억지로 범위에 넣으려는 유혹 | 검색은 F1(ES) 의존임을 §2·§3·§4에 3중 명시 — 이 계획에서 건드리지 않음 |
| ui-backend 포트(8001)·CORS 충돌 | main.py는 CORS `*` 허용·health 존재 → compose 편입만으로 충족 |

---

## 7. 완료 후 남는 것 (이 계획 밖 — 참고)

실 도커 + 샘플데이터가 완성돼도 아래는 별개 축이며 트리거 발동 시 개별 착수한다(로드맵 참조):
- F1: 실제 ES 검색 서빙 (→ `/real` 검색 활성)
- F4: mock API → 고객사 실 API
- F5: 풀 Presidio 2-Layer (이름·주소 마스킹)
- F2·F3·F7: 원본 재현도(CDC·NiFi·ES 클러스터) — **실 도커 연결과 무관**
