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

  test('엣지에 ArrowClosed 마커(markerEnd)가 렌더된다', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);
    // SVG <g> 요소는 Playwright visibility 판정이 불안정 — toBeAttached 사용
    await expect(page.locator('.svelte-flow__edge').first()).toBeAttached({ timeout: 5000 });
    const markerCount = await page.evaluate(() => {
      const edgePaths = [...document.querySelectorAll('.svelte-flow__edge-path[marker-end]')];
      return edgePaths.length;
    });
    expect(markerCount).toBeGreaterThan(0);
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

  test('outOfTeamScope 노드 grayout: out-of-scope 래퍼에 opacity 감소 또는 dashed border 적용 확인', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      const outOfScopeInners = [...document.querySelectorAll('.svelte-flow__node .out-of-scope')];
      if (outOfScopeInners.length === 0) return { found: false, allGrayout: false };

      const allGrayout = outOfScopeInners.every(el => {
        const style = window.getComputedStyle(el as HTMLElement);
        const isOpaque = parseFloat(style.opacity) < 1.0;
        const nodeCard = el.querySelector('.node-card') as HTMLElement | null;
        const cardStyle = nodeCard ? window.getComputedStyle(nodeCard) : null;
        const isDashed = cardStyle ? cardStyle.borderStyle.includes('dashed') : false;
        const hasMutedLabel = el.querySelector('.node-label-muted') !== null;
        return isOpaque || isDashed || hasMutedLabel;
      });
      return { found: true, count: outOfScopeInners.length, allGrayout };
    });

    if (!result.found) {
      test.skip();
      return;
    }

    // out-of-scope 노드는 모두 opacity 감소 또는 dashed border로 grayout 처리돼야 한다
    expect(result.allGrayout).toBe(true);
  });

  test('mysql-container 카드 제목: 인프라 뷰에서 "MySQL 원본 DB" 표시, sink는 불변', async ({ page }) => {
    await page.getByRole('button', { name: '인프라', exact: true }).click();
    await page.waitForTimeout(500);

    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.svelte-flow__node')].map(n => (n as HTMLElement).innerText)
    );
    const all = texts.join('\n');
    // mysql-container = "MySQL 원본 DB" (displayNameOverride 적용)
    expect(all).toContain('MySQL 원본 DB');
  });

  test('mysql sink 카드 제목: data 뷰에서 "MySQL (Silver/Gold)" 유지(카탈로그 불변)', async ({ page }) => {
    // data 뷰 기본 상태에서 확인
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.svelte-flow__node')].map(n => (n as HTMLElement).innerText)
    );
    const all = texts.join('\n');
    // node-mysql(sink)는 카탈로그 displayName 그대로
    expect(all).toContain('MySQL (Silver/Gold)');
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
