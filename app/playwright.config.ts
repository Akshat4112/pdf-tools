import { defineConfig, devices } from '@playwright/test'

const production = process.env.PDF_TOOLS_PRODUCTION_SMOKE === '1'

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/images-engine/**',
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: production ? 'https://akshat4112.github.io/pdf-tools/' : 'http://127.0.0.1:4178/pdf-tools/', trace: 'off', screenshot: 'off', video: 'off',
    launchOptions: { executablePath: process.env.PDF_TOOLS_CHROMIUM_PATH, args: ['--no-sandbox'] },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: production ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178/pdf-tools/',
    reuseExistingServer: false,
  },
})
