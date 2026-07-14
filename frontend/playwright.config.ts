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
  },
});
