import { test, expect } from '@playwright/test';

// real 모드(/real/pipeline)는 test 환경에서 "백엔드 연결 대기" 스텁을 렌더해
// 파이프라인 노드가 DOM에 나타나지 않는다(route-split.spec.ts 참조).
// realTopology.ts 그룹 적용은 단위테스트(buildNodesAndEdges.test.ts groupTopology)로 커버.
// 이 spec은 sample 모드의 렌더 검증에 집중한다.

const CHILD_IDS = ['node-docling', 'node-presidio', 'node-kure'];

test.describe('Airflow 그룹 경계 렌더 (sample 모드)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    // SVG 노드 부착 대기 — visible 판정 대신 toBeAttached 사용 (SVG 특성)
    const firstNode = page.locator('.svelte-flow__node').first();
    await expect(firstNode).toBeAttached({ timeout: 8000 });
    await page.waitForTimeout(500); // fitView 안정화
  });

  test('[sample] Airflow 그룹 박스가 데이터흐름 뷰에 렌더된다', async ({ page }) => {
    const groupNode = page.locator('.svelte-flow__node.svelte-flow__node-group');
    await expect(groupNode.first()).toBeAttached({ timeout: 5000 });
  });

  test('[sample] docling·presidio·kure가 서로 다른 x좌표로 렌더 (겹침 0)', async ({ page }) => {
    const rects = await page.evaluate((ids: string[]) => {
      return ids.map(id => {
        const el = document.querySelector(`.svelte-flow__node[data-id="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { id, x: Math.round(r.x) };
      });
    }, CHILD_IDS);

    for (const r of rects) {
      expect(r, `노드 ${r?.id ?? '?'} 미발견`).not.toBeNull();
    }

    // x좌표가 모두 달라야 함 (겹침 0)
    const xs = rects.map(r => r!.x);
    const uniqueXs = new Set(xs);
    expect(uniqueXs.size).toBe(3);
  });

  test('[sample] 독립 airflow 노드(이중 표현)가 데이터흐름 뷰에 부재', async ({ page }) => {
    // node-airflow는 orphan 필터로 data 뷰에서 숨겨짐 (dependency 엣지만 남아 infra 뷰 보존)
    const orphanAirflow = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.svelte-flow__node')];
      return nodes.some(n => {
        const id = n.getAttribute('data-id');
        const isGroup = n.classList.contains('svelte-flow__node-group');
        return id === 'node-airflow' && !isGroup;
      });
    });
    expect(orphanAirflow).toBe(false);
  });

  test('[sample] 그룹 자식 nodeclick → 노드 상세 모달 열림', async ({ page }) => {
    const clicked = await page.evaluate((ids: string[]) => {
      for (const id of ids) {
        const el = document.querySelector(`.svelte-flow__node[data-id="${id}"]`);
        if (el) {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
          return id;
        }
      }
      return null;
    }, CHILD_IDS);
    expect(clicked).not.toBeNull();
    await expect(page.locator('text=노드 상세')).toBeVisible({ timeout: 4000 });
  });

  test('[sample] 그룹 collapse 버튼 클릭 → 자식 노드 DOM 미부착 + 재클릭 → 복원', async ({ page }) => {
    // collapse 버튼 클릭 (expanded 뷰의 ▾ 버튼)
    // evaluate + dispatchEvent 사용: SvelteFlow가 pointermove를 드래그로 해석하는 문제 우회
    await expect(page.locator('.airflow-collapse-btn').first()).toBeAttached({ timeout: 5000 });
    await page.evaluate(() => {
      const btn = document.querySelector('.airflow-collapse-btn');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await page.waitForTimeout(500);

    // 자식 노드 미부착 확인
    await expect(page.locator('[data-id="node-docling"]')).not.toBeAttached({ timeout: 3000 });

    // 접힌 노드(type:tool로 렌더) 클릭 → expand (onnodeclick이 collapsed=true 감지해 toggleCollapse 호출)
    await expect(page.locator('.svelte-flow__node[data-id="node-airflow"]').first()).toBeAttached({ timeout: 3000 });
    await page.evaluate(() => {
      const node = document.querySelector('.svelte-flow__node[data-id="node-airflow"]');
      if (node) node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await page.waitForTimeout(800);

    // 자식 노드 DOM 부착 복원 확인
    await expect(page.locator('[data-id="node-docling"]')).toBeAttached({ timeout: 5000 });
  });

  test('[sample] 그룹 헤더 제목 클릭 → 그룹 config 모달 열림', async ({ page }) => {
    // 그룹 노드의 제목 영역 클릭
    const groupTitle = page.locator('.airflow-group-title').first();
    await expect(groupTitle).toBeAttached({ timeout: 5000 });
    await groupTitle.click({ force: true });
    await page.waitForTimeout(300);

    // [role=dialog] visible + 그룹 ID 텍스트 포함 확인
    await expect(page.locator('[role=dialog]')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('[role=dialog]')).toContainText('node-airflow');

    // teardown
    await page.keyboard.press('Escape');
  });

  test('[sample] E-1: collapsed 후 s3-bronze→airflow, airflow→mock-api 경계 엣지 DOM 부착', async ({ page }) => {
    // collapse 버튼 클릭
    await expect(page.locator('.airflow-collapse-btn').first()).toBeAttached({ timeout: 5000 });
    await page.evaluate(() => {
      const btn = document.querySelector('.airflow-collapse-btn');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await page.waitForTimeout(600);

    // 경계 엣지가 DOM에 부착됐는지 확인 (SVG edge는 toBeAttached 사용)
    // SvelteFlow edge id 패턴: e-{from}-{to}-{idx}
    const hasIncoming = await page.evaluate(() => {
      const edges = document.querySelectorAll('.svelte-flow__edge');
      for (const e of edges) {
        const id = e.getAttribute('data-id') ?? '';
        if (id.includes('node-s3-bronze') && id.includes('node-airflow')) return true;
      }
      return false;
    });
    const hasOutgoing = await page.evaluate(() => {
      const edges = document.querySelectorAll('.svelte-flow__edge');
      for (const e of edges) {
        const id = e.getAttribute('data-id') ?? '';
        if (id.includes('node-airflow') && id.includes('node-mock-api')) return true;
      }
      return false;
    });
    expect(hasIncoming, 's3-bronze→airflow 경계 엣지 미부착').toBe(true);
    expect(hasOutgoing, 'airflow→mock-api 경계 엣지 미부착').toBe(true);
  });

  test('[sample] E-2: "연결 없는 노드 표시" ON 시 Airflow 표현이 하나만 존재', async ({ page }) => {
    // showOrphans 토글 버튼 클릭 (orphan 노드 표시 활성화)
    const orphanToggle = page.locator('[data-testid="show-orphans-toggle"], button:has-text("연결 없는"), label:has-text("연결 없는")').first();
    const toggleExists = await orphanToggle.count() > 0;
    if (toggleExists) {
      await orphanToggle.click({ force: true });
      await page.waitForTimeout(500);
    }

    // node-airflow id를 가진 DOM 요소 수 카운트 (group 또는 tool 타입 무관하게 data-id 기준)
    const airflowCount = await page.evaluate(() => {
      return document.querySelectorAll('.svelte-flow__node[data-id="node-airflow"]').length;
    });
    expect(airflowCount).toBe(1);
  });

  test('[sample] E-3: collapsed 후 그룹 노드 좌표가 원점(-60,-60)이 아님', async ({ page }) => {
    // collapse 버튼 클릭
    await expect(page.locator('.airflow-collapse-btn').first()).toBeAttached({ timeout: 5000 });
    await page.evaluate(() => {
      const btn = document.querySelector('.airflow-collapse-btn');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    });
    await page.waitForTimeout(600);

    // 접힌 그룹 노드 좌표 sanity
    const rect = await page.evaluate(() => {
      const node = document.querySelector('.svelte-flow__node[data-id="node-airflow"]');
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    });
    expect(rect, 'node-airflow 노드 미발견').not.toBeNull();
    // 원점(-60,-60) 겹침이 아니어야 함 — 브라우저 좌표이므로 정확한 -60은 실환경에서 거의 불가능하지만
    // 극단적으로 작은 값(< 10px)이면 원점 렌더 의심
    expect(rect!.x).toBeGreaterThan(10);
    expect(rect!.y).toBeGreaterThan(0);
  });

  test('[real] /real/pipeline은 백엔드 연결 대기 스텁을 표시한다', async ({ page }) => {
    await page.goto('/real/pipeline');
    await expect(page.getByText('백엔드 연결 대기')).toBeVisible({ timeout: 5000 });
  });
});
