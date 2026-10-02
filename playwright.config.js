import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 30000, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5197', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'node scripts/serve.js', port: 5197, env: { PORT: '5197', DATA_DIR: '.data/e2e' }, reuseExistingServer: false },
});
