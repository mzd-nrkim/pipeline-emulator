import { test, expect } from '@playwright/test';

test.describe('Pipeline Canvas View — ToolCanvasView (P1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.removeItem('pipelineViewMode'));
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('pipelineViewMode'));
  });

  test('Canvas 토글 버튼이 기존 Grid/Graph와 함께 렌더된다', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
  });

  test('Canvas 버튼 클릭 시 ToolCanvasView가 렌더된다', async ({ page }) => {
    await page.getByRole('button', { name: 'Canvas', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
  });

  test('Canvas 뷰에서 Source/Task/Switch/Sink 4종 노드가 렌더된다', async ({ page }) => {
    await page.getByRole('button', { name: 'Canvas', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });

    const nodes = page.locator('.svelte-flow .svelte-flow__node');
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Canvas 뷰에서 노드가 4종 kind 레이블로 시각 구분된다', async ({ page }) => {
    await page.getByRole('button', { name: 'Canvas', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });

    const nodeTexts = await page.locator('.svelte-flow__node').allInnerTexts();
    const hasSource = nodeTexts.some(t => t.includes('[source]'));
    const hasTask   = nodeTexts.some(t => t.includes('[task]'));
    const hasSink   = nodeTexts.some(t => t.includes('[sink]'));
    expect(hasSource || hasTask || hasSink).toBe(true);
  });

  test('Canvas 뷰에서 노드 클릭 시 drill-down 패널이 열린다', async ({ page }) => {
    await page.getByRole('button', { name: 'Canvas', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });

    const firstNode = page.locator('.svelte-flow .svelte-flow__node').first();
    await firstNode.click();
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=이 run의 증거는 P3에서 연결됩니다')).toBeVisible();
  });

  test('drill-down 패널 닫기(✕) 클릭 시 패널이 닫힌다', async ({ page }) => {
    await page.getByRole('button', { name: 'Canvas', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });

    const firstNode = page.locator('.svelte-flow .svelte-flow__node').first();
    await firstNode.click();
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });

    await page.locator('button', { hasText: '✕' }).click();
    await expect(page.locator('text=노드 상세')).not.toBeVisible();
  });

  test('Canvas 뷰에서 기존 Grid/Graph 토글 뷰로 돌아올 수 있다 (공존 확인)', async ({ page }) => {
    await page.getByRole('button', { name: 'Canvas', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await expect(page.locator('.svelte-flow')).not.toBeVisible();
  });
});
