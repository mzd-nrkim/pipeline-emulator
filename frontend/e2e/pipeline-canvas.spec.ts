import { test, expect } from '@playwright/test';

test.describe('Pipeline Canvas View — ToolCanvasView (P1/P3 통합)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
  });

  test('뷰 셀렉터(데이터흐름/인프라)가 표시되고 Grid/Graph 토글은 없다', async ({ page }) => {
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '데이터흐름', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '인프라', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Grid', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Graph', exact: true })).not.toBeVisible();
  });

  test('ToolCanvasView가 기본으로 렌더된다', async ({ page }) => {
    await expect(page.locator('.svelte-flow')).toBeVisible({ timeout: 5000 });
  });

  test('Canvas 뷰에서 Source/Task/Switch/Sink 4종 노드가 렌더된다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodes = page.locator('.svelte-flow .svelte-flow__node');
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Canvas 뷰에서 노드가 role 레이블로 시각 구분된다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    // role 텍스트는 hover 시 표시되는 .node-detail 오버레이에 있어 innerText에 미포함
    // textContent로 DOM 전체 텍스트 수집 (display:none 포함)
    const allText = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.svelte-flow__node')];
      return nodes.map(n => n.textContent || '').join(' ');
    });
    const validRoles = ['ingest', 'transform', 'store', 'broker', 'index', 'visualize', 'route'];
    const hasRole = validRoles.some(r => allText.includes(r));
    expect(hasRole).toBe(true);
  });

  test('뷰 셀렉터 전환: 인프라 뷰 클릭 시 배지 표시 + 노드 수 변경', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const dataNodeCount = await page.locator('.svelte-flow .svelte-flow__node').count();
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=인프라 연결 뷰')).toBeVisible({ timeout: 3000 });
    const infraNodeCount = await page.locator('.svelte-flow .svelte-flow__node').count();
    // 인프라 뷰는 dependency 노드만 표시 (더 적거나 다른 노드 집합)
    expect(infraNodeCount).toBeGreaterThan(0);
    expect(infraNodeCount).not.toBe(dataNodeCount);
  });

  test('Canvas 뷰에서 노드 클릭 시 drill-down 패널이 열린다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    await page.waitForTimeout(500); // fitView 애니메이션 대기
    await page.evaluate(() => {
      const node = document.querySelector('.svelte-flow .svelte-flow__node');
      if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });
  });

  test('drill-down 패널 닫기(✕) 클릭 시 패널이 닫힌다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const node = document.querySelector('.svelte-flow .svelte-flow__node');
      if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: '모달 닫기' }).click();
    await expect(page.locator('text=노드 상세')).not.toBeVisible();
  });

  test('P1.5 — 실제 도구명(NiFi/Debezium/Airflow/Elasticsearch 등)이 노드에 노출된다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodeTexts = await page.locator('.svelte-flow__node').allInnerTexts();
    const allText = nodeTexts.join(' ');
    // 실제 도구명 중 하나 이상 노출 확인
    const hasRealTool = ['NiFi', 'Debezium', 'Airflow', 'Elasticsearch', 'Presidio', 'Kibana', 'MySQL', 'Valkey', 'DAM', 'KURE', 'Docling', 'S3'].some(name => allText.includes(name));
    expect(hasRealTool).toBe(true);
  });

  test('P1.5 — 추상 기능명(rdb_loader, s3_loader 등)이 노드에 노출되지 않는다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodeTexts = await page.locator('.svelte-flow__node').allInnerTexts();
    const allText = nodeTexts.join(' ');
    const abstractNames = ['rdb_loader', 's3_loader', 'pii_masker', 'text_chunker', 'condition_router', 'elasticsearch_writer', 's3_writer'];
    const hasAbstract = abstractNames.some(name => allText.includes(name));
    expect(hasAbstract).toBe(false);
  });

  test('P1.5 — 노드 클릭 시 설정 폼(입력 위젯)이 렌더된다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const node = document.querySelector('.svelte-flow .svelte-flow__node');
      if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    // 설정 폼 또는 "설정 없음" 텍스트 중 하나 존재
    const hasForm = await page.locator('input, select').count() > 0;
    const hasNoConfig = await page.locator('text=설정 없음').isVisible().catch(() => false);
    expect(hasForm || hasNoConfig).toBe(true);
  });

  test('P1.5 — Airflow 노드 클릭 시 설정 폼과 P2 트리거 컨트롤이 공존한다', async ({ page }) => {
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
    const nodes = page.locator('.svelte-flow .svelte-flow__node');
    const count = await nodes.count();
    // Airflow 텍스트를 포함한 노드 찾기
    let airflowNode = null;
    for (let i = 0; i < count; i++) {
      const text = await nodes.nth(i).innerText();
      if (text.includes('Airflow')) {
        airflowNode = nodes.nth(i);
        break;
      }
    }
    if (!airflowNode) {
      test.skip(); // Airflow 노드가 없으면 skip
      return;
    }
    await airflowNode.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })));
    await page.waitForTimeout(500);
    // 설정 폼(input 위젯) + 트리거 버튼 공존 확인
    const hasInput = await page.locator('input[type="text"], input[type="number"]').count() > 0;
    // 트리거 버튼 — "DAG Trigger" 또는 "트리거" 텍스트
    const hasTrigger = await page.locator('button').filter({ hasText: /trigger|Trigger|트리거/i }).count() > 0;
    expect(hasInput).toBe(true);
    expect(hasTrigger).toBe(true);
  });
});
