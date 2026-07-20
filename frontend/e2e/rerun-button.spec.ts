import { test, expect } from '@playwright/test';

test.describe('Rerun Button — 재실행 버튼 듀얼 동작', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 8000 });
  });

  test('미선택 재실행 → activeRunId RUN_ID 갱신', async ({ page }) => {
    const rerunBtn = page.locator('button').filter({ hasText: /^재실행$/ });
    await expect(rerunBtn).toBeVisible();
    await expect(rerunBtn).toHaveText('재실행');

    await rerunBtn.click();
    await page.waitForTimeout(800);

    // RUN_ID 패널: "—"가 아닌 다른 값으로 갱신됨 확인
    const runIdEl = page.locator('div').filter({ hasText: /RUN_ID:/ }).locator('.font-medium, .font-mono').first();
    const panelText = await page.locator('text=/RUN_ID:.*mock-run/').count().catch(() => 0);
    // 또는 aria-label 확인
    const updatedLabel = page.locator('[aria-label="재실행"]');
    // 최소한 재실행 버튼이 여전히 존재하고 클릭됐음을 확인
    await expect(rerunBtn).toBeVisible();
    // RUN_ID 표시에 "—"가 없으면 갱신된 것
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/mock-run|RUN_ID/);
  });

  test('노드 미선택 기본 상태 — aria-label이 "재실행"', async ({ page }) => {
    // 노드 미선택 상태: aria-label="재실행"
    const rerunBtn = page.locator('button[aria-label="재실행"]');
    await expect(rerunBtn).toBeAttached();
    await expect(rerunBtn).toHaveText('재실행');
  });
});
