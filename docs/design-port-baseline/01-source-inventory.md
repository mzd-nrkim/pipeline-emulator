# pipeline-explorer 소스 기준선 인벤토리

> 작성일: 2026-07-14 / Phase 0 산출물
> 소스 저장 경로: `/Users/mz01-risingnrkim/workspace_mzd/pipeline-explorer`

---

## 1. Git 기준선

| 항목 | 값 |
|------|-----|
| HEAD commit SHA | `e529d02` (full: e529d02 — "Completed pipeline emulator") |
| 원격 URL | `https://github.com/mzd-nrkim/pipeline-explorer.git` |
| 브랜치 | main |
| 이전 커밋 | `ca0034c` (Changes), `c0c8cf2` (Changes) |

---

## 2. 라이선스 / README / 자산 귀속

| 항목 | 확인 결과 |
|------|----------|
| LICENSE 파일 | **없음** (루트에 LICENSE 파일 미존재) |
| README.md | **없음** (루트에 README.md 미존재) |
| AGENTS.md | 존재 — Lovable 연동 안내만 포함. 라이선스 조항 없음 |
| 자산 귀속 | Lovable 생성 프로젝트(`@lovable.dev/vite-tanstack-config` devDependency) — 독점 코드이나 내부 데모용이므로 이식 가능 범위는 팀 판단 필요 |

**라이선스 미확인 자산 처리 원칙**: LICENSE 파일 부재 → 코드 복사 대신 구조·디자인 패턴 참조 수준으로 이식. 실제 코드 줄 단위 복사는 Lovable 계약 검토 후 결정.

---

## 3. 프레임워크 및 의존성 확정

### 핵심 프레임워크

| 항목 | 버전 | 비고 |
|------|------|------|
| **React** | `^19.2.0` | (Next.js가 아님 — TanStack Start 사용) |
| **TanStack Start** | `^1.168.26` | SSR/풀스택 프레임워크 (Vite 기반) |
| **TanStack Router** | `^1.170.16` | 파일 기반 라우팅 |
| **Vite** | `^8.0.16` | 번들러 |
| **TypeScript** | `^5.8.3` | |

> **중요**: `pipeline-explorer`는 Next.js가 아니라 **TanStack Start + TanStack Router** 스택이다.
> 계획서 §2 소스 스택 서술("Next.js")을 수정 필요.

### UI / 스타일

| 항목 | 버전 | 채용 여부 |
|------|------|----------|
| **Tailwind CSS** | `^4.2.1` | ✅ 사용 (`@tailwindcss/vite` 플러그인) |
| **tw-animate-css** | `^1.3.4` | ✅ 사용 (`@import "tw-animate-css"` in styles.css) |
| **shadcn/ui (New York style)** | — | ✅ 사용 (`components.json` 존재, `style: "new-york"`) |
| **Radix UI** | 전 컴포넌트 세트 | ✅ 사용 (accordion, dialog, select, switch, tabs 등 20+ 패키지) |
| **class-variance-authority (cva)** | `^0.7.1` | ✅ 사용 |
| **clsx** | `^2.1.1` | ✅ 사용 |
| **tailwind-merge** | `^3.5.0` | ✅ 사용 (`cn` 유틸) |

### 아이콘

| 항목 | 버전 | 비고 |
|------|------|------|
| **lucide-react** | `^0.575.0` | ✅ 사용 (ui/ 컴포넌트에서 ChevronLeft/Right, X, GripVertical 등) |

### 플로우 / 그래프

| 항목 | 사용 여부 |
|------|----------|
| **React Flow / @xyflow/react** | ❌ **미사용** |
| 파이프라인 플로우 구현 방식 | **커스텀 CSS Grid** (`grid-cols-7`) — 카드 배열로 플로우 시각화 |

> `pipeline-explorer`는 React Flow를 사용하지 않는다. 파이프라인 플로우는 `src/routes/pipeline.tsx`의 `PipelineFlow` 컴포넌트에서 CSS Grid(7열)로 단계 카드를 배열하고, 절대 위치 수평선(`h-px bg-border`)으로 연결을 표현.

### 기타 의존성

| 항목 | 버전 | 비고 |
|------|------|------|
| recharts | `^2.15.4` | 설치됨, 실제 라우트에서 **미사용** (chart.tsx ui 파일만 존재) |
| @tanstack/react-query | `^5.101.1` | root layout에서 QueryClientProvider 래핑 |
| sonner | `^2.0.7` | 토스트 알림 (routes에서 미확인) |
| date-fns | `^4.1.0` | 날짜 포맷 |
| vaul | `^1.1.2` | Drawer 컴포넌트 |
| react-resizable-panels | `^4.6.5` | resizable 레이아웃 |

---

## 4. 디자인 토큰 요약 (styles.css 추출)

### 색상 팔레트 (oklch)

| 토큰 | 라이트 | 다크 | 의미 |
|------|--------|------|------|
| `--background` | oklch(0.985 0.002 250) | oklch(0.14 0.03 260) | 앱 배경 |
| `--foreground` | oklch(0.18 0.04 260) | oklch(0.97 0.005 250) | 주 텍스트 |
| `--primary` | oklch(0.54 0.22 264) | oklch(0.64 0.22 264) | 주 강조색 (파란보라) |
| `--success` | oklch(0.68 0.16 158) | oklch(0.72 0.16 158) | 완료 상태 (녹색) |
| `--warning` | oklch(0.75 0.15 70) | oklch(0.78 0.15 70) | 경고/진행 (주황) |
| `--destructive` | oklch(0.6 0.22 25) | oklch(0.7 0.2 25) | 실패/오류 (빨강) |
| `--muted-foreground` | oklch(0.5 0.02 260) | oklch(0.7 0.02 260) | 비활성/없음 (회색) |
| `--surface` | oklch(1 0 0) | oklch(0.19 0.03 260) | 카드 표면 |
| `--surface-muted` | oklch(0.97 0.005 250) | oklch(0.22 0.03 260) | 음영 표면 |

### 상태색 매핑 (5종)

| 상태 | 소스 토큰 | 의미 |
|------|----------|------|
| completed (완료) | `--success` (#녹색) | `bg-success` + `text-success` |
| in_progress (진행) | `--primary` (파란보라) | `bg-primary animate-status-pulse` |
| pending (대기) | `--border` (회색) | `bg-border` |
| failed (실패) | `--destructive` (빨강) | `bg-destructive` |
| none (없음) | `--border` (회색, 점선) | `bg-transparent border-dashed` |

### 타이포그래피

| 항목 | 값 |
|------|-----|
| font-sans | "Inter", ui-sans-serif, system-ui, sans-serif |
| font-mono | "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace |
| 폰트 CDN | Google Fonts (Inter + JetBrains Mono) — `__root.tsx` link 태그 |

### radius / 기타

| 항목 | 값 |
|------|-----|
| `--radius` | 0.25rem (4px 기반, 거의 직각) |
| 애니메이션 | `animate-status-pulse` — `@utility` 정의, 2s cubic-bezier 진행 중 펄스 |

---

## 5. 앱 메타데이터

| 항목 | 소스 값 | 이식 시 교체 값 |
|------|---------|----------------|
| 브랜드명 | **Flux.Engine** | **PipeScale** |
| `<title>` | "Flux.Engine — Pipeline Emulator" | "PipeScale — 파이프라인 에뮬레이터" |
| `og:title` | "Flux.Engine — Pipeline Emulator" | "PipeScale — 파이프라인 에뮬레이터" |
| 앱 설명 | "A design-only Bronze/Silver/Gold…" | 한국어 번역 |
| 헤더 로고 텍스트 | "Flux.Engine" (uppercase, font-extrabold) | "PipeScale" |
| 헤더 상태 배지 | "Simulated Mode" | "시뮬레이션 모드" |
| favicon | `/favicon.ico` (binary, 20KB) | 이관 대상 |
