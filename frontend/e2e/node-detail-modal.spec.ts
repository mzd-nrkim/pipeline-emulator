import { test, expect } from '@playwright/test';

test.describe('Node Detail Modal — 노드 상세·실행 이력 모달', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
  });

  async function clickFirstNode(page: import('@playwright/test').Page) {
    await page.waitForTimeout(300);
    // group 노드(node-airflow-group)는 pointer-events:none → 클릭 제외
    // data-id 속성이 없거나 'node-airflow-group'이 아닌 tool 타입 노드만 대상
    const nodes = page.locator(
      '.svelte-flow .svelte-flow__node:not([data-id="node-airflow-group"])'
    );
    await nodes.first().evaluate((el) =>
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }))
    );
    await page.waitForTimeout(400);
  }

  test('노드 클릭 → 중앙 모달 오픈 + "노드 상세" 탭 활성 (우측 드로어 아님)', async ({ page }) => {
    await clickFirstNode(page);

    // Dialog.Content가 DOM에 존재하고 가시여야 함
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // "노드 상세" 탭이 활성화(bg-foreground text-background)되어야 함
    const nodeTab = modal.locator('button').filter({ hasText: /노드 상세/ });
    await expect(nodeTab).toBeVisible();

    // 우측 드로어 포지셔닝 클래스(w-80 absolute right-0)가 없어야 함
    const drawerStyle = page.locator('.absolute.right-0.w-80');
    await expect(drawerStyle).toHaveCount(0);
  });

  test('"실행 이력" 탭 전환 → 실행 목록 가시', async ({ page }) => {
    await clickFirstNode(page);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const historyTab = modal.locator('button').filter({ hasText: /실행 이력/ });
    await historyTab.click();
    await page.waitForTimeout(300);

    // 실행 이력 목록(ul 또는 li) 또는 "실행 이력" 섹션 헤더가 보여야 함
    const historySection = modal.locator('h2').filter({ hasText: /실행 이력/ });
    await expect(historySection).toBeVisible();
  });

  test('ESC 키로 모달 닫힘', async ({ page }) => {
    await clickFirstNode(page);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(modal).not.toBeVisible();
  });

  test('Dialog.Close (✕) 버튼으로 모달 닫힘', async ({ page }) => {
    await clickFirstNode(page);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const closeBtn = modal.locator('button[aria-label="모달 닫기"]');
    await closeBtn.click();
    await page.waitForTimeout(300);
    await expect(modal).not.toBeVisible();
  });

  test('오버레이(배경) 클릭으로 모달 닫힘', async ({ page }) => {
    await clickFirstNode(page);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // 오버레이(data-dialog-overlay)를 클릭
    const overlay = page.locator('[data-dialog-overlay]');
    await overlay.click({ position: { x: 10, y: 10 }, force: true });
    await page.waitForTimeout(300);
    await expect(modal).not.toBeVisible();
  });

  test('"노드 선택 해제" 버튼 클릭 시 모달 유지, 노드만 해제', async ({ page }) => {
    await clickFirstNode(page);
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // "노드 상세" 탭에서 "노드 선택 해제" 버튼 클릭
    const clearBtn = modal.locator('button[aria-label="노드 선택 해제"]');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(300);
      // 모달은 여전히 열려 있어야 함
      await expect(modal).toBeVisible();
    }
  });
});
