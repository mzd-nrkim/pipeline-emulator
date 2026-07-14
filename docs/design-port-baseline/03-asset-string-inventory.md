# 정적 자산·문자열 인벤토리

> 작성일: 2026-07-14 / Phase 0 산출물

---

## 1. 정적 자산 인벤토리 (3분류)

### public/ 디렉토리

| 파일 | 크기 | 분류 | 처리 방침 |
|------|------|------|----------|
| `favicon.ico` | ~20KB | **이관** | SvelteKit `static/favicon.ico`로 복사 |
| `robots.txt` | 22B | **이관** | `static/robots.txt`로 복사 (내용: `User-agent: * / Allow: /`) |

### 폰트 (CDN)

| 폰트 | 공급처 | 분류 | 처리 방침 |
|------|--------|------|----------|
| **Inter** (400/500/600/700/800) | Google Fonts CDN | **이관** | `app.html` `<link>` 태그 동일하게 적용 |
| **JetBrains Mono** (400/500/700) | Google Fonts CDN | **이관** | 동일 CDN 링크 유지 |

> 오프라인 시 폰트 폴백(시스템 sans-serif/monospace)으로 시각 diff 오탐 가능 — Phase 5 시각 대조 시 온라인 환경에서 수행.

### 이미지 / OG 이미지

| 항목 | 소스 상태 | 분류 | 처리 방침 |
|------|----------|------|----------|
| og:image | **없음** (og:image 메타 태그 미설정) | **폐기** | 이식 시에도 설정 불필요 (또는 텍스트 기반 생성) |
| 커스텀 아이콘 (로고) | 없음 — CSS로 구현 (div + rotate-45 다이아몬드) | **폐기** | SvelteKit에서 동일 CSS 방식 재현 |
| 스크린샷/이미지 파일 | **없음** | — | — |

### 요약

| 분류 | 항목 |
|------|------|
| **이관** (그대로 복사) | `favicon.ico`, `robots.txt`, Google Fonts CDN 링크 |
| **대체** (방식 동일, 파일 신규 생성) | 없음 |
| **폐기** (불필요/재구현) | og:image (미설정), 로고 이미지 (CSS 구현 유지) |

---

## 2. 사용자 노출 문자열 인벤토리

### 브랜드명 / 고유명사

| 소스 영어 | 이식 후 표기 | 분류 |
|----------|------------|------|
| Flux.Engine | **PipeScale** | 브랜드 교체 |
| Pipeline Emulator | 파이프라인 에뮬레이터 (병기 허용) | 번역 |
| Simulated Mode | 시뮬레이션 모드 | 번역 |

### 내비게이션 탭

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| Overview | 개요 |
| Pipeline | 파이프라인 |
| Documents | 문서 |
| Search | 검색 |
| Settings | 설정 |
| Components | 컴포넌트 |

### 개요 페이지

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| "A data pipeline you can watch end-to-end..." | "원본부터 검색까지 전 과정을 지켜볼 수 있는 데이터 파이프라인." |
| "Flux.Engine reproduces a real Bronze → Silver → Gold..." | "PipeScale은 실제 Bronze → Silver → Gold 데이터 파이프라인을 라이브 시뮬레이션으로 재현합니다..." |
| "Design-only preview — no external data leaves this app." | "디자인 전용 미리보기 — 외부 데이터가 이 앱을 벗어나지 않습니다." |
| "Ingest sample data" (버튼) | "샘플 데이터 투입" |
| "Open Pipeline" (버튼) | "파이프라인 열기" |
| "The journey" (섹션 레이블) | "처리 여정" |
| 01 Ingest | 01 투입 |
| 02 Structure & Mask | 02 구조화 & 마스킹 |
| 03 Chunk & Enrich | 03 청킹 & 엔리치먼트 |
| 04 Search | 04 검색 |
| "Current configuration" | "현재 구성" |
| "Stage substitutions" | "단계 대체 구성" |
| "All six stages" | "6개 처리 단계" |

### 파이프라인 페이지

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| Active Run | 진행 중 실행 |
| Ingestion Volume | 투입 규모 |
| Configuration | 구성 |
| "Ingest Sample" (버튼) | "샘플 투입" |
| "Stop Run" (버튼) | "실행 중지" |
| "Start Pipeline" (버튼) | "파이프라인 시작" |
| "Rerun" (버튼) | "재실행" |
| "Data processing flow" | "데이터 처리 흐름" |
| "6 active stages · 1 planned" | "활성 단계 6개 · 예정 1개" |
| "No data yet" | "데이터 없음" |
| "Ingest sample data to begin" | "시작하려면 샘플 데이터를 투입하세요" |
| "Inspector: {stage.name}" | "검사기: {단계명}" |
| Docs in / Docs out | 입력 문서 수 / 출력 문서 수 |
| Last duration | 마지막 소요 시간 |
| Last run | 마지막 실행 |
| Method: REGEX_PATTERN | 방식: REGEX_PATTERN (코드 식별자 유지) |
| "Detected PII types" | "탐지된 PII 유형" |
| "Sample transformation" | "변환 예시" |
| "Run History" | "실행 이력" |
| "Compare" | "비교" |
| in_progress → "in progress" | "진행 중" |
| succeeded | "성공" |
| failed | "실패" |

### PII 유형 레이블 (piiCounts)

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| Phone numbers | 전화번호 |
| Registration IDs | 주민등록번호 |
| Email addresses | 이메일 주소 |
| Bank accounts | 계좌번호 |
| Names | 이름 |
| Addresses | 주소 |

### 마스킹 전후 예시 문자열 (도메인 값 — 유지)

| 항목 | 처리 |
|------|------|
| `010-1234-5678`, `010****1234` | 도메인 예시 → 한국어 환경이므로 유지 |
| `user@hmc.example` | 도메인 예시 → 유지 |
| `123-456789-12`, `[Bank Account Masked]` | 영문 마스킹 레이블 → "**[계좌번호 마스킹]**"으로 번역 |
| `[Email Masked]` | → "**[이메일 마스킹]**" |
| `김철수`, `서울시 강남구` | 이미 한국어 → 유지 |
| name — planned, address — planned | → "이름 — 예정", "주소 — 예정" |

### 문서 페이지

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| "N shown" | "N건 표시" |
| "All priorities" | "모든 중요도" |
| "Priority {P}" | "중요도 {P}" |
| "masked" (체크박스) | "마스킹됨" |
| "Document" (레이블) | "문서" |
| Bronze · Registration | 브론즈 · 등록 |
| Silver · Structuring | 실버 · 구조화 |
| Silver · Masking (before / after) | 실버 · 마스킹 (전 / 후) |
| Gold · Chunking | 골드 · 청킹 |
| Gold · Enrichment | 골드 · 엔리치먼트 |
| Gold · Field Mapping | 골드 · 필드매핑 |
| Before / After · Regex | 전 / 후 · 정규식 |
| Keywords / Summary / Entities | 키워드 / 요약 / 개체명 |
| "One Bronze issue can fan out to multiple parts..." | "하나의 브론즈 이슈가 여러 부품·차종·프로젝트로 확장될 수 있습니다..." |
| "name — (planned)" | "이름 — (예정)" |
| "address — (planned)" | "주소 — (예정)" |

### 검색 페이지

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| "Search Demo" | "검색 데모" |
| "Query the Gold layer" | "골드 계층 검색" |
| "Search serving is off" | "검색 서빙이 꺼져 있습니다" |
| "The search demo is available once..." | "검색 서빙이 활성화되면 검색 데모를 사용할 수 있습니다..." |
| "Open Settings" | "설정 열기" |
| "Search issues, parts, symptoms…" | "문제, 부품, 증상 검색…" |
| keyword / semantic / hybrid | 키워드 / 의미 / 하이브리드 |
| Score | 점수 |
| keyword / semantic (ScoreCard) | 키워드 기여 / 의미 기여 |
| "Security: All" | "보안 분류: 전체" |
| "Priority: All" | "중요도: 전체" |
| "Model: NX01" | "차종: NX01" |
| "Permission-based result filtering by security classification" | "보안 분류별 권한 기반 결과 필터링" |

### 설정 페이지

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| "Configuration" | "구성" |
| "Emulator dimensions" | "에뮬레이터 구성 축" |
| "Each dimension changes how the emulator runs..." | "각 구성 축은 에뮬레이터 실행 방식을 변경합니다..." |
| "Requires search serving enabled" | "검색 서빙이 활성화된 경우에만 설정 가능" |

#### Dimension 레이블 (한국어 대응)

| 소스 key | 소스 label | 한국어 label |
|---------|-----------|------------|
| execution_mode | Execution mode | 실행 방식 |
| collector | Collector | 수집기 |
| cdc | Real-time change detection | 실시간 변경 감지 |
| search | Search serving | 검색 서빙 |
| chunk_enrich | Chunking & enrichment | 청킹 & 엔리치먼트 |
| masking | PII masking | PII 마스킹 |
| topology | Search-node topology | 검색 노드 구성 |

#### Dimension 설명 (한국어)

| 원문 | 번역 |
|------|------|
| "How pipeline workers coordinate for a run." | "파이프라인 워커가 실행을 조율하는 방식." |
| "How raw source data enters the Bronze layer." | "원본 데이터가 브론즈 계층에 진입하는 방식." |
| "Whether new records stream in continuously." | "새 레코드가 지속적으로 스트리밍 입력되는지 여부." |
| "Search backend available to end users." | "최종 사용자에게 제공되는 검색 백엔드." |
| "Simulated fixtures vs real LLM enrichment." | "모의 고정값 대 실제 LLM 엔리치먼트." |
| "How personally identifiable information is redacted." | "개인식별정보를 가리는 방식." |
| "Only configurable when search serving is enabled." | "검색 서빙이 활성화된 경우에만 구성 가능." |

#### Dimension 값 레이블 (한국어)

| 원문 | 번역 |
|------|------|
| Single node | 단일 노드 |
| Distributed | 분산 |
| Script | 스크립트 |
| Ingestion tool | 수집 도구 |
| Off | 끔 |
| On | 켬 |
| Lightweight | 경량 |
| Hybrid | 하이브리드 |
| Simulated | 모의 |
| Real | 실제 |
| Regex | 정규식 |
| Advanced | 정밀 |
| Cluster | 클러스터 |

### 컴포넌트 페이지

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| "Library" | "라이브러리" |
| "Reusable components" | "재사용 컴포넌트" |
| "Status badge" / purpose | "상태 배지" / "단계 또는 실행의 상태를 나타냅니다." |
| "Status dot" / purpose | "상태 점" / "인라인 사용을 위한 소형 상태 표시기." |
| "Progress stepper" / purpose | "진행 스테퍼" / "브론즈 → 실버 → 골드 계층 진행 상황을 표시합니다." |
| "Stage node" / purpose | "단계 노드" / "파이프라인 단계의 계층·상태·문서 수를 표시합니다." |
| "Run history item" / purpose | "실행 이력 항목" / "실행 목록의 행 — ID, 시간, 결과 표시." |
| "PII count display" / purpose | "PII 카운트 표시" / "유형별 탐지된 PII 건수. 예정 유형은 흐리게 표시." |
| "Before / after masking" / purpose | "마스킹 전후 비교" / "원본 텍스트와 마스킹 후 텍스트를 나란히 비교." |
| "Search result item" / purpose | "검색 결과 항목" / "검색 결과 목록의 항목." |
| "Configuration toggle" / purpose | "구성 토글" / "구성 축의 2~3값 세그먼트 토글." |

### 상태 레이블 (StatusBadge에서)

| 소스 영어 | 한국어 번역 |
|----------|-----------|
| Completed | 완료 |
| In progress | 진행 중 |
| Pending | 대기 |
| Failed | 실패 |
| No data | 데이터 없음 |
| Planned | 예정 |

### 에러/빈 상태 (소스에서 확인, 신규 필요)

| 항목 | 소스 | 이식 시 추가 필요 |
|------|------|----------------|
| EmptyState (파이프라인 투입 전) | 존재 | 이관 |
| loading 상태 | **없음** | 신규 구현 — "불러오는 중..." |
| error 상태 | `ErrorComponent` (root에만) | 신규 구현 — "오류가 발생했습니다" |
| retry 버튼 | root ErrorComponent에만 | 신규 구현 — "다시 시도" |
| 결과 없음 (검색) | 소스에 없음 (mock 항상 결과 반환) | 신규 구현 — "검색 결과가 없습니다" |

---

## 3. 코드 식별자·CSS 클래스 (번역 불필요, 원문 유지)

- `Stage` 타입 key: `id`, `layer`, `status`, `docsIn`, `docsOut`, `lastRunAt` 등
- CSS 클래스명: Tailwind 유틸 전체
- 목 데이터 `id` 필드: `AP00005928||1`, `RX-9042-ALPHA` 등
- Dimension `key`: `execution_mode`, `masking`, `search` 등
- 상태 열거값 코드: `in_progress`, `completed`, `failed`, `none` (내부 식별자)
