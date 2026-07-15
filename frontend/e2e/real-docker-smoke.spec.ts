import { test, expect } from '@playwright/test';

test.describe('real-docker smoke — ui-backend /documents', () => {
  test('ui-backend health check', async ({ page }) => {
    let reachable = true;
    const response = await page.request.get('http://localhost:8001/health').catch(() => {
      reachable = false;
      return null;
    });
    if (!reachable || !response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(200);
  });

  test('/documents endpoint 응답 — status 200, JSON 배열', async ({ page }) => {
    let reachable = true;
    const response = await page.request.get('http://localhost:8001/documents').catch(() => {
      reachable = false;
      return null;
    });
    if (!reachable || !response) {
      test.skip();
      return;
    }
    expect(response.status()).toBe(200);
    const body = await response.json();
    // seaweedfs unhealthy 시 빈 배열도 허용
    expect(Array.isArray(body)).toBe(true);
  });

  test('/real/pipeline 페이지 접근 가능 — 크래시 없음', async ({ page }) => {
    // JS 에러 수집
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/real/pipeline');
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 페이지 body가 비어있지 않으면 크래시 없이 렌더된 것으로 판정
    // (test 모드에서 PUBLIC_UI_BACKEND_URL=19999 → real adapter 연결 실패 → 로딩 상태 or 에러 UI 표시가 정상)
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.length).toBeGreaterThan(0);

    // 치명 JS 에러 없음 (TypeError: Cannot read 류 실행시간 크래시)
    const fatalErrors = jsErrors.filter(e => e.includes('TypeError') && e.includes('Cannot read'));
    expect(fatalErrors).toHaveLength(0);
  });
});
