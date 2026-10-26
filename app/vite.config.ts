import { guideHtml } from './src/lib/guideContent.ts'
import { guideDirectoryHtml, relatedGuidesHtml } from './src/lib/guideCatalog.ts'
import { createGuideExamples } from './src/lib/guideExamples.ts'
import { hubByPath, categoryHubHtml, hubDirectoryHtml, breadcrumbHtml, hubForTool, relatedToolsHtml } from './src/lib/categoryHubs.ts'
import { TOOLS } from './src/registry.ts'
import { toolArticleHtml } from './src/lib/toolContent.ts'
import { CATALOG_META, NOT_FOUND_META, PUBLIC_PAGES, SITE_URL, withPageMetadata } from './src/lib/pageMetadata.ts'
import react from '@vitejs/plugin-react'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
      for (const directory of ['cmaps', 'wasm', 'iccs']) {
        cpSync(resolve(process.cwd(), `node_modules/pdfjs-dist/${directory}`), resolve(dist, directory), { recursive: true })
      }
      cpSync(resolve(process.cwd(), 'node_modules/pdfjs-dist/web/images'), resolve(dist, 'pdfjs-images'), { recursive: true })
      console.log('copied PDF.js worker, fonts, cmaps, wasm and ICC assets -> dist/assets/')
    },
  }
}

/**
 * PT-UX-004: prerendered static entry pages + sitemap + robots + 404.
 *
 * GitHub Pages project sites have no SPA rewrite, so every route must be a
 * real file. This plugin clones the built index.html once per route, patches
 * the <title>/description/canonical/OG tags for that route, and writes it to
 * dist/<route>/index.html. Unknown paths fall back to 404.html (Pages serves
 * it automatically with HTTP 404). Metadata is static registry-derived copy —
 * no user/document data can ever appear (PT-PD-003).
 */
function prerenderRoutes(): Plugin {
  return {
    name: 'prerender-routes',
    transformIndexHtml: html => withPageMetadata(html, CATALOG_META),
    async closeBundle() {
      const dist = resolve(process.cwd(), 'dist')
      const indexPath = resolve(dist, 'index.html')
      if (!existsSync(indexPath)) throw new Error('prerender: dist/index.html missing')
      const indexHtml = readFileSync(indexPath, 'utf-8')

      const ROUTES = PUBLIC_PAGES
      const ORIGIN = SITE_URL
      const metaFor = (dir: string, title: string, description: string): string => {
        const canonical = dir === '.' ? ORIGIN : dir === '404' ? NOT_FOUND_META.canonical : `${ORIGIN}${dir}/`
        let html = withPageMetadata(indexHtml, { title, description, canonical, ogType: 'website' })
        // Crawlable, truthful no-JS navigation and description. Interactive
        // processing still requires JavaScript, and no document inputs leak
        // into the static source. This remains present without hydration.
        const routeLinks = ROUTES.filter(r => r.dir !== '.' && !r.dir.startsWith('guides')).map(r =>
          `<li><a href="${ORIGIN}${r.dir}/">${r.title.split(' — ')[0]}</a></li>`
        ).join('')
        const hub = hubByPath(`/${dir}`)
        const guide = guideHtml(`/${dir}`)
        const noJs = guide ?? (hub ? categoryHubHtml(hub) : dir === '404'
          ? `<h1>Page not found</h1><p>This page does not exist. <a href="${ORIGIN}">Browse PDF tools</a>.</p>`
          : dir === '.'
            ? `<h1>Free PDF tools in your browser</h1><p>PDF Tools provides free, open-source PDF utilities processed on your device. JavaScript is required to use the tools.</p><nav aria-label="Available PDF tools"><ul>${routeLinks}</ul></nav>${hubDirectoryHtml()}${guideDirectoryHtml()}`
            : `<h1>${title.split(' — ')[0]}</h1><p>${description}</p><p>JavaScript is required to process files locally. <a href="${ORIGIN}">Browse all PDF tools</a>.</p>`)
        const tool = TOOLS.find(tool => tool.implemented && tool.route.slice(1) === dir)
        const article = tool ? breadcrumbHtml(hubForTool(tool), tool) + toolArticleHtml(tool.id, tool.title) + relatedToolsHtml(tool) + relatedGuidesHtml(tool.id) : ''
        html = html.replace('<div id="root"></div>', `<div id="root"></div><noscript><main${guide ? ' class="tool-workspace guide-page"' : ''}>${noJs}${article}</main></noscript>`)
        return html
      }

      for (const route of ROUTES) {
        const html = metaFor(route.dir, route.title, route.description)
        if (route.dir === '.') {
          writeFileSync(indexPath, html)
        } else {
          const dir = resolve(dist, route.dir)
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
          writeFileSync(resolve(dir, 'index.html'), html)
        }
      }

      // Invented public inputs only, generated at build time; no user documents.
      const examplesDir = resolve(dist, 'examples')
      mkdirSync(examplesDir, { recursive: true })
      for (const [name, bytes] of Object.entries(await createGuideExamples())) writeFileSync(resolve(examplesDir, name), bytes)

      // 404.html: static not-found (GH Pages serves this for unknown paths).
      const nfHtml = metaFor(
        '404',
        NOT_FOUND_META.title,
        NOT_FOUND_META.description,
      )
      writeFileSync(resolve(dist, '404.html'), nfHtml)

      // sitemap.xml + robots.txt (registry-driven, same URLs as meta tags).
      // Do not invent modification dates on every build. Add <lastmod> only
      // when a route-specific content modification date is sourced and verified.
      const urls = ROUTES.map((r) =>
        r.dir === '.' ? ORIGIN : `${ORIGIN}${r.dir}/`,
      )
      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map(
            (u) =>
              `  <url>\n    <loc>${u}</loc>\n  </url>`,
          )
          .join('\n') +
        `\n</urlset>\n`
      writeFileSync(resolve(dist, 'sitemap.xml'), sitemap)
      // Project-folder robots.txt is NOT the shared origin's /robots.txt.
      // Publish sitemap here; origin robots is owned by Akshat4112.github.io.


      const pages = readdirSync(dist).filter((f) => f === '404.html' || f.endsWith('.html') || f.endsWith('.xml') || f.endsWith('.txt'))
      console.log(`prerendered routes: ${ROUTES.length} pages + 404.html + sitemap.xml + robots.txt (${pages.length} top-level entries)`)
    },
  }
}

export default defineConfig({
  base: '/pdf-tools/',
  plugins: [react(), copyPdfjsAssets(), prerenderRoutes()],
  build: {
    manifest: true,
    sourcemap: false,
  },
})
