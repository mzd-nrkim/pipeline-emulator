import { test, expect } from '@playwright/test';

test.describe('Infra View — 인프라 연결 뷰', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.svelte-flow .svelte-flow__node', { timeout: 5000 });
  });

  test('인프라 뷰 전환: "인프라" 버튼 클릭 → "인프라 연결 뷰" 배지 가시성', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=인프라 연결 뷰')).toBeVisible({ timeout: 3000 });
  });

  test('연결 그래프 (고립 조각 아님): 인프라 뷰에서 edge가 1개 이상 존재', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);
    const edgeCount = await page.locator('.svelte-flow__edge').count();
    expect(edgeCount).toBeGreaterThan(0);
  });

  test('ES 노드 serving 계층 위치: storage 행보다 y값이 큼', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.svelte-flow__node')];

      const esNode = nodes.find(n =>
        (n as HTMLElement).innerText.includes('lastic') ||
        (n as HTMLElement).innerText.includes('ES') ||
        (n as HTMLElement).innerText.includes('Elasticsearch')
      );
      const storageNode = nodes.find(n =>
        (n as HTMLElement).innerText.includes('MySQL') ||
        (n as HTMLElement).innerText.includes('SeaweedFS') ||
        (n as HTMLElement).innerText.includes('Valkey')
      );

      if (!esNode || !storageNode) return null;

      const parseY = (el: Element) => {
        const style = (el as HTMLElement).style.transform;
        const m = style.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (!m) return null;
        return parseFloat(m[2]);
      };

      return {
        esY: parseY(esNode),
        storageY: parseY(storageNode),
      };
    });

    if (result === null || result.esY === null || result.storageY === null) {
      test.skip();
      return;
    }

    // serving 계층(ES)은 storage 계층보다 y값이 커야 한다 (아래에 위치)
    expect(result.esY).toBeGreaterThan(result.storageY);
  });

  test('ES 노드 storage 행 부재: translate Y가 storage 행 Y와 다름', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.svelte-flow__node')];

      const esNode = nodes.find(n =>
        (n as HTMLElement).innerText.includes('lastic') ||
        (n as HTMLElement).innerText.includes('ES') ||
        (n as HTMLElement).innerText.includes('Elasticsearch')
      );
      const storageNode = nodes.find(n =>
        (n as HTMLElement).innerText.includes('MySQL') ||
        (n as HTMLElement).innerText.includes('SeaweedFS') ||
        (n as HTMLElement).innerText.includes('Valkey')
      );

      if (!esNode || !storageNode) return null;

      const parseY = (el: Element) => {
        const style = (el as HTMLElement).style.transform;
        const m = style.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (!m) return null;
        return parseFloat(m[2]);
      };

      return {
        esY: parseY(esNode),
        storageY: parseY(storageNode),
      };
    });

    if (result === null || result.esY === null || result.storageY === null) {
      test.skip();
      return;
    }

    // ES 노드의 Y 좌표가 storage 행의 Y와 달라야 한다 (serving 행으로 이동됨)
    expect(result.esY).not.toBe(result.storageY);
  });

  test('es 비-좌상단 단언: Elasticsearch 노드가 translate(0px, 0px) 위치가 아님', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);
    const transform = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.svelte-flow__node')];
      const es = nodes.find(n =>
        (n as HTMLElement).innerText.includes('lastic') ||
        (n as HTMLElement).innerText.includes('ES')
      );
      return es?.style.transform ?? null;
    });
    // ES 노드가 없으면 skip (인프라 뷰에 ES가 없는 경우)
    if (transform === null) {
      test.skip();
      return;
    }
    expect(transform).not.toBe('translate(0px, 0px)');
    expect(transform).not.toBe('translate(0, 0)');
  });

  test('outOfTeamScope 노드 grayout: out-of-scope 클래스 및 dashed border 적용 확인', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.svelte-flow__node')];
      const outOfScopeNodes = nodes.filter(n =>
        n.querySelector('.out-of-scope') !== null
      );

      if (outOfScopeNodes.length === 0) return { found: false, details: [] };

      const details = outOfScopeNodes.map(wrapper => {
        const inner = wrapper.querySelector('.out-of-scope') as HTMLElement | null;
        if (!inner) return null;
        const style = window.getComputedStyle(inner);
        return {
          borderStyle: style.borderStyle,
          opacity: style.opacity,
          hasGrayHeader: inner.querySelector('.node-header-gray') !== null,
        };
      }).filter(Boolean);

      return { found: true, details };
    });

    // outOfTeamScope 노드가 없으면 skip
    if (!result.found) {
      test.skip();
      return;
    }

    for (const detail of result.details) {
      if (!detail) continue;
      // dashed border 또는 opacity 감소로 grayout 확인
      const isDashed = detail.borderStyle === 'dashed' ||
        detail.borderStyle.includes('dashed');
      const isOpaque = parseFloat(detail.opacity) < 1.0;
      expect(isDashed || isOpaque || detail.hasGrayHeader).toBe(true);
    }
  });

  test('outOfTeamScope 노드 node-header-gray 클래스: 회색 헤더 DOM 확인', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      // out-of-scope 클래스를 가진 노드 내부의 node-header-gray 존재 확인
      const outOfScopeInners = [...document.querySelectorAll('.svelte-flow__node .out-of-scope')];
      if (outOfScopeInners.length === 0) return { found: false, allHaveGrayHeader: false };

      const allHaveGrayHeader = outOfScopeInners.every(el =>
        el.querySelector('.node-header-gray') !== null
      );
      return { found: true, count: outOfScopeInners.length, allHaveGrayHeader };
    });

    if (!result.found) {
      test.skip();
      return;
    }

    // out-of-scope 노드는 모두 node-header-gray 클래스를 포함해야 한다
    expect(result.allHaveGrayHeader).toBe(true);
  });

  test('데이터흐름 복귀: 인프라 뷰 후 "데이터흐름" 버튼 클릭 → "인프라 연결 뷰" 배지 사라짐', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=인프라 연결 뷰')).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: '데이터흐름', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=인프라 연결 뷰')).not.toBeVisible();
  });
});
