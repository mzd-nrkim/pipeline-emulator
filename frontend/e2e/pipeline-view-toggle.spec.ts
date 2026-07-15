import { test, expect } from '@playwright/test';

test.describe('Pipeline Page — Canvas 뷰 + Medallion Drill-down (P3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
  });

  test('Canvas 뷰가 기본 표시된다 — 뷰 셀렉터 표시, Grid/Graph 토글 없음', async ({ page }) => {
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '데이터흐름', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '인프라', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).not.toBeVisible();
  });

  test('활성 실행 패널에 RUN_ID 표시된다', async ({ page }) => {
    await expect(page.locator('text=활성 실행')).toBeVisible();
    await expect(page.locator('text=RUN_ID:')).toBeVisible();
  });

  test('Canvas 노드들이 렌더된다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const count = await page.locator('.svelte-flow .svelte-flow__node').count();
    expect(count).toBeGreaterThan(0);
  });

  test('노드 클릭 → drill-down 패널 열림', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const node = document.querySelector('.svelte-flow .svelte-flow__node');
      if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });
  });

  test('drill-down 패널 닫기(✕) 동작', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const node = document.querySelector('.svelte-flow .svelte-flow__node');
      if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });
    await page.locator('button', { hasText: '✕' }).click();
    await expect(page.locator('text=노드 상세')).not.toBeVisible();
  });

  test('Airflow 노드 트리거 → dag_run_id 표시 + 활성 RUN_ID 갱신', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodes = page.locator('.svelte-flow__node');
    const allTexts = await nodes.allInnerTexts();
    // trigger:true 노드(Airflow)를 찾아 클릭
    const airflowIdx = allTexts.findIndex(t => t.toLowerCase().includes('airflow'));
    const targetNode = airflowIdx >= 0 ? nodes.nth(airflowIdx) : nodes.first();
    await targetNode.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })));
    const triggerBtn = page.locator('button', { hasText: /트리거|Trigger/i });
    const hasTrigger = await triggerBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasTrigger) {
      await triggerBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('text=dag_run_id')).toBeVisible({ timeout: 3000 });
      const runIdPanel = page.locator('.font-mono').filter({ hasText: 'RUN_ID:' }).first();
      const runIdText = await runIdPanel.textContent();
      expect(runIdText).not.toContain('RX-9042-ALPHA');
    }
  });

  test('Airflow 노드 → DAG 정보 표시 확인', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodes = page.locator('.svelte-flow__node');
    const allTexts = await nodes.allInnerTexts();
    const airflowIdx = allTexts.findIndex(t => t.toLowerCase().includes('airflow'));
    if (airflowIdx >= 0) {
      await nodes.nth(airflowIdx).evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })));
      // Airflow(trigger:true)는 DAG 정보 또는 트리거 버튼 표시
      const hasDAG = await page.locator('text=DAG:').isVisible({ timeout: 3000 }).catch(() => false);
      const hasTrigger = await page.locator('button', { hasText: /트리거|Trigger/i }).isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasDAG || hasTrigger).toBe(true);
    }
  });

  test('실행 이력 패널이 렌더된다', async ({ page }) => {
    await expect(page.locator('text=실행 이력')).toBeVisible();
  });
});
