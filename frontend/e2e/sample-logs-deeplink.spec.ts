import { test, expect } from '@playwright/test';

/**
 * 샘플 로그뷰어 + 외부 UI 딥링크 e2e spec
 *
 * 대상 URL: /sample/pipeline
 * 의존: mock adapter (generateLogs) + getExternalLinks
 *
 * 커버 시나리오:
 *   1. 로그 패널 렌더 — Airflow 그룹 자식 노드 선택 후 log-panel에 로그 1개 이상
 *   2. 소스 토글 — container↔airflow 전환 시 log-panel 텍스트 형식 변화
 *   3. Airflow 딥링크 — dagId 보유 노드의 external-ui-link href 검증
 *   4. NiFi 딥링크 — apache-nifi 노드의 external-ui-link href 검증
 *
 * 노드 참고 (topology.ts):
 *   - node-presidio (parentId=node-airflow, dagId=silver_2_masking, tool=presidio)
 *   - node-docling  (parentId=node-airflow, dagId=silver_1_structuring, tool=docling-langchain)
 *   - node-kure     (parentId=node-airflow, dagId=gold_3_chunking, tool=kure-embedding)
 *   - node-nifi     (독립 ingest 노드, tool=apache-nifi, dagId 없음)
 *
 * SVG 노드 대기 정책: visible 판정 금지 — toBeAttached 사용
 */

const CHILD_IDS = ['node-presidio', 'node-docling', 'node-kure'];

/** Airflow 그룹 자식 노드 중 DOM에 부착된 첫 번째 노드 id를 반환 */
async function expandGroupsAndGetFirstChildId(
  page: import('@playwright/test').Page
): Promise<string> {
  // 그룹 초기 접힘 상태 → 모두 펼치기
  await page.locator('[data-testid="toggle-all-groups"]').dispatchEvent('click');
  // 첫 자식 노드 부착 대기
  await expect(page.locator(`[data-id="${CHILD_IDS[0]}"]`).first()).toBeAttached({ timeout: 5000 });

  // DOM에 존재하는 첫 번째 자식 노드 id 반환
  const foundId = await page.evaluate((ids: string[]) => {
    for (const id of ids) {
      const el = document.querySelector(`.svelte-flow__node[data-id="${id}"]`);
      if (el) return id;
    }
    return null;
  }, CHILD_IDS);

  if (!foundId) throw new Error('Airflow 그룹 자식 노드를 DOM에서 찾을 수 없습니다.');
  return foundId;
}

/** 지정된 nodeId 노드를 dispatchEvent로 클릭하고 노드 상세 모달 열림 대기 */
async function clickNodeAndOpenModal(
  page: import('@playwright/test').Page,
  nodeId: string
): Promise<void> {
  await page.evaluate((id: string) => {
    const el = document.querySelector(`.svelte-flow__node[data-id="${id}"]`);
    if (!el) throw new Error(`노드 미발견: ${id}`);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
  }, nodeId);
  await page.waitForTimeout(400);
  // 모달(Dialog.Content)이 열릴 때까지 대기
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 4000 });
}

test.describe('샘플 로그뷰어 + 외부 UI 딥링크 (sample 모드)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sample/pipeline');
    await page.waitForLoadState('networkidle');
    // SVG 노드 부착 대기 — visible 판정 대신 toBeAttached 사용 (SVG 특성)
    await expect(page.locator('.svelte-flow__node').first()).toBeAttached({ timeout: 8000 });
    await page.waitForTimeout(500); // fitView 안정화
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 테스트 1: 로그 패널 렌더
  // ──────────────────────────────────────────────────────────────────────────
  test('[sample] 로그 패널 렌더 — Airflow 그룹 자식 노드 선택 후 log-panel에 로그 1개 이상', async ({ page }) => {
    // 그룹 펼치기 + 자식 노드 id 확보
    const childId = await expandGroupsAndGetFirstChildId(page);

    // 자식 노드 클릭 → 모달 열기
    await clickNodeAndOpenModal(page, childId);

    const modal = page.locator('[role="dialog"]');

    // "로그" 탭 클릭 (disabled 아닌 상태에서만 클릭 가능)
    const logsTab = modal.locator('[data-testid="drawer-tab-logs"]');
    await expect(logsTab).toBeVisible({ timeout: 3000 });
    await logsTab.click();
    await page.waitForTimeout(600); // loadLogs() 비동기 완료 대기

    // log-panel이 DOM에 부착되고 텍스트가 있어야 함
    const logPanel = modal.locator('[data-testid="log-panel"]');
    await expect(logPanel).toBeVisible({ timeout: 3000 });

    // 로그 라인이 1개 이상 렌더됐는지 확인 — "로그 없음" 텍스트가 없어야 함
    await expect(logPanel).not.toContainText('로그 없음');
    // 최소 1개의 로그 div가 존재해야 함 (로그라인 렌더 구조: div.flex.gap-2)
    const logLines = logPanel.locator('div.flex.gap-2');
    await expect(logLines.first()).toBeAttached({ timeout: 3000 });
    const count = await logLines.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 테스트 2: 소스 토글 (container↔airflow)
  // ──────────────────────────────────────────────────────────────────────────
  test('[sample] 소스 토글 — container↔airflow 전환 시 log-panel 텍스트 형식 변화', async ({ page }) => {
    const childId = await expandGroupsAndGetFirstChildId(page);
    await clickNodeAndOpenModal(page, childId);

    const modal = page.locator('[role="dialog"]');
    const logsTab = modal.locator('[data-testid="drawer-tab-logs"]');
    await expect(logsTab).toBeVisible({ timeout: 3000 });
    await logsTab.click();
    await page.waitForTimeout(600);

    const logPanel = modal.locator('[data-testid="log-panel"]');
    await expect(logPanel).toBeVisible({ timeout: 3000 });

    // container 소스 상태의 텍스트 스냅샷
    const containerText = await logPanel.textContent();
    expect(containerText).toBeTruthy();

    // 소스를 airflow로 전환 (select 요소)
    const sourceSelect = modal.locator('select');
    await sourceSelect.selectOption('airflow');
    await page.waitForTimeout(600); // loadLogs() 재호출 완료 대기

    // airflow 소스 텍스트 스냅샷
    const airflowText = await logPanel.textContent();
    expect(airflowText).toBeTruthy();

    // container와 airflow 로그 포맷이 달라야 함:
    //   container: flavor 기반 풀 메시지 (예: "[NiFi] [INFO] ..." 또는 "[Presidio] ...")
    //   airflow: taskinstance 기반 (예: "taskinstance[N]")
    // 두 텍스트가 동일하지 않으면 형식 변화가 있음을 확인
    expect(airflowText).not.toBe(containerText);

    // airflow 소스에는 "taskinstance" 문자열이 포함되어야 함 (generateLogs airflow 포맷)
    expect(airflowText).toContain('taskinstance');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 테스트 3: Airflow 딥링크
  // ──────────────────────────────────────────────────────────────────────────
  test('[sample] Airflow 딥링크 — dagId 보유 노드의 external-ui-link href에 localhost:8080/dags/ 및 /grid 포함', async ({ page }) => {
    // node-presidio: dagId=silver_2_masking → href=http://localhost:8080/dags/silver_2_masking/grid
    const childId = await expandGroupsAndGetFirstChildId(page);
    await clickNodeAndOpenModal(page, childId);

    const modal = page.locator('[role="dialog"]');

    // "노드 상세" 탭 활성화 확인 (기본값)
    const nodeTab = modal.locator('button').filter({ hasText: /노드 상세/ });
    await expect(nodeTab).toBeVisible({ timeout: 3000 });

    // external-ui-link가 존재해야 함 (dagId 있는 노드)
    const externalLink = modal.locator('[data-testid="external-ui-link"]').first();
    await expect(externalLink).toBeVisible({ timeout: 3000 });

    const href = await externalLink.getAttribute('href');
    expect(href).toBeTruthy();
    // Airflow DAG Grid 링크 검증: localhost:8080/dags/{dagId}/grid
    expect(href).toContain('localhost:8080/dags/');
    expect(href).toContain('/grid');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 테스트 4: NiFi 딥링크
  // ──────────────────────────────────────────────────────────────────────────
  test('[sample] NiFi 딥링크 — node-nifi 선택 후 external-ui-link href에 localhost:8443/nifi 포함', async ({ page }) => {
    // node-nifi는 Airflow 그룹 자식이 아닌 독립 ingest 노드 → 그룹 펼치기 불필요
    // data 채널 edge(node-nifi → node-s3-bronze) 가 있으므로 데이터뷰에 표시됨
    await expect(page.locator('[data-id="node-nifi"]').first()).toBeAttached({ timeout: 5000 });

    await clickNodeAndOpenModal(page, 'node-nifi');

    const modal = page.locator('[role="dialog"]');
    const nodeTab = modal.locator('button').filter({ hasText: /노드 상세/ });
    await expect(nodeTab).toBeVisible({ timeout: 3000 });

    // NiFi 노드는 dagId 없음 → Airflow DAG Grid 링크는 없고 NiFi UI 링크만 존재
    const externalLink = modal.locator('[data-testid="external-ui-link"]').first();
    await expect(externalLink).toBeVisible({ timeout: 3000 });

    const href = await externalLink.getAttribute('href');
    expect(href).toBeTruthy();
    // NiFi UI 링크 검증: https://localhost:8443/nifi
    expect(href).toContain('localhost:8443/nifi');
  });
});
