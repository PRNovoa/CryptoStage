import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5199', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --port 5199 --strictPort', url: 'http://localhost:5199', reuseExistingServer: false },
})
