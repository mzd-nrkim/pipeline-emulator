# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: route-split.spec.ts >> route split smoke tests >> /real/* shows connection-wait stub without crash
- Location: e2e/route-split.spec.ts:25:3

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
      - /url: /sample
    - link "실제":
      - /url: /real
  - navigation "주요 탐색":
    - tablist:
      - tab "개요" [selected]
      - tab "파이프라인"
      - tab "문서"
      - tab "검색"
      - tab "설정"
      - tab "컴포넌트"
- main:
  - text: 에뮬레이터 / 개요
  - heading "PipeScale" [level=1]
  - heading "원시 수집에서 검색 인수까지 전 구간을 실시간으로 관찰합니다." [level=4]
  - paragraph: PipeScale은 실제 Bronze → Silver → Gold 데이터 파이프라인을 라이브 시뮬레이션으로 재현합니다. 샘플 레코드를 투입하고, 6개 단계를 모두 실행하고, PII 마스킹을 확인한 뒤 결과를 검색에 전달합니다. 디자인 전용 미리보기 — 외부로 유출되는 데이터는 없습니다.
  - link "샘플 데이터 투입":
    - /url: /real/pipeline
  - link "파이프라인 열기":
    - /url: /real/pipeline
  - link "설정":
    - /url: /settings
  - text: 처리 여정
  - list:
    - listitem: 01 수집 샘플 레코드가 Bronze 레이어에 스크립트 수집기를 통해 진입합니다.
    - listitem: 02 구조화 · 마스킹 Silver 레이어가 필드를 정규화하고 PII를 마스킹합니다.
    - listitem: 03 청킹 · 엔리치먼트 Gold 레이어가 청크 분할, 요약, 개체명 태깅을 수행합니다.
    - listitem: 04 검색 필드 매핑된 출력이 검색 인덱스에 전달됩니다.
  - text: 현재 구성
  - list:
    - listitem: masking regex
    - listitem: search off
    - listitem: chunking rule_based
    - listitem: enrichment rule_based
    - listitem: presidio_layer layer1
    - listitem: executor LocalExecutor
    - listitem: es_cluster off
  - text: 단계 대체 구성표
  - paragraph: 에뮬레이터는 인터페이스 형태를 유지하면서 무거운 프로덕션 컴포넌트를 경량 등가물로 대체합니다.
  - list:
    - listitem: Kafka 수집 → 로컬 스크립트 수집기
    - listitem: Spark 구조화 스트리밍 → 단일 노드 배치
    - listitem: Presidio + NER 마스킹 → 정규식 패턴
    - listitem: LLM 엔리치먼트 → 결정적 픽스처
    - listitem: OpenSearch 클러스터 → 예정
  - text: 6개 처리 단계 Bronze 데이터 수집 없음 Bronze Bronze 등록 완료 Silver Silver 구조화 완료 Silver Silver 마스킹 완료 Gold Gold 청킹 완료 Gold Gold 엔리치먼트 완료 Gold Gold Staged 완료
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
> 27 |     await expect(page.getByText('백엔드 연결 대기')).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  28 |   });
  29 | 
  30 |   test('/real/pipeline shows connection-wait stub', async ({ page }) => {
  31 |     await page.goto('/real/pipeline');
  32 |     await expect(page.getByText('백엔드 연결 대기')).toBeVisible();
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