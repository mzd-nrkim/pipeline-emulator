# PipeScale — 디자인 시스템 계약 (DESIGN.md)

> 역캡처 기준: `pipeline-explorer` commit `e529d02` Lovable 생성 팔레트
> 작성일: 2026-07-14 / Phase 2 산출물
> 정책: 이 파일이 `app.css @theme` 의 단일 진실 출처다.
>   토큰 변경 시 이 파일과 `app.css` 를 함께 수정한다.

---

## 1. 브랜드

| 항목 | 값 |
|------|-----|
| 제품 표시명 | **PipeScale** |
| 첫 등장 병기 | `PipeScale(파이프라인 에뮬레이터)` |
| 헤더 로고 | "PipeScale" — font-extrabold, tracking-tight |
| `<title>` | "PipeScale — 파이프라인 에뮬레이터" |
| 헤더 상태 배지 | "시뮬레이션 모드" |

---

## 2. 색상 팔레트 (oklch, 라이트/다크)

### 2.1 의미 색상

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--background` | `oklch(0.985 0.002 250)` | `oklch(0.14 0.03 260)` | 앱 배경 |
| `--foreground` | `oklch(0.18 0.04 260)` | `oklch(0.97 0.005 250)` | 주 텍스트 |
| `--card` | `oklch(1 0 0)` | `oklch(0.208 0.042 265.755)` | 카드 배경 |
| `--primary` | `oklch(0.54 0.22 264)` | `oklch(0.64 0.22 264)` | 주 강조 (파란보라) |
| `--secondary` | `oklch(0.96 0.005 250)` | `oklch(0.279 0.041 260.031)` | 보조 배경 |
| `--muted-foreground` | `oklch(0.5 0.02 260)` | `oklch(0.7 0.02 260)` | 비활성 텍스트 |
| `--accent` | `oklch(0.6 0.18 280)` | `oklch(0.279 0.041 260.031)` | 강조 액센트 |
| `--destructive` | `oklch(0.6 0.22 25)` | `oklch(0.7 0.2 25)` | 오류/삭제 (빨강) |
| `--success` | `oklch(0.68 0.16 158)` | `oklch(0.72 0.16 158)` | 성공 (녹색) |
| `--warning` | `oklch(0.75 0.15 70)` | `oklch(0.78 0.15 70)` | 경고 (주황) |
| `--surface` | `oklch(1 0 0)` | `oklch(0.19 0.03 260)` | 카드/패널 표면 |
| `--surface-muted` | `oklch(0.97 0.005 250)` | `oklch(0.22 0.03 260)` | 음영 표면 |
| `--border` | `oklch(0.9 0.008 250)` | `oklch(1 0 0 / 10%)` | 테두리 |
| `--ring` | `oklch(0.54 0.22 264)` | `oklch(0.551 0.027 264.364)` | 포커스 링 |

### 2.2 상태색 5종 (도메인 의미)

| CSS 변수 | Tailwind 클래스 | 값 (라이트) | 상태 |
|----------|----------------|------------|------|
| `--color-status-done` | `bg-status-done` | `var(--success)` = oklch(0.68 0.16 158) | 완료 |
| `--color-status-running` | `bg-status-running` | `var(--primary)` = oklch(0.54 0.22 264) | 진행 중 |
| `--color-status-pending` | `bg-status-pending` | `var(--border)` = oklch(0.9 0.008 250) | 대기 |
| `--color-status-failed` | `bg-status-failed` | `var(--destructive)` = oklch(0.6 0.22 25) | 실패 |
| `--color-status-empty` | `bg-status-empty` | `var(--border)` = oklch(0.9 0.008 250) | 없음(planned) |

**원칙**: 값이 아니라 의미(완료·진행·대기·실패·없음)로 정의. 색상만으로 상태를 전달하지 않는다(배지 라벨 필수).

---

## 3. 타이포그래피

| 항목 | 값 |
|------|-----|
| `--font-sans` | "Inter", ui-sans-serif, system-ui, sans-serif |
| `--font-mono` | "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo |
| 폰트 소스 | Google Fonts CDN (`app.html` link 태그) |
| 기본 antialiasing | `-webkit-font-smoothing: antialiased` |

### 타이포 스케일 (소스 추출)

| 용도 | Tailwind 클래스 | 크기 |
|------|----------------|------|
| 페이지 제목 | `text-2xl font-bold` | 1.5rem / 700 |
| 섹션 제목 | `text-lg font-semibold` | 1.125rem / 600 |
| 카드 제목 | `text-base font-medium` | 1rem / 500 |
| 본문 | `text-sm` | 0.875rem / 400 |
| 보조 | `text-xs text-muted-foreground` | 0.75rem / 400 |
| 배지 | `text-xs font-medium` | 0.75rem / 500 |
| 모노 | `font-mono text-sm` | 0.875rem |

---

## 4. 간격 패턴

| 패턴 | 값 | 용도 |
|------|-----|------|
| 카드 내부 패딩 | `p-4` / `p-6` | 카드·패널 |
| 섹션 여백 | `space-y-6` | 페이지 내 섹션 간격 |
| 그리드 간격 | `gap-4` | 카드 그리드 |
| 아이템 간격 | `gap-2` / `gap-3` | 인라인 요소 |
| 콘텐츠 최대 폭 | `max-w-7xl mx-auto` | 레이아웃 컨테이너 |
| 페이지 측면 패딩 | `px-4 sm:px-6` | 반응형 여백 |

---

## 5. 레이아웃

| 항목 | 구현 |
|------|------|
| 셸 구조 | `flex min-h-screen flex-col` |
| 헤더 | `sticky top-0 z-50 border-b bg-surface` |
| 탭 네비게이션 | `border-t` 하단에 탭 목록 |
| 메인 콘텐츠 | `max-w-7xl mx-auto flex-1 px-4 py-6` |
| z-index 체계 | 헤더 50, 드롭다운 40, 모달 60 |

---

## 6. 보더 & 그림자

| 항목 | 값 |
|------|-----|
| 기본 radius | `--radius: 0.25rem` (4px) |
| `radius-sm` | `calc(var(--radius) - 4px)` = 0px |
| `radius-md` | `calc(var(--radius) - 2px)` = 2px |
| `radius-lg` | `var(--radius)` = 4px |
| `radius-xl` | `calc(var(--radius) + 4px)` = 8px |
| 카드 보더 | `border border-border` |
| 포커스 링 | `ring-2 ring-ring ring-offset-2` |
| 그림자 | 소스 미사용 (flat design) |

---

## 7. 애니메이션

| 항목 | 값 |
|------|-----|
| 진행 중 펄스 | `animate-status-pulse` — 2s cubic-bezier(0.16,1,0.3,1) |
| 트랜지션 | `transition-colors duration-200` (기본 hover) |
| 키워드 | `pulse-ring` @keyframes (scale 0.95→1.1→0.95, opacity 0.5→0.9) |

---

## 8. 반응형 브레이크포인트 (Tailwind 기본)

| 브레이크포인트 | 폭 | 주 변화 |
|-------------|-----|---------|
| `sm` | ≥ 640px | 측면 패딩 확대 (`px-6`) |
| `md` | ≥ 768px | 2열 그리드 진입 |
| `lg` | ≥ 1024px | 사이드패널 표시, 3열 그리드 |
| `xl` | ≥ 1280px | max-w-7xl 활성화 |

**원칙**: 모바일 우선 (320px 이상 단일 컬럼 → 너비 증가에 따라 확장).

---

## 9. 인터랙션

| 상태 | 구현 패턴 |
|------|----------|
| hover | `hover:bg-surface-muted` / `hover:text-foreground` |
| focus | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary` |
| active 탭 | `border-b-2 border-primary text-primary` |
| 비활성 탭 | `border-transparent text-muted-foreground hover:text-foreground` |
| disabled | `opacity-50 pointer-events-none` |
| 예정(planned) | `border-dashed text-muted-foreground` |

---

## 10. 아이콘

| 항목 | 값 |
|------|-----|
| 라이브러리 | `lucide-svelte` (소스: `lucide-react` 대응) |
| 기본 크기 | `size-4` (16px) |
| 보조 크기 | `size-5` (20px), `size-6` (24px) |
| 색상 | `currentColor` (부모 text 색 상속) |

---

## 접근성 원칙

- 탭 네비: `role="tablist"` + `aria-selected` + `aria-current="page"`
- icon-only 버튼: `aria-label` 필수
- 상태 배지: 색상 + 텍스트 라벨 병용
- 포커스 표시: `focus-visible:outline` (모든 인터랙티브 요소)
- 색상만으로 상태 전달 금지

---

## CSS 변수 → Tailwind 클래스 대응

| CSS 변수 | Tailwind 유틸리티 예시 |
|----------|----------------------|
| `--color-background` | `bg-background` |
| `--color-primary` | `bg-primary`, `text-primary`, `border-primary` |
| `--color-status-done` | `bg-status-done`, `text-status-done` |
| `--color-status-running` | `bg-status-running`, `text-status-running` |
| `--color-muted-foreground` | `text-muted-foreground` |
| `--color-surface` | `bg-surface` |
| `--color-surface-muted` | `bg-surface-muted` |
| `--color-border` | `border-border` |
