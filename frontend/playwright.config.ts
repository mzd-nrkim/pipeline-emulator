import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:5177',
  },
  webServer: {
    command: 'npm run dev -- --port 5177',
    url: 'http://localhost:5177',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      // e2e 테스트는 "백엔드 미연결" 상태를 검증 — 절대 사용되지 않는 포트를 지정해
      // 실행 환경에 관계없이 real-mode 헬스체크가 항상 실패하도록 강제한다.
      PUBLIC_UI_BACKEND_URL: 'http://localhost:19999',
    },
  },
});
