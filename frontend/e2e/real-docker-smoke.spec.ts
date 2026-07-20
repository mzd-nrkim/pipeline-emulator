import { test, expect } from '@playwright/test';

test.describe('real-docker smoke — real 트리거 → dag_run_id 단언', () => {
  // Airflow 미기동 시 skip 처리
  const UI_BACKEND = 'http://localhost:8001';
  const AIRFLOW = 'http://localhost:8080';

  test('node-presidio real 트리거 → HTTP 200 + 유효 dag_run_id', async ({ page }) => {
    // Airflow 헬스체크
    const health = await page.request.get(`${AIRFLOW}/health`).catch(() => null);
    if (!health || health.status() !== 200) {
      test.skip();
      return;
    }

    const res = await page.request.post(`${UI_BACKEND}/nodes/node-presidio/trigger`, {
      data: {},
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('dag_run_id');
    expect(typeof body.dag_run_id).toBe('string');
    expect(body.dag_run_id.length).toBeGreaterThan(0);

    // teardown: 생성된 dag_run 삭제
    await page.request.delete(
      `${AIRFLOW}/api/v1/dags/silver_2_masking/dagRuns/${encodeURIComponent(body.dag_run_id)}`,
      { headers: { Authorization: 'Basic ' + btoa('admin:admin') } },
    );
  });

  test('node-es-search real 트리거 → HTTP 200 + 유효 dag_run_id (gold_6_es_indexing)', async ({ page }) => {
    // Airflow 헬스체크
    const health = await page.request.get(`${AIRFLOW}/health`).catch(() => null);
    if (!health || health.status() !== 200) {
      test.skip();
      return;
    }

    // gold_6_es_indexing unpause (테스트 환경에서 paused일 수 있음)
    await page.request.patch(`${AIRFLOW}/api/v1/dags/gold_6_es_indexing`, {
      data: { is_paused: false },
      headers: { Authorization: 'Basic ' + btoa('admin:admin') },
    });

    const res = await page.request.post(`${UI_BACKEND}/nodes/node-es-search/trigger`, {
      data: {},
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('dag_run_id');
    expect(typeof body.dag_run_id).toBe('string');
    expect(body.dag_run_id.length).toBeGreaterThan(0);
    expect(body.node_id).toBe('node-es-search');

    // teardown: 생성된 dag_run 삭제
    await page.request.delete(
      `${AIRFLOW}/api/v1/dags/gold_6_es_indexing/dagRuns/${encodeURIComponent(body.dag_run_id)}`,
      { headers: { Authorization: 'Basic ' + btoa('admin:admin') } },
    );
  });
});

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
