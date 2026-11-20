import { test, expect } from '@playwright/test'
import { PDFDocument, degrees } from 'pdf-lib'
import { readFile } from 'node:fs/promises'

test('PT-IMP-009 German Rotate: repeated verified output and reset', async ({ page }) => {
  test.setTimeout(120_000)
  const doc = await PDFDocument.create()
  doc.addPage([300, 400]).setRotation(degrees(90))
  doc.addPage([400, 300])
  const input = Buffer.from(await doc.save())
  const name = 'private-rotate-lifecycle.pdf'
  const requests: Array<{ method: string; url: string }> = []
  const sockets: string[] = []
  const errors: string[] = []
  const leaks: string[] = []
  page.on('request', req => {
    if (/^https?:/.test(req.url())) requests.push({ method: req.method(), url: req.url() })
  })
  page.on('websocket', socket => sockets.push(socket.url()))
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.text().includes(name)) leaks.push(message.text()) })
  const workers = new Set<import('@playwright/test').Worker>()
  page.on('worker', worker => {
    workers.add(worker)
    worker.on('close', () => workers.delete(worker))
  })
  await page.addInitScript(() => {
    const urls = new Set<string>()
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url }
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url) }
    Object.assign(window, { rotateLifecycleUrls: urls })
  })
  await page.goto('de/rotate/')
  const origin = new URL(page.url()).origin
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/pdf', buffer: input })
    await expect(page.locator('.page-pick')).toHaveCount(2)
    await page.locator('.page-pick').first().click()
    await page.getByRole('button', { name: 'Ausgewählte nach rechts drehen' }).click()
    const run = page.getByRole('button', { name: 'Gedrehte Kopie erstellen' })
    await expect(run).toBeEnabled()
    await run.click()
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Herunterladen / }).click()
    const download = await pending
    const output = await PDFDocument.load(await readFile((await download.path())!))
    expect(output.getPageCount()).toBe(2)
    expect(output.getPages().map(p => p.getRotation().angle)).toEqual([180, 0])
    expect(output.getPages().map(p => p.getSize())).toEqual([{ width: 300, height: 400 }, { width: 400, height: 300 }])
    if (cycle === 2) {
      // Abandon a completed result without Start over; history must not
      // restore the private selection or its download after navigation.
      const toolUrl = page.url()
      await page.goto(new URL('../', toolUrl).href)
      await expect.poll(() => workers.size).toBe(0)
      await page.goBack()
      await expect(page).toHaveURL(toolUrl)
    } else {
      await page.getByRole('button', { name: 'Neu beginnen' }).click()
    }
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Herunterladen / })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { rotateLifecycleUrls: Set<string> }).rotateLifecycleUrls.size
    )).toBe(0)
    await expect.poll(() => workers.size).toBe(0)
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  }
  await page.reload()
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Herunterladen / })).toHaveCount(0)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  expect(requests.filter(r => !['GET', 'HEAD'].includes(r.method) || new URL(r.url).origin !== origin || r.url.includes(name))).toEqual([])
  expect(sockets).toEqual([])
  expect(errors).toEqual([])
  expect(leaks).toEqual([])
})
