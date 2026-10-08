import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// PT-PD-004 §5: project-site path is /pdf-tools/ — all assets and routes
// must resolve under it (enforced again in PT-FND-009/PT-UX-004).
export default defineConfig({
  base: '/pdf-tools/',
  plugins: [react()],
  build: {
    sourcemap: false,
  },
})
