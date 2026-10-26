import { defineConfig, devices } from '@playwright/test'

/**
 * PT-QA-002 Linux automated compatibility evidence, NOT certification for
 * Safari on macOS/iOS or real Android hardware. Keep the full Chromium R1 suite
 * in playwright.config.ts; this matrix targets a small common smoke surface.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/compatibility.spec.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: 'http://127.0.0.1:4178/pdf-tools/',
    trace: 'off', screenshot: 'off', video: 'off',
  },
  projects: [
    { name: 'chromium-desktop-compat', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop-compat', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop-compat', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-android-emulation', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-iphone-emulation', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4178 --strictPort',
    url: 'http://127.0.0.1:4178/pdf-tools/',
    reuseExistingServer: false,
  },
})
