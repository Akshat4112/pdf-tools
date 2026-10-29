import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

type Chunk = { file: string; imports?: string[]; dynamicImports?: string[]; css?: string[] }
const manifest: Record<string, Chunk> = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
function staticAssets(key: string, seen = new Set<string>(), files = new Set<string>()) {
  if (seen.has(key)) return files
  seen.add(key)
  const chunk = manifest[key]
  files.add(chunk.file)
  for (const css of chunk.css ?? []) files.add(css)
  for (const dependency of chunk.imports ?? []) staticAssets(dependency, seen, files)
  return files
}
const initial = staticAssets('index.html')
const mergeFile = manifest['src/components/MergeTool.tsx'].file
const writer = Object.entries(manifest).find(([key]) => key.startsWith('_pdflib-'))![1]
const writerPackages = (writer.dynamicImports ?? []).map(key => manifest[key].file)

test('PT-SEO-007 startup: catalog assets meet budgets and engines wait for documents', async ({ page }) => {
  // PT-SEO-010: the new bilingual catalog URL and reciprocal SEO metadata
  // add 1,759 uncompressed bytes to the measured initial bundle (282,759).
  // Raise the raw cap by just 2 KiB; keep the 88 KiB gzip, CSS, lazy-engine
  // and zero-extra-startup-request gates unchanged.
  for (const [extension, rawMax, gzipMax] of [['.js', 283048, 88000], ['.css', 45000, 10000]] as const) {
    const buffers = [...initial].filter(file => file.endsWith(extension)).map(file => readFileSync(`dist/${file}`))
    expect(buffers.reduce((sum, bytes) => sum + bytes.length, 0)).toBeLessThanOrEqual(rawMax)
    expect(buffers.reduce((sum, bytes) => sum + gzipSync(bytes).length, 0)).toBeLessThanOrEqual(gzipMax)
  }
  const requests: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname.replace('/pdf-tools/', '')))
  for (const route of ['', 'tools/convert/']) {
    requests.length = 0
    await page.goto(route || './')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(requests.filter(path => /\.(?:js|css)$/.test(path)).filter(path => !initial.has(path))).toEqual([])
    expect(requests.filter(path => /\.wasm$|\/cmaps\/|\/standard_fonts\//.test(path))).toEqual([])
  }
  requests.length = 0
  await page.goto('merge/')
  await expect(page.locator('input[type=file]')).toHaveCount(1)
  await page.waitForLoadState('networkidle')
  expect(requests).toContain(mergeFile)
  expect(requests.filter(path => writerPackages.includes(path) || /pdfjs|PdfReaderTool|fontkit|\.wasm$/.test(path))).toEqual([])
})

test('PT-SEO-007 startup: navigation remains usable while a workspace downloads', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(`**/${mergeFile}`, async route => { await gate; await route.continue() })
  try {
    await page.goto('merge/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('status', { exact: true })).toHaveText('Opening this tool…')
    await page.getByRole('button', { name: 'Back to all tools', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Tool catalog' })).toBeVisible()
  } finally { release() }
  await page.waitForLoadState('networkidle')
  await expect(page.locator('input[type=file]')).toHaveCount(0)
})

test('PT-SEO-007 startup: a failed workspace download offers a working reload', async ({ page }) => {
  await page.route(`**/${mergeFile}`, route => route.abort('failed'))
  await page.goto('merge/')
  await expect(page.getByRole('alert')).toContainText('This tool could not open')
  await expect(page.getByRole('button', { name: 'Back to all tools', exact: true })).toBeVisible()
  await page.unroute(`**/${mergeFile}`)
  await page.getByRole('button', { name: 'Reload tool', exact: true }).click()
  await expect(page.locator('input[type=file]')).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
