import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProcessingPanel, ResultPanel, FailurePanel } from '../components/ToolScreens'
import { toolError } from '../registry'
import type { VerifiedOutput } from '../outputs/verify'
const noop = () => {}

describe('PT-UI-006 shared panel contracts', () => {
  it('labels unknown work and final verification without invented percentages', () => {
    for (const fraction of [0, 1, NaN]) {
      const html = renderToStaticMarkup(createElement(ProcessingPanel, { label: 'Creating a PDF', progress: { fraction }, onCancel: noop }))
      expect(html).not.toContain('aria-valuenow=')
      expect(html).not.toContain('NaN')
      expect(html).toContain('aria-label="Creating a PDF"')
      expect(html).toContain('Downloads appear after the result passes verification')
    }
  })
  it('announces measured progress with its stage detail', () => {
    const html = renderToStaticMarkup(createElement(ProcessingPanel, { label: 'Splitting', progress: { fraction: .5, detail: 'Part 2 of 4' }, onCancel: noop }))
    expect(html).toContain('aria-valuenow="50"')
    expect(html).toContain('50% — Part 2 of 4')
  })
  it('does not offer success or downloads for missing or inconsistent outputs', () => {
    for (const outputs of [[], [{ name: 'bad.pdf', verified: false, actualBytes: 1, bytes: new Uint8Array(1) }], [{ name: 'short.pdf', verified: true, actualBytes: 2, bytes: new Uint8Array(1) }]]) {
      const html = renderToStaticMarkup(createElement(ResultPanel, { outputs: outputs as VerifiedOutput[], onDownload: noop, onRetry: noop, onReset: noop }))
      expect(html).toContain('No verified result available')
      expect(html).not.toContain('btn-download')
      expect(html).not.toContain('files are ready')
    }
  })
  it('offers the appropriate recovery guidance rather than a generic retry promise', () => {
    const html = renderToStaticMarkup(createElement(FailurePanel, { error: toolError('E-INPUT-04', 'Too large', 'reduce-scope'), onRetry: noop, onReset: noop }))
    expect(html).toContain('Try fewer pages or a lower resolution')
    expect(html).toContain('Review settings')
    expect(html).toContain('Original files and downloads already saved')
  })
})
