import { test, expect } from '@playwright/test';

test.describe('SSE Subscription — 파이프라인 상태 구독 배선', () => {
  test('mock 모드 구독 배선 — 콘솔 오류 없음', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 8000 });
    await page.waitForTimeout(1000);

    // mock subscribePipelineStatus는 noop → 오류 없어야 함
    const sseErrors = errors.filter(e =>
      e.toLowerCase().includes('sse') || e.toLowerCase().includes('eventsource')
    );
    expect(sseErrors).toHaveLength(0);
  });

  test('mock 모드 — liveStageCounts 초기값 {} → 캔버스 렌더 정상 (노드 수 유지)', async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 8000 });

    // 캔버스가 정상 렌더 (노드 존재)
    const nodeCount = await page.locator('.svelte-flow .svelte-flow__node').count();
    expect(nodeCount).toBeGreaterThan(0);

    // SVG flow 캔버스 정상 확인
    const flowContainer = page.locator('.svelte-flow');
    await expect(flowContainer).toBeAttached();
  });
});
