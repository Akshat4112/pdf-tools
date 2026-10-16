import { expect, type BrowserContext, type Page } from '@playwright/test'
import { readdirSync } from 'node:fs'

function files(directory: URL, prefix: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`) : [prefix + entry.name])
}
const assets = new Set([
  ...files(new URL('../../dist/assets/', import.meta.url), '/pdf-tools/assets/'),
  '/pdf-tools/favicon.svg', '/pdf-tools/brand/logo-light.svg', '/pdf-tools/brand/logo-dark.svg',
])
interface AuditState {
  urls: Set<string>; workers: Set<Worker>; writes: string[]; channels: string[]
  workerVerbosity: number[]
}
declare global { interface Window { privacyAudit: AuditState } }

/** Test-only observers call the native APIs; they never suppress an app write or retain bytes. */
export async function installPrivacyAudit(page: Page, context: BrowserContext, route: string) {
  const violations: string[] = [], logs: string[] = [], requests: string[] = []
  await context.route('**/*', request => {
    const req = request.request(), url = new URL(req.url())
    if (['blob:', 'data:'].includes(url.protocol)) return request.continue()
    const allowed = url.origin === 'http://127.0.0.1:4178' && !url.search &&
      (assets.has(url.pathname) || url.pathname === `/pdf-tools/${route}/`)
    // No POST/Beacon/form bodies, query strings, private path names, or telemetry URLs.
    if (!allowed || req.method() !== 'GET' || req.postDataBuffer() !== null) {
      violations.push('unexpected-request'); return request.abort()
    }
    requests.push(url.pathname)
    return request.continue()
  })
  page.on('console', message => logs.push(message.text()))
  page.on('pageerror', () => violations.push('page-error'))
  page.on('dialog', dialog => { violations.push('unexpected-dialog'); void dialog.dismiss() })
  await page.addInitScript(() => {
    const state: AuditState = { urls: new Set(), workers: new Set(), writes: [], channels: [], workerVerbosity: [] }
    window.privacyAudit = state
    // Prove reset does not wipe a sibling project's origin-scoped preferences.
    const set = Storage.prototype.setItem
    set.call(localStorage, 'sibling-demo:keep', 'unchanged')
    set.call(sessionStorage, 'sibling-demo:keep', 'unchanged')
    for (const key of ['setItem', 'removeItem', 'clear'] as const) {
      const native = Storage.prototype[key]
      Object.defineProperty(Storage.prototype, key, { value: function(this: Storage, ...args: string[]) {
        state.writes.push(key); return Reflect.apply(native, this, args)
      } })
    }
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
    Object.defineProperty(Document.prototype, 'cookie', { ...cookie, set(value: string) {
      state.writes.push('cookie'); cookie.set!.call(this, value)
    } })
    const openDatabase = indexedDB.open.bind(indexedDB)
    indexedDB.open = (...args: Parameters<IDBFactory['open']>) => { state.writes.push('indexedDB'); return openDatabase(...args) }
    const openCache = caches.open.bind(caches)
    caches.open = async (...args: Parameters<CacheStorage['open']>) => { state.writes.push('cache'); return openCache(...args) }
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker)
    navigator.serviceWorker.register = (...args: Parameters<ServiceWorkerContainer['register']>) => { state.channels.push('service-worker'); return register(...args) }
    const beacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (...args) => { state.channels.push('beacon'); return beacon(...args) }
    const Socket = window.WebSocket, Events = window.EventSource
    window.WebSocket = class extends Socket { constructor(url: string | URL, protocols?: string | string[]) { state.channels.push('websocket'); super(url, protocols) } }
    window.EventSource = class extends Events { constructor(url: string | URL, options?: EventSourceInit) { state.channels.push('event-source'); super(url, options) } }
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = object => { const url = create(object); state.urls.add(url); return url }
    URL.revokeObjectURL = url => { state.urls.delete(url); revoke(url) }
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); state.workers.add(this) }
      terminate() { state.workers.delete(this); super.terminate() }
      postMessage(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions) {
        const msg = message as { action?: string; data?: { verbosity?: number } }
        if (msg?.action === 'configure') state.workerVerbosity.push(msg.data?.verbosity ?? -1)
        Reflect.apply(super.postMessage, this, [message, transfer])
      }
    }
  })
  async function snapshot() {
    return {
      ...await page.evaluate(async () => ({
        local: { ...localStorage }, session: { ...sessionStorage },
        databases: (await indexedDB.databases()).map(database => database.name),
        caches: await caches.keys(), registrations: (await navigator.serviceWorker.getRegistrations()).length,
      })), cookies: await context.cookies(),
    }
  }
  async function assertPrivate(baseline: Awaited<ReturnType<typeof snapshot>>) {
    expect(await snapshot()).toEqual(baseline)
    expect(violations).toEqual([])
    expect(logs).toEqual([])
    expect(await page.evaluate(() => ({ writes: window.privacyAudit.writes, channels: window.privacyAudit.channels,
      verbosity: window.privacyAudit.workerVerbosity.filter(level => level !== 0) }))).toEqual({ writes: [], channels: [], verbosity: [] })
    expect(page.url()).toBe(`http://127.0.0.1:4178/pdf-tools/${route}/`)
    expect(await page.evaluate(() => history.state)).toBeNull()
    await expect(page).toHaveTitle(/PDF Tools/)
  }
  async function assertClean() {
    await expect.poll(() => page.evaluate(() => ({ urls: window.privacyAudit.urls.size, workers: window.privacyAudit.workers.size }))).toEqual({ urls: 0, workers: 0 })
    await expect(page.locator('.file-row, .reader-print-frame')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0)
    expect(await page.locator('input[type=file]').evaluateAll(inputs => inputs.every(input => !(input as HTMLInputElement).files?.length))).toBe(true)
  }
  return { snapshot, assertPrivate, assertClean, requests }
}
