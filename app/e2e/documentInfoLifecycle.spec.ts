import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// PT-IMP-009: independently validate a non-download PDF workflow, rather than
// treating Merge/Split output checks as evidence for every released tool.
test('PT-IMP-009 document information: repeated inspection, reset and privacy', async ({ page }) => {
  const requests: Array<{ method: string; url: string }> = []
  const sockets: string[] = []
  const errors: string[] = []
  const consoleLeaks: string[] = []
  const filename = 'pt-imp009-confidential-info.pdf'
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }))
  page.on('websocket', socket => sockets.push(socket.url()))
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.text().includes(filename)) consoleLeaks.push(message.text())
  })
  await page.addInitScript(() => {
    const urls = new Set<string>()
    const workers = new Set<Worker>()
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url }
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url) }
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); workers.add(this) }
      terminate() { workers.delete(this); super.terminate() }
    }
    Object.assign(window, { documentInfoResources: { urls, workers } })
  })
  await page.goto('doc-info/')
  const origin = new URL(page.url()).origin
  const bytes = await readFile('../fixtures/pdf/F-001-plain-text-3p.pdf')
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('input[type=file]').setInputFiles({
      name: filename, mimeType: 'application/pdf', buffer: bytes,
    })
    await expect(page.locator('.file-row')).toHaveCount(1)
    await page.getByRole('button', { name: 'Inspect PDF', exact: true }).click()
    const summary = page.getByRole('region', { name: 'Document summary' })
    // The information tool does not export a file: its independently verified
    // output is the displayed metadata and the full page-geometry table.
    await expect(summary).toBeVisible()
    await expect(summary.locator('dd').filter({ hasText: /^3$/ })).toHaveCount(1)
    await expect(page.getByRole('region', { name: 'Page dimensions' }).locator('tbody tr')).toHaveCount(3)
    await page.getByRole('button', { name: 'Start over', exact: true }).click()
    await expect(summary).toHaveCount(0)
    await expect(page.locator('.file-row')).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    await expect.poll(() => page.evaluate(() => {
      const state = (window as unknown as { documentInfoResources: { urls: Set<string>; workers: Set<Worker> } }).documentInfoResources
      return { urls: state.urls.size, workers: state.workers.size }
    })).toEqual({ urls: 0, workers: 0 })
  }
  expect(requests.filter(request => !['GET', 'HEAD'].includes(request.method))).toEqual([])
  expect(requests.filter(request => new URL(request.url).origin !== origin)).toEqual([])
  expect(requests.filter(request => request.url.includes(filename))).toEqual([])
  expect(sockets).toEqual([])
  expect(consoleLeaks).toEqual([])
  expect(errors).toEqual([])
  await page.reload()
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Document summary' })).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
})
