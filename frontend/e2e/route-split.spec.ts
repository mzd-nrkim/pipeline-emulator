import { test, expect } from '@playwright/test';

test.describe('route split smoke tests', () => {
  test('/sample renders mock overview without crash', async ({ page }) => {
    await page.goto('/sample');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toContainText('PipeScale');
  });

  test('/sample/pipeline renders mock data', async ({ page }) => {
    await page.goto('/sample/pipeline');
    await expect(page.locator('main')).toBeVisible();
  });

  test('/sample/documents renders mock data', async ({ page }) => {
    await page.goto('/sample/documents');
    await expect(page.locator('main')).toBeVisible();
  });

  test('/sample/search renders mock data', async ({ page }) => {
    await page.goto('/sample/search');
    await expect(page.locator('main')).toBeVisible();
  });

  test('/real/* shows connection-wait stub without crash', async ({ page }) => {
    await page.goto('/real');
    await expect(page.getByText('백엔드 연결 대기')).toBeVisible();
  });

  test('/real/pipeline shows connection-wait stub', async ({ page }) => {
    await page.goto('/real/pipeline');
    await expect(page.getByText('백엔드 연결 대기')).toBeVisible();
  });

  test('header toggle preserves subpath when switching modes', async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.getByRole('link', { name: '실제' }).click();
    await expect(page).toHaveURL('/real/pipeline');
    await page.getByRole('link', { name: '샘플' }).click();
    await expect(page).toHaveURL('/sample/pipeline');
  });

  test('/ redirects to /sample', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/sample');
  });

  test('/foo/pipeline returns 404', async ({ page }) => {
    const response = await page.goto('/foo/pipeline');
    expect(response?.status()).toBe(404);
  });
});
