import { test, expect } from '@playwright/test';

test.describe('고아 노드 토글 — 연결 없는 노드 표시 옵션', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
  });

  test('토글 버튼이 화면에 표시된다', async ({ page }) => {
    const btn = page.getByRole('button', { name: '연결 없는 노드 표시' });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('data 뷰: 토글 ON 시 기본 노드 수보다 많아진다', async ({ page }) => {
    const defaultCount = await page.locator('.svelte-flow .svelte-flow__node').count();

    await page.getByRole('button', { name: '연결 없는 노드 표시' }).click();
    await page.waitForTimeout(300);

    const withOrphansCount = await page.locator('.svelte-flow .svelte-flow__node').count();
    expect(withOrphansCount).toBeGreaterThan(defaultCount);
  });

  test('infra 뷰: 토글 ON 시 기본 노드 수보다 많아진다', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(300);
    const defaultCount = await page.locator('.svelte-flow .svelte-flow__node').count();

    await page.getByRole('button', { name: '연결 없는 노드 표시' }).click();
    await page.waitForTimeout(300);

    const withOrphansCount = await page.locator('.svelte-flow .svelte-flow__node').count();
    expect(withOrphansCount).toBeGreaterThan(defaultCount);
  });

  test('토글 OFF(기본): data 뷰 기존 회귀 — 노드 수가 양수', async ({ page }) => {
    const count = await page.locator('.svelte-flow .svelte-flow__node').count();
    expect(count).toBeGreaterThan(0);
  });

  test('토글 상태가 data→infra 뷰 전환 간 보존된다', async ({ page }) => {
    const btn = page.getByRole('button', { name: '연결 없는 노드 표시' });

    await btn.click();
    await page.waitForTimeout(200);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: '데이터흐름', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});
