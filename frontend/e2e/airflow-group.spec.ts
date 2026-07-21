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

    // collapsed 카드 → evaluate 클릭으로 expand
    await expect(page.locator('.airflow-group-collapsed').first()).toBeAttached({ timeout: 3000 });
    await page.evaluate(() => {
      const card = document.querySelector('.airflow-group-collapsed');
      if (card) card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
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
    await expect(page.locator('[role=dialog]')).toContainText('node-airflow-group');

    // teardown
    await page.keyboard.press('Escape');
  });

  test('[real] /real/pipeline은 백엔드 연결 대기 스텁을 표시한다', async ({ page }) => {
    await page.goto('/real/pipeline');
    await expect(page.getByText('백엔드 연결 대기')).toBeVisible({ timeout: 5000 });
  });
});
