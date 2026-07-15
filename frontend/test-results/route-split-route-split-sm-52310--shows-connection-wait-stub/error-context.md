# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: route-split.spec.ts >> route split smoke tests >> /real/pipeline shows connection-wait stub
- Location: e2e/route-split.spec.ts:30:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('백엔드 연결 대기')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('백엔드 연결 대기')

```

```yaml
- banner:
  - text: PipeScale DB 모드
  - group "모드 전환":
    - link "샘플":
      - /url: /sample/pipeline
    - link "실제":
      - /url: /real/pipeline
  - navigation "주요 탐색":
    - tablist:
      - tab "개요"
      - tab "파이프라인" [selected]
      - tab "문서"
      - tab "검색"
      - tab "설정"
      - tab "컴포넌트"
- main:
  - text: "활성 실행 RUN_ID: — 투입 볼륨 5건 / 12.4 KB · PII 밀도 높음 구성 masking=regex · search=off"
  - button "재실행"
  - button "데이터흐름"
  - button "인프라"
  - application:
    - img
    - img:
      - img "Edge from node-debezium to node-s3-bronze"
    - img:
      - img "Edge from node-nifi to node-s3-bronze"
    - img:
      - img "Edge from node-dam to node-s3-bronze"
    - img:
      - img "Edge from node-s3-bronze to node-airflow"
    - img:
      - img "Edge from node-airflow to node-presidio"
    - img:
      - img "Edge from node-presidio to node-docling"
    - img:
      - img "Edge from node-docling to node-kure"
    - img:
      - img "Edge from node-kure to node-valkey"
    - img:
      - img "Edge from node-valkey to node-es"
    - img:
      - img "Edge from node-valkey to node-mysql"
    - button
    - text: 📡 Debezium 3.4.0.Final [ingest]
    - button
    - button
    - text: 🔄 Apache NiFi 2.8.0 [ingest]
    - button
    - button
    - text: 📁 DAM (외부 API) [ingest]
    - button
    - button
    - text: 🪣 S3 (Bronze/아카이브) [store]
    - button
    - button
    - text: ✈️ Apache Airflow 3.1.5 [transform]
    - button
    - button
    - text: 🛡️ Presidio 2-Layer [transform]
    - button
    - button
    - text: 📄 Docling + LangChain [transform]
    - button
    - button
    - text: 🔢 KURE-v1 (ONNX INT8) [transform]
    - button
    - button
    - text: ⚡ Valkey 8.1.4 [broker]
    - button
    - button
    - text: 🔍 Elasticsearch 9.2.5 [index]
    - button
    - button
    - text: 🗄️ MySQL (Silver/Gold) [store]
    - button
    - link "Svelte Flow attribution":
      - /url: https://svelteflow.dev
      - text: Svelte Flow
    - img
    - button "zoom in":
      - img
    - button "zoom out":
      - img
    - button "fit view":
      - img
    - button "toggle interactivity":
      - img
  - button "노드 상세" [disabled]
  - button "실행 이력"
  - button "드로어 닫기": ✕
  - heading "실행 이력" [level=2]
  - button "비교"
  - list:
    - listitem:
      - button "manual__2026-07-15T06:19:35.590256+00:00 성공 2026. 7. 15. 오후 3:19:36 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:19:28.901277+00:00 성공 2026. 7. 15. 오후 3:19:29 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:19:03.408017+00:00 성공 2026. 7. 15. 오후 3:19:04 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:19:00.040573+00:00 성공 2026. 7. 15. 오후 3:19:01 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:18:56.679004+00:00 성공 2026. 7. 15. 오후 3:18:57 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:18:09.968803+00:00 성공 2026. 7. 15. 오후 3:18:10 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:18:09.653574+00:00 성공 2026. 7. 15. 오후 3:18:10 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:18:09.332416+00:00 성공 2026. 7. 15. 오후 3:18:10 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:18:09.014708+00:00 성공 2026. 7. 15. 오후 3:18:10 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:15:59.148833+00:00 성공 2026. 7. 15. 오후 3:16:02 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:15:58.802709+00:00 성공 2026. 7. 15. 오후 3:16:02 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:15:58.455061+00:00 성공 2026. 7. 15. 오후 3:16:02 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:15:58.080021+00:00 성공 2026. 7. 15. 오후 3:16:02 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:15:57.751238+00:00 성공 2026. 7. 15. 오후 3:15:58 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:15:57.380065+00:00 성공 2026. 7. 15. 오후 3:15:58 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:12:22.547346+00:00 성공 2026. 7. 15. 오후 3:12:23 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:12:08.931036+00:00 성공 2026. 7. 15. 오후 3:12:09 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:11:57.845018+00:00 성공 2026. 7. 15. 오후 3:11:58 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:11:42.036835+00:00 성공 2026. 7. 15. 오후 3:11:43 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:11:30.492941+00:00 성공 2026. 7. 15. 오후 3:11:31 · 0초"
    - listitem:
      - button "manual__2026-07-15T06:08:26.821866+00:00 성공 2026. 7. 15. 오후 3:11:16 · 0초"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('route split smoke tests', () => {
  4  |   test('/sample renders mock overview without crash', async ({ page }) => {
  5  |     await page.goto('/sample');
  6  |     await expect(page.locator('main')).toBeVisible();
  7  |     await expect(page.locator('h1')).toContainText('PipeScale');
  8  |   });
  9  | 
  10 |   test('/sample/pipeline renders mock data', async ({ page }) => {
  11 |     await page.goto('/sample/pipeline');
  12 |     await expect(page.locator('main')).toBeVisible();
  13 |   });
  14 | 
  15 |   test('/sample/documents renders mock data', async ({ page }) => {
  16 |     await page.goto('/sample/documents');
  17 |     await expect(page.locator('main')).toBeVisible();
  18 |   });
  19 | 
  20 |   test('/sample/search renders mock data', async ({ page }) => {
  21 |     await page.goto('/sample/search');
  22 |     await expect(page.locator('main')).toBeVisible();
  23 |   });
  24 | 
  25 |   test('/real/* shows connection-wait stub without crash', async ({ page }) => {
  26 |     await page.goto('/real');
  27 |     await expect(page.getByText('백엔드 연결 대기')).toBeVisible();
  28 |   });
  29 | 
  30 |   test('/real/pipeline shows connection-wait stub', async ({ page }) => {
  31 |     await page.goto('/real/pipeline');
> 32 |     await expect(page.getByText('백엔드 연결 대기')).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  33 |   });
  34 | 
  35 |   test('header toggle preserves subpath when switching modes', async ({ page }) => {
  36 |     await page.goto('/sample/pipeline');
  37 |     await page.getByRole('link', { name: '실제', exact: true }).click();
  38 |     await expect(page).toHaveURL('/real/pipeline');
  39 |     await page.getByRole('link', { name: '샘플', exact: true }).click();
  40 |     await expect(page).toHaveURL('/sample/pipeline');
  41 |   });
  42 | 
  43 |   test('/ redirects to /sample', async ({ page }) => {
  44 |     await page.goto('/');
  45 |     await expect(page).toHaveURL('/sample');
  46 |   });
  47 | 
  48 |   test('/foo/pipeline returns 404', async ({ page }) => {
  49 |     const response = await page.goto('/foo/pipeline');
  50 |     expect(response?.status()).toBe(404);
  51 |   });
  52 | });
  53 | 
```