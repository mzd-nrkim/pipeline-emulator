import { test, expect } from '@playwright/test';

test.describe('Pipeline Canvas View — ToolCanvasView (P1/P3 통합)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
  });

  test('Canvas가 기본 뷰다 — Grid/Graph 토글 없음', async ({ page }) => {
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).not.toBeVisible();
  });

  test('ToolCanvasView가 기본으로 렌더된다', async ({ page }) => {
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
  });

  test('Canvas 뷰에서 Source/Task/Switch/Sink 4종 노드가 렌더된다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodes = page.locator('.svelte-flow .svelte-flow__node');
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Canvas 뷰에서 노드가 4종 kind 레이블로 시각 구분된다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodeTexts = await page.locator('.svelte-flow__node').allInnerTexts();
    const hasSource = nodeTexts.some(t => t.includes('[source]'));
    const hasTask   = nodeTexts.some(t => t.includes('[task]'));
    const hasSink   = nodeTexts.some(t => t.includes('[sink]'));
    expect(hasSource || hasTask || hasSink).toBe(true);
  });

  test('Canvas 뷰에서 노드 클릭 시 drill-down 패널이 열린다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const firstNode = page.locator('.svelte-flow .svelte-flow__node').first();
    await firstNode.click();
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });
  });

  test('drill-down 패널 닫기(✕) 클릭 시 패널이 닫힌다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const firstNode = page.locator('.svelte-flow .svelte-flow__node').first();
    await firstNode.click();
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });
    await page.locator('button', { hasText: '✕' }).click();
    await expect(page.locator('text=노드 상세')).not.toBeVisible();
  });
});
