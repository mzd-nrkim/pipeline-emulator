import { test, expect } from '@playwright/test';

test.describe('Infra View — 인프라 연결 뷰', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
  });

  test('인프라 뷰 전환: "인프라" 버튼 클릭 → "인프라 연결 뷰" 배지 가시성', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=인프라 연결 뷰')).toBeVisible({ timeout: 3000 });
  });

  test('연결 그래프 (고립 조각 아님): 인프라 뷰에서 edge가 1개 이상 존재', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);
    const edgeCount = await page.locator('.svelte-flow__edge').count();
    expect(edgeCount).toBeGreaterThan(0);
  });

  test('es 비-좌상단 단언: Elasticsearch 노드가 translate(0px, 0px) 위치가 아님', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);
    const transform = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.svelte-flow__node')];
      const es = nodes.find(n => n.innerText.includes('lastic') || n.innerText.includes('ES'));
      return es?.style.transform ?? null;
    });
    // ES 노드가 없으면 skip (인프라 뷰에 ES가 없는 경우)
    if (transform === null) {
      test.skip();
      return;
    }
    expect(transform).not.toBe('translate(0px, 0px)');
    expect(transform).not.toBe('translate(0, 0)');
  });

  test('데이터흐름 복귀: 인프라 뷰 후 "데이터흐름" 버튼 클릭 → "인프라 연결 뷰" 배지 사라짐', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=인프라 연결 뷰')).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: '데이터흐름', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=인프라 연결 뷰')).not.toBeVisible();
  });
});
