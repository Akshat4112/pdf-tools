import { describe, expect, it, afterEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hasTranslation, localeForPath, setLocale, translate } from '../i18n'
import { ToolLoadBoundary, ToolLoading } from '../components/ToolLoadBoundary'
import { parseRangeGroups, splitEveryN } from '../lib/pageRanges'

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
  it('translates all split modes, hints, warnings, progress and recovery', () => {
    for (const message of [
      'Split configuration',
      'Split mode',
      'How should it be split?',
      'Custom ranges',
      'Every N pages',
      'One file per page',
      'e.g. 1-5, 8, 12-30 — one PDF per range',
      'fixed-size chunks covering the whole document',
      'every page becomes its own PDF',
      'Ranges (comma separated)',
      'Pages per file',
      'Split preview',
      'Split PDF',
      'Select a PDF to split. It is processed entirely on your device.',
      'Reading the document…',
      'One range produces a single file — add another range or use Extract pages.',
      'One range produces a single file. Add another range, or use Extract pages for one document.',
      'A new ZIP is created; your original stays untouched.',
      'No file selected yet.',
      'Fix the split configuration above.',
      'This configuration would not split anything.',
      'Splitting your PDF',
      'Select at least one range to continue.',
      'Select at least one page to continue.',
      'Chunk size must be a whole number of pages.',
      'Unknown split mode.',
      'This PDF has no pages.',
      'The generated ZIP did not pass verification.',
      'Nothing to package.',
      'Invalid output extension.',
      'An archive filename failed safety verification.',
    ]) {
      expect(hasTranslation(message), message).toBe(true)
      expect(translate(message, 'de'), message).not.toBe(message)
      expect(translate(message, 'en'), message).toBe(message)
    }
  })
  it('preserves split counts, page groups, progress and limits in German', () => {
    expect(translate('3 files from a 5-page document, zipped into one download.', 'de')).toBe('3 Dateien aus einem Dokument mit 5 Seiten, als ZIP-Datei in einem Download.')
    expect(translate('1 file from a 1-page document, zipped into one download.', 'de')).toBe('1 Datei aus einem Dokument mit 1 Seite, als ZIP-Datei in einem Download.')
    expect(translate('Parts: 1–2, 3–4, 5', 'de')).toBe('Teile: 1–2, 3–4, 5')
    expect(translate('verifying part 2 of 3…', 'de')).toBe('Teil 2 von 3 wird geprüft …')
    expect(translate('This split would create 301 files; the current limit is 300.', 'de')).toBe('Diese Teilung würde 301 Dateien erzeugen; die aktuelle Grenze liegt bei 300.')
    expect(translate('The result would contain 301 files; the current limit is 300.', 'de')).toBe('Das Ergebnis würde 301 Dateien enthalten; die aktuelle Grenze liegt bei 300.')
    expect(translate('Page 6 is not valid for a 5-page document.', 'de')).toBe('Seite 6 ist für ein Dokument mit 5 Seiten ungültig.')
    expect(translate('The generated PDF has 2 pages but 3 were expected.', 'de')).toBe('Die erzeugte PDF-Datei hat 2 Seiten; erwartet wurden 3.')
  })
  it('translates actual range validation errors while preserving entered tokens verbatim', () => {
    const cases: Array<{ run: () => unknown; expected: string }> = [
      { run: () => parseRangeGroups('', 5), expected: 'Wähle mindestens einen Seitenbereich aus.' },
      { run: () => parseRangeGroups('6', 5), expected: "Der Bereich '6' ist für ein Dokument mit 5 Seiten ungültig." },
      { run: () => parseRangeGroups('05 - 02', 5), expected: "Der Bereich '05 - 02' verläuft rückwärts." },
      { run: () => splitEveryN(5, 1.5), expected: 'Die Anzahl der Seiten pro Datei muss eine positive ganze Zahl sein.' },
      { run: () => splitEveryN(5, 6), expected: 'Die Anzahl von 6 Seiten pro Datei ist größer als das Dokument mit 5 Seiten.' },
    ]
    for (const token of ['Merge PDF.pdf', "'quoted'", '<script>alert(1)</script>', 'Überblick\n2026']) {
      cases.push({ run: () => parseRangeGroups(token, 5), expected: `'${token}' ist keine gültige Seite oder kein gültiger Seitenbereich.` })
    }
    for (const { run, expected } of cases) {
      let message = ''
      try { run() } catch (error) { message = (error as { message: string }).message }
      expect(message).not.toBe('')
      expect(translate(message, 'de')).toBe(expected)
      expect(translate(message, 'en')).toBe(message)
    }
  })
  it('keeps split-looking filenames and arbitrary parts text outside dynamic translations', () => {
    for (const text of [
      'Parts: Merge PDF.pdf',
      'Parts: 1–2, 3.pdf',
      '3 files from a 5-page document, zipped into one download..pdf',
      'verifying part 2 of 3….pdf',
      "'bad' is not a valid page or range..pdf",
      "Range '6' is not valid for a 5-page document..pdf",
      "Range '5-2' runs backwards..pdf",
      'Chunk size 6 is larger than the 5-page document..pdf',
      'This split would create 301 files; the current limit is 300..pdf',
    ]) expect(translate(text, 'de'), text).toBe(text)
  })
  it('initializes German only for the published catalog, merge, split, rotate, delete and extract pages routes', () => {
    for (const path of ['/pdf-tools/de', '/pdf-tools/de/', '/pdf-tools/de/merge', '/pdf-tools/de/merge/', '/pdf-tools/de/split', '/pdf-tools/de/split/', '/pdf-tools/de/rotate', '/pdf-tools/de/rotate/', '/pdf-tools/de/delete-pages', '/pdf-tools/de/delete-pages/', '/pdf-tools/de/extract-pages', '/pdf-tools/de/extract-pages/', '/pdf-tools/de/organize', '/pdf-tools/de/organize/', '/pdf-tools/de/images-to-pdf', '/pdf-tools/de/images-to-pdf/']) expect(localeForPath(path), path).toBe('de')
    for (const path of ['/pdf-tools/', '/pdf-tools/merge/', '/pdf-tools/split/', '/pdf-tools/de/rotate-extra/', '/pdf-tools/de/merge-extra/', '/pdf-tools/de/split-extra/', '/pdf-tools-extra/de/merge/', '/another-project/de/merge/', '/another-project/de/split/', '/pdf-tools/de/merge/extra', '/pdf-tools/de/split/extra']) expect(localeForPath(path), path).toBe('en')
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
