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
      console.log('copied pdf.worker.min.mjs + standard_fonts -> dist/assets/')
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
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist')
      const indexPath = resolve(dist, 'index.html')
      if (!existsSync(indexPath)) throw new Error('prerender: dist/index.html missing')
      const indexHtml = readFileSync(indexPath, 'utf-8')

      // Route table mirrors src/lib/seo.ts + src/router (registry-driven).
      // Kept in the config (not imported from src) because vite.config runs
      // in Node without the app's TS context; the registry is the source of
      // truth and these values are asserted equal in unit tests.
      const ROUTES: Array<{ dir: string; title: string; description: string }> = [
        {
          dir: '.',
          title: 'PDF Tools — free local PDF tools in your browser',
          description:
            'Merge, split, convert and inspect PDFs free in your browser. No accounts, no uploads — your files are processed entirely on your own device.',
        },
        { dir: 'merge', title: 'Merge PDF — PDF Tools', description: 'Combine PDFs in your chosen order into one document. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'split', title: 'Split PDF — PDF Tools', description: 'Split by page ranges, every N pages, or one file per page. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'rotate', title: 'Rotate PDF — PDF Tools', description: 'Rotate selected or all pages in 90° steps. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'delete-pages', title: 'Delete pages — PDF Tools', description: 'Remove selected pages into a new copy. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'extract-pages', title: 'Extract pages — PDF Tools', description: 'Pull selected pages into a new PDF, in the order you choose. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'organize', title: 'Organize PDF — PDF Tools', description: 'Reorder, rotate, duplicate and delete pages with undo. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'images-to-pdf', title: 'JPG/PNG to PDF — PDF Tools', description: 'Turn JPG or PNG images into one PDF with size and margin options. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'pdf-to-jpg', title: 'PDF to JPG — PDF Tools', description: 'Render pages to JPG images at a chosen DPI. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'pdf-to-png', title: 'PDF to PNG — PDF Tools', description: 'Render pages to PNG images with an explicit background choice. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'reader', title: 'PDF reader — PDF Tools', description: 'Read, search, copy and print — entirely locally. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'page-numbers', title: 'Page numbers — PDF Tools', description: 'Add page numbers with start, position and page selection. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'watermark', title: 'Text watermark — PDF Tools', description: 'Stamp a text watermark with position, opacity and page selection. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'pdf-to-text', title: 'PDF to text — PDF Tools', description: 'Export the text layer of a PDF as a UTF-8 .txt file. Runs entirely in your browser — no uploads, no accounts.' },
        { dir: 'doc-info', title: 'Document information — PDF Tools', description: 'Inspect page count, dimensions, metadata and indicators. Runs entirely in your browser — no uploads, no accounts.' },
      ]

      const ORIGIN = 'https://akshat4112.github.io/pdf-tools/'

      const metaFor = (dir: string, title: string, description: string): string => {
        // 404.html is a file (not a clean URL route) — canonical must match
        // NOT_FOUND_META in src/lib/seo.ts (asserted in unit tests)
        const canonical = dir === '.' ? ORIGIN : dir === '404' ? `${ORIGIN}404.html` : `${ORIGIN}${dir}/`
        // strip any tags the base index.html already carries so each page has
        // exactly one canonical/description/OG set (no duplicates)
        let html = indexHtml
          .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(/\s*<meta name="description"[^>]*\/>/, '')
          .replace(/\s*<link rel="canonical"[^>]*\/>/, '')
          .replace(/\s*<meta property="og:[a-z:_]+"[^>]*\/>/g, '')
          .replace(/\s*<meta name="twitter:[a-z:_]+"[^>]*\/>/g, '')
        const head = `  <meta name="description" content="${description}" />\n` +
          `  <link rel="canonical" href="${canonical}" />\n` +
          `  <meta property="og:title" content="${title}" />\n` +
          `  <meta property="og:description" content="${description}" />\n` +
          `  <meta property="og:url" content="${canonical}" />\n` +
          `  <meta property="og:site_name" content="PDF Tools" />\n` +
          `  <meta property="og:type" content="website" />\n` +
          `  <meta name="twitter:card" content="summary" />\n` +
          `  <meta name="twitter:title" content="${title}" />\n` +
          `  <meta name="twitter:description" content="${description}" />\n` +
          `</head>`
        html = html.replace('</head>', head)
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

      // 404.html: static not-found (GH Pages serves this for unknown paths).
      const nfHtml = metaFor(
        '404',
        'Page not found — PDF Tools',
        'This page does not exist. Browse the PDF Tools catalog instead.',
      )
      writeFileSync(resolve(dist, '404.html'), nfHtml)

      // sitemap.xml + robots.txt (registry-driven, same URLs as meta tags).
      const today = new Date().toISOString().slice(0, 10)
      const urls = ROUTES.map((r) =>
        r.dir === '.' ? ORIGIN : `${ORIGIN}${r.dir}/`,
      )
      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map(
            (u) =>
              `  <url>\n    <loc>${u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u === ORIGIN ? '1.0' : '0.8'}</priority>\n  </url>`,
          )
          .join('\n') +
        `\n</urlset>\n`
      writeFileSync(resolve(dist, 'sitemap.xml'), sitemap)
      writeFileSync(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}sitemap.xml\n`)

      const pages = readdirSync(dist).filter((f) => f === '404.html' || f.endsWith('.html') || f.endsWith('.xml') || f.endsWith('.txt'))
      console.log(`prerendered routes: ${ROUTES.length} pages + 404.html + sitemap.xml + robots.txt (${pages.length} top-level entries)`)
    },
  }
}

export default defineConfig({
  base: '/pdf-tools/',
  plugins: [react(), copyPdfjsAssets(), prerenderRoutes()],
  build: {
    sourcemap: false,
  },
})
