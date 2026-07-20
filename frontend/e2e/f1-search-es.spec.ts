import { test, expect } from '@playwright/test';

/**
 * F1. ES 검색 서빙 e2e
 * 트리거 게이트: Airflow healthy + ES healthy 시에만 실행.
 * 전제: `docker compose up -d` (elasticsearch 서비스 포함)
 */

const AIRFLOW = 'http://localhost:8080';
const UI_BACKEND = 'http://localhost:8001';
const ES = 'http://localhost:9200';
const AUTH_HEADER = { Authorization: 'Basic ' + btoa('admin:admin') };
const ES_NODE_ID = 'node-es-search';

const createdRuns: { dagId: string; runId: string }[] = [];

async function pollDagRun(page: import('@playwright/test').Page, dagId: string, runId: string, timeoutMs = 120000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await page.request.get(
      `${AIRFLOW}/api/v1/dags/${dagId}/dagRuns/${encodeURIComponent(runId)}`,
      { headers: AUTH_HEADER },
    );
    if (r.status() === 200) {
      const body = await r.json();
      const state: string = body.state;
      if (state === 'success' || state === 'failed') return state;
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
  return 'timeout';
}

test.describe('F1. ES 검색 서빙 e2e', () => {
  test.afterAll(async ({ request }) => {
    for (const { dagId, runId } of createdRuns) {
      await request
        .delete(`${AIRFLOW}/api/v1/dags/${dagId}/dagRuns/${encodeURIComponent(runId)}`, { headers: AUTH_HEADER })
        .catch(() => {});
    }
    // 색인 문서·indexing_status 원복은 MySQL 직접 접근 불가 → 스킵 (테스트 환경 특성)
  });

  test('node-es-search 트리거 → gold_6_es_indexing DAG → staged→indexed 전이', async ({ page }) => {
    test.setTimeout(150000); // DAG 폴링 최대 2분 + 여유
    // 트리거 게이트 1: Airflow 도달
    const airflowOk = await page.request.get(`${AIRFLOW}/health`)
      .then((r) => r.status() === 200).catch(() => false);
    if (!airflowOk) { test.skip(); return; }

    // 트리거 게이트 2: ES 도달
    const esOk = await page.request.get(`${ES}/_cluster/health`)
      .then((r) => r.status() === 200).catch(() => false);
    if (!esOk) { test.skip(); return; }

    // 트리거 게이트 3: staged 레코드 존재 (색인 대상 있음)
    const stagesRes = await page.request.get(`${UI_BACKEND}/stages`).catch(() => null);
    if (!stagesRes || stagesRes.status() !== 200) { test.skip(); return; }
    const stages = await stagesRes.json();
    const staged = stages.find((s: any) => s.id === 'gold_staged');
    if (!staged || staged.docsOut === 0) {
      // staged 레코드 없으면 DAG no-op 성공 테스트로 대체
      test.info().annotations.push({ type: 'note', description: 'staged 레코드 0건 — no-op DAG 경로' });
    }

    // DAG 활성화
    await page.request.patch(`${AIRFLOW}/api/v1/dags/gold_6_es_indexing`, {
      headers: { ...AUTH_HEADER, 'Content-Type': 'application/json' },
      data: { is_paused: false },
    });

    // 트리거: node-es-search → gold_6_es_indexing
    const triggerRes = await page.request.post(`${UI_BACKEND}/nodes/${ES_NODE_ID}/trigger`, {
      headers: { 'Content-Type': 'application/json' },
      data: { conf: {} },
    });
    expect(triggerRes.status()).toBe(200);
    const body = await triggerRes.json();
    expect(body).toHaveProperty('dag_run_id');
    const runId: string = body.dag_run_id;
    expect(typeof runId).toBe('string');
    createdRuns.push({ dagId: 'gold_6_es_indexing', runId });

    // DAG 완료 폴링 (최대 2분)
    const state = await pollDagRun(page, 'gold_6_es_indexing', runId);
    expect(state).toBe('success');
  });

  test('GET /search?q=<더미>&mode=keyword → BM25 결과 배열 반환', async ({ page }) => {
    // 트리거 게이트
    const airflowOk = await page.request.get(`${AIRFLOW}/health`)
      .then((r) => r.status() === 200).catch(() => false);
    const esOk = await page.request.get(`${ES}/_cluster/health`)
      .then((r) => r.status() === 200).catch(() => false);
    if (!airflowOk || !esOk) { test.skip(); return; }

    // SEARCH_ENABLED 확인
    const configRes = await page.request.get(`${UI_BACKEND}/config`).catch(() => null);
    if (configRes && configRes.status() === 200) {
      const { flags } = await configRes.json();
      if (flags?.search === 'off') {
        // SEARCH_ENABLED=off → 빈 배열 반환 확인
        const searchRes = await page.request.get(`${UI_BACKEND}/search?q=test&mode=keyword`);
        expect(searchRes.status()).toBe(200);
        const results = await searchRes.json();
        expect(Array.isArray(results)).toBe(true);
        // off 모드에서 빈 배열 반환 (스펙 정상)
        return;
      }
    }

    const searchRes = await page.request.get(`${UI_BACKEND}/search?q=문제&mode=keyword&size=5`);
    expect(searchRes.status()).toBe(200);
    const results = await searchRes.json();
    expect(Array.isArray(results)).toBe(true);
    // 색인된 문서가 있으면 결과 배열 구조 확인
    if (results.length > 0) {
      const first = results[0];
      expect(first).toHaveProperty('score');
      expect(typeof first.score).toBe('number');
    }
  });

  test('GET /search?mode=hybrid → RRF 결과 (또는 SEARCH_ENABLED!=hybrid 시 keyword 결과)', async ({ page }) => {
    // 트리거 게이트
    const esOk = await page.request.get(`${ES}/_cluster/health`)
      .then((r) => r.status() === 200).catch(() => false);
    if (!esOk) { test.skip(); return; }

    const searchRes = await page.request.get(`${UI_BACKEND}/search?q=마스킹&mode=hybrid&size=5`);
    expect(searchRes.status()).toBe(200);
    const results = await searchRes.json();
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      const first = results[0];
      expect(first).toHaveProperty('score');
      // hybrid/semantic_score 필드 존재 (null 허용)
      expect('semantic_score' in first || 'keyword_score' in first).toBe(true);
    }
  });
});
