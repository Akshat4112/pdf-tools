import react from '@vitejs/plugin-react'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * PT-PD-004 §5: project-site path is /pdf-tools/ — all assets and routes
 * must resolve under it (enforced again in PT-FND-009/PT-UX-004).
 * PT-SP-001 §2.1: pdf.js worker + standard fonts are self-hosted under
 * /pdf-tools/assets/ — copied into dist at build time so local preview
 * matches production (deploy workflow's copy step remains as safety net).
 */
function copyPdfjsAssets(): Plugin {
  return {
    name: 'copy-pdfjs-assets',
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist/assets')
      if (!existsSync(dist)) mkdirSync(dist, { recursive: true })
      cpSync(
        resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
        resolve(dist, 'pdf.worker.min.mjs'),
      )
      cpSync(
        resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts'),
        resolve(dist, 'standard_fonts'),
        { recursive: true },
      )
      console.log('copied pdf.worker.min.mjs + standard_fonts -> dist/assets/')
    },
  }
}

export default defineConfig({
  base: '/pdf-tools/',
  plugins: [react(), copyPdfjsAssets()],
  build: {
    sourcemap: false,
  },
})
