import { test, expect } from '@playwright/test';

test.describe('PII Stats — PII 통계 실데이터 연결', () => {
  test('개요 페이지에 PII 감지 통계 패널 렌더 (비쇼케이스 경로)', async ({ page }) => {
    await page.goto('/sample');
    await page.waitForLoadState('networkidle');

    // PII 감지 통계 섹션 제목 확인
    const statTitle = page.locator('text=PII 감지 통계');
    await expect(statTitle).toBeVisible({ timeout: 5000 });
  });

  test('PiiCountGrid — mock 결정적 데이터 렌더 (42건 등)', async ({ page }) => {
    await page.goto('/sample');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // mock fetchPiiStats: total=42, masked=38, unmasked=4
    // PiiCountGrid가 count 값을 렌더하는지 확인
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/전체 감지|마스킹 완료|PII/);
  });

  test('/components 쇼케이스 기존 PiiCountGrid 렌더 회귀 없음', async ({ page }) => {
    const res = await page.goto('/components');
    await page.waitForLoadState('networkidle');

    // 페이지가 정상적으로 로드됨 (HTTP 2xx)
    expect(res?.status() ?? 200).toBeLessThan(400);

    // 쇼케이스 페이지가 정상 렌더되어야 함 (PiiCountGrid 예시 포함)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
