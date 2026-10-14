import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir:'./e2e/images-engine',workers:1,timeout:30_000,forbidOnly:Boolean(process.env.CI),
  use:{baseURL:'http://127.0.0.1:4180/pdf-tools/',trace:'off',screenshot:'off',video:'off',launchOptions:{executablePath:process.env.PDF_TOOLS_CHROMIUM_PATH,args:['--no-sandbox']}},
  projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['Pixel 7']}}],
  webServer:{command:'npx vite --config vite.images.config.ts --host 127.0.0.1 --port 4180 --strictPort',url:'http://127.0.0.1:4180/pdf-tools/e2e/images-engine/harness.html',reuseExistingServer:false},
})
