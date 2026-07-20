import { test, expect } from '@playwright/test';

test.describe('deployStatus absent — 노드 카드 점선 테두리', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    // node-kibana(absent)는 infra 뷰에만 렌더됨 (dependency 채널 전용)
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);
  });

  test('absent 노드(.status-absent)의 .node-card에 border-style: dashed 적용', async ({
    page,
  }) => {
    const absentCard = page.locator('.status-absent .node-card').first();
    await expect(absentCard).toBeAttached({ timeout: 5000 });

    const borderStyle = await absentCard.evaluate(
      (el) => getComputedStyle(el).borderStyle,
    );
    expect(borderStyle).toBe('dashed');
  });

  test('absent 노드 wrapper(.status-absent)에는 opacity < 1 적용', async ({
    page,
  }) => {
    const absentWrapper = page.locator('.status-absent').first();
    await expect(absentWrapper).toBeAttached({ timeout: 5000 });

    const opacity = await absentWrapper.evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    expect(parseFloat(opacity)).toBeLessThan(1);
  });
});
