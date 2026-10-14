import { mergeConfig } from 'vite'
import config from './vite.config.ts'
// Use the built self-hosted PDF.js worker while serving the test-only TS harness.
export default mergeConfig(config, { publicDir: 'dist' })
