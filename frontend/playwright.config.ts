import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5177',
  },
  webServer: {
    // --mode test 로 .env.test 를 로드 — 존재하지 않는 포트를 PUBLIC_UI_BACKEND_URL로 지정해
    // 실행 환경에 관계없이 real-mode 헬스체크가 항상 실패하도록 강제한다.
    command: 'npm run dev -- --port 5177 --mode test',
    url: 'http://localhost:5177',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
