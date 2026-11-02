import { describe, expect, it, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hasTranslation, localeForPath, setLocale, translate } from '../i18n'
import { ToolLoadBoundary, ToolLoading } from '../components/ToolLoadBoundary'

afterEach(() => setLocale('en'))

describe('PT-UX-005 interface translations', () => {
  it('keeps English output stable and localizes known interface messages', () => {
    expect(translate('Merge PDF', 'en')).toBe('Merge PDF')
    expect(translate('Merge PDF', 'de')).toBe('PDF zusammenfügen')
    expect(translate('Start over', 'de')).toBe('Neu beginnen')
    expect(hasTranslation('File selection')).toBe(true)
  })
  it('keeps unknown messages, file names and document text exactly unchanged', () => {
    expect(translate('financial-statement_PRIVATE.pdf', 'de')).toBe('financial-statement_PRIVATE.pdf')
    expect(translate('Invoice 2026 — EUR', 'de')).toBe('Invoice 2026 — EUR')
  })
  it('interpolates only bounded UI number patterns', () => {
    expect(translate('Up to 50 MB per file · 300 pages · processed locally', 'de')).toContain('300 Seiten')
    expect(translate('3 files were generated and verified.', 'de')).toBe('3 Dateien wurden erstellt und geprüft.')
  })
  it('translates merge guidance, processing and recovery without interpreting filenames', () => {
    for (const message of [
      'Merge order',
      'Merging your PDFs',
      'Select at least two PDFs to merge. Files merge in the order shown — use the arrows to reorder.',
      'Add at least one more PDF to merge.',
      'A new file is created; your originals are untouched.',
      'counting pages…',
      'This file could not be read as a PDF.',
      'The generated PDF did not pass structure verification.',
      'No download is available from this attempt.',
      'This attempt was cancelled. No partial result is available to download. You can adjust the settings and try again.',
    ]) {
      expect(hasTranslation(message), message).toBe(true)
      expect(translate(message, 'de'), message).not.toBe(message)
      expect(translate(message, 'en'), message).toBe(message)
    }
    expect(translate('Order: Merge PDF.pdf → Start over.pdf', 'de')).toBe('Order: Merge PDF.pdf → Start over.pdf')
    expect(translate('2 PDFs will be merged top to bottom, producing one document with their combined pages..pdf', 'de')).toBe('2 PDFs will be merged top to bottom, producing one document with their combined pages..pdf')
  })
  it('preserves numeric merge counts and explicit failure limits in German', () => {
    expect(translate('2 PDFs will be merged top to bottom, producing one document with their combined pages.', 'de')).toBe('2 PDFs werden von oben nach unten zu einem Dokument mit allen enthaltenen Seiten zusammengefügt.')
    expect(translate('This file exceeds the current limit of 50 MB.', 'de')).toBe('Diese Datei überschreitet die aktuelle Grenze von 50 MB.')
    expect(translate('The merged result would have 301 pages; the current limit is 300.', 'de')).toBe('Das zusammengefügte Ergebnis hätte 301 Seiten; die aktuelle Grenze liegt bei 300.')
    expect(translate('This document has 301 pages; the current limit is 300.', 'de')).toBe('Dieses Dokument hat 301 Seiten; die aktuelle Grenze liegt bei 300.')
    expect(translate('The generated PDF has 1 pages but 2 were expected.', 'de')).toBe('Die erzeugte PDF-Datei hat 1 Seite; erwartet wurden 2.')
  })
  it('initializes German only for the published catalog and merge routes', () => {
    for (const path of ['/pdf-tools/de', '/pdf-tools/de/', '/pdf-tools/de/merge', '/pdf-tools/de/merge/']) expect(localeForPath(path), path).toBe('de')
    for (const path of ['/pdf-tools/', '/pdf-tools/merge/', '/pdf-tools/de/split/', '/pdf-tools/de/merge-extra/', '/pdf-tools-extra/de/merge/', '/another-project/de/merge/', '/pdf-tools/de/merge/extra']) expect(localeForPath(path), path).toBe('en')
  })
  it('keeps inline guidance failures separate from the working tool and its navigation', () => {
    const props = { title: 'Usage guidance', onExit: () => {}, children: null, subject: 'guide' as const, headingLevel: 2 as const }
    const inline = new ToolLoadBoundary(props)
    inline.state = { failed: true }
    const failed = renderToStaticMarkup(inline.render())
    expect(failed).toContain('<h2')
    expect(failed).not.toContain('<h1')
    expect(failed).toContain('The tool remains available.')
    expect(failed).not.toContain('<button')
    expect(renderToStaticMarkup(createElement(ToolLoading, props))).not.toContain('<button')
    expect(translate('Usage guidance could not load. The tool remains available.', 'de')).toBe('Die Anleitung konnte nicht geladen werden. Das Werkzeug bleibt verfügbar.')
    const tool = new ToolLoadBoundary({ title: 'Merge PDF', onExit: () => {}, children: null })
    tool.state = { failed: true }
    const toolFailure = renderToStaticMarkup(tool.render())
    expect(toolFailure).toContain('<h1')
    expect(toolFailure).toContain('Reload tool')
    expect(toolFailure).toContain('Back to all tools')
  })
})
