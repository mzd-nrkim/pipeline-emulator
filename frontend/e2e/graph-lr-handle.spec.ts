import { test, expect } from '@playwright/test';

test.describe('Graph LR Handle — 노드 handle 좌우(LR) 위치 확인', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
  });

  test('Data 뷰(기본): handle이 left/right이고 top/bottom은 없음', async ({ page }) => {
    const leftCount = await page.locator('.svelte-flow__handle-left').count();
    const rightCount = await page.locator('.svelte-flow__handle-right').count();
    const topCount = await page.locator('.svelte-flow__handle-top').count();
    const bottomCount = await page.locator('.svelte-flow__handle-bottom').count();

    expect(leftCount).toBeGreaterThan(0);
    expect(rightCount).toBeGreaterThan(0);
    expect(topCount).toBe(0);
    expect(bottomCount).toBe(0);
  });

  test('Infra 뷰 전환 후: handle이 left/right이고 top/bottom은 없음', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);

    const leftCount = await page.locator('.svelte-flow__handle-left').count();
    const rightCount = await page.locator('.svelte-flow__handle-right').count();
    const topCount = await page.locator('.svelte-flow__handle-top').count();
    const bottomCount = await page.locator('.svelte-flow__handle-bottom').count();

    expect(leftCount).toBeGreaterThan(0);
    expect(rightCount).toBeGreaterThan(0);
    expect(topCount).toBe(0);
    expect(bottomCount).toBe(0);
  });

  test('Data 뷰: animated 엣지(또는 일반 엣지)가 1개 이상 존재', async ({ page }) => {
    const animatedCount = await page.locator('.svelte-flow__edge.animated').count();
    if (animatedCount > 0) {
      expect(animatedCount).toBeGreaterThan(0);
    } else {
      const edgeCount = await page.locator('.svelte-flow__edge').count();
      expect(edgeCount).toBeGreaterThan(0);
    }
  });
});
