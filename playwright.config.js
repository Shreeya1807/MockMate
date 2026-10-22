import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3001/health/ready',
    reuseExistingServer: false,
    env: {
      AI_MODE: 'demo',
      APP_ORIGIN: 'http://localhost:3001',
      DATABASE_PATH: 'data/e2e.sqlite',
      PORT: '3001',
      WORKER_MODE: 'embedded',
    },
    timeout: 30000,
  },
})
