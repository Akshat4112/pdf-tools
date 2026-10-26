import { describe, expect, it } from 'vitest'
import { publicInfoHtml } from '../lib/publicInfo'
import { infoPageMeta, PUBLIC_PAGES, SITE_URL } from '../lib/pageMetadata'

describe('PT-TRUST-002 public evidence contract', () => {
  const html = publicInfoHtml('/trust')!
  it('publishes a distinct source-backed, indexable route', () => {
    const meta = infoPageMeta('/trust')
    expect(meta?.canonical).toBe(`${SITE_URL}trust/`)
    expect(PUBLIC_PAGES.find(page => page.canonical === meta?.canonical)).toBeTruthy()
    expect(html).toContain('<h1>Trust and transparency</h1>')
    for (const anchor of ['/pdf-tools/privacy/','/pdf-tools/help/','/pdf-tools/limitations/']) expect(html).toContain(anchor)
  })
  it('links evidence and avoids absolute safety or confidential issue claims', () => {
    for (const source of ['blob/main/LICENSE','PT-SEC-002-local-processing-audit.md','PT-OPS-001-pr-task-workflow.md', '/security']) expect(html).toContain(source)
    for (const warning of ['GitHub Pages', 'not an independent audit', 'do not securely overwrite', 'Never attach private', 'not a confidential security inbox']) expect(html).toContain(warning)
    for (const unsupported of ['GDPR-certified','100% secure','independently certified']) expect(html).not.toContain(unsupported)
    expect(html).not.toContain('<input')
  })
  it('does not interpolate query or source-file names', () => {
    expect(publicInfoHtml('/trust?document=secret.pdf')).toBeUndefined()
    expect(infoPageMeta('/trust?document=secret.pdf')).toBeUndefined()
  })
})
