import { describe, expect, it, afterEach } from 'vitest'
import { hasTranslation, setLocale, translate } from '../i18n'

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
})
