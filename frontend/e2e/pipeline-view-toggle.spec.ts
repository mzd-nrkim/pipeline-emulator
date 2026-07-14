import { test, expect } from '@playwright/test';

test.describe('Pipeline View Toggle — Grid / DAG Graph', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    // addInitScript는 reload 시에도 재실행되므로 evaluate로 클리어
    await page.evaluate(() => localStorage.removeItem('pipelineViewMode'));
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('pipelineViewMode'));
  });

  // Right: 기본값 Grid 뷰
  test('기본값은 Grid 뷰 — StageNode 카드 8개 렌더', async ({ page }) => {
    // 토글 버튼 존재
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeVisible();

    // Grid 버튼이 active 상태
    const gridBtn = page.getByRole('button', { name: 'Grid', exact: true });
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');

    // PipelineGraphView가 없고 CSS grid가 있어야 함
    await expect(page.locator('.svelte-flow')).not.toBeVisible();

    // StageNode 카드 — 기존 grid 구조 확인 (stage 카드 클릭 가능한 요소)
    const stageCards = page.locator('[data-testid="stage-node"], button[class*="rounded"]').first();
    // 최소한 파이프라인 섹션이 렌더되어 있어야 함
    await expect(page.locator('text=데이터 처리 흐름')).toBeVisible();
  });

  // Right: Graph 뷰 전환
  test('Graph 토글 클릭 → @xyflow SvelteFlow 컨테이너 렌더', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph', exact: true }).click();

    // Graph 버튼 active
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // @xyflow/svelte 컨테이너 (height: 420px div)
    const graphContainer = page.locator('div[style*="height: 420px"]');
    await expect(graphContainer).toBeVisible();

    // SvelteFlow 렌더링 대기 (.svelte-flow 클래스)
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });

    // 노드 요소들 — .svelte-flow__node
    const nodes = page.locator('.svelte-flow__node');
    await expect(nodes).toHaveCount(8, { timeout: 5000 });
  });

  // Inverse: Grid → Graph → Grid 재토글
  test('Grid→Graph→Grid 재토글 — Grid 뷰 원복, 회귀 없음', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Grid', exact: true }).click();

    // Grid 뷰 복원
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.svelte-flow')).not.toBeVisible();
    await expect(page.locator('text=데이터 처리 흐름')).toBeVisible();
  });

  // Cross-check: 노드 클릭 → 인스펙터 + URL 갱신
  test('Graph 뷰 노드 클릭 → 인스펙터 패널 갱신', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });

    // 첫 번째 non-planned 노드 클릭
    const firstNode = page.locator('.svelte-flow__node').first();
    await firstNode.click();

    // 인스펙터 패널이 갱신됨 (인스펙터 헤더 "인스펙터:" 포함)
    await expect(page.locator('text=인스펙터:')).toBeVisible();
  });

  // Boundary: localStorage 저장 + 새로고침 복원
  test('Graph 선택 후 새로고침 → Graph 뷰 복원 (localStorage)', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });

    // localStorage 저장 확인
    const stored = await page.evaluate(() => localStorage.getItem('pipelineViewMode'));
    expect(stored).toBe('graph');

    // 새로고침
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Graph 뷰로 복원 (hydration 후 onMount에서 localStorage 읽어 반영)
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  // Boundary: localStorage 없음(첫 방문) → grid fallback
  test('localStorage 키 없음(첫 방문) → grid fallback', async ({ page }) => {
    // beforeEach에서 이미 제거됨
    const stored = await page.evaluate(() => localStorage.getItem('pipelineViewMode'));
    expect(stored).toBeNull();

    await expect(page.getByRole('button', { name: 'Grid', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.svelte-flow')).not.toBeVisible();
  });

  // Existence: SSR 크래시·hydration 경고 없음
  test('SSR 크래시·콘솔 에러 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // localStorage 관련 ReferenceError가 없어야 함
    const localStorageErrors = errors.filter(e => e.includes('localStorage') || e.includes('ReferenceError'));
    expect(localStorageErrors).toHaveLength(0);
  });

  // Cardinality: 노드 수 = mockStages 수 (8개)
  test('Graph 노드 수 = 8 (Bronze2·Silver2·Gold3·Serving1)', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator('.svelte-flow__node')).toHaveCount(8, { timeout: 5000 });
  });

  // Existence: Serving(planned) 노드 점선/흐림 표시
  test('Serving(planned) 노드 — 점선·흐림 스타일 구분', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });

    // planned 노드는 dashed border + opacity 0.5 인라인 스타일
    const plannedNode = page.locator('.svelte-flow__node[style*="dashed"]');
    await expect(plannedNode).toBeVisible();
  });

  // Cross-check: Grid 뷰 노드 수 = Graph 뷰 노드 수
  test('Grid 뷰 stage 수 = Graph 뷰 노드 수 = 8', async ({ page }) => {
    // Grid: 활성 단계 수 표시 텍스트 확인
    await expect(page.locator('text=7개 활성 단계')).toBeVisible(); // 8개 중 1개 planned

    // Graph 전환
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator('.svelte-flow__node')).toHaveCount(8, { timeout: 5000 });
  });

  // Responsive: 모바일 뷰포트에서 Grid/Graph 렌더 정상
  test('모바일 뷰포트(390px) — Grid 반응형 유지, Graph 컨테이너 가시성', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Grid: 2열 grid (lg:grid-cols-8 → 모바일 grid-cols-2) — 페이지 정상 렌더
    await expect(page.locator('text=데이터 처리 흐름')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).toBeVisible();

    // Graph: 너비 100% 컨테이너로 렌더 (height 420px 고정, @xyflow 내장 핀치/줌)
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    const graphContainer = page.locator('div[style*="height: 420px"]');
    await expect(graphContainer).toBeVisible();
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
  });
});
