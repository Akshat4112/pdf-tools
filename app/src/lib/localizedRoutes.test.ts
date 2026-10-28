import { describe, expect, it } from 'vitest'
import { alternatesForApprovedPair, localizedPath, parseLocalizedPath } from './localizedRoutes'

describe('PT-SEO-010 staged locale paths', () => {
  it('keeps existing English public routes and maps German routes predictably', () => {
    expect(localizedPath('/', 'en')).toBe('/pdf-tools/')
    expect(localizedPath('/merge', 'en')).toBe('/pdf-tools/merge/')
    expect(localizedPath('/merge/', 'de')).toBe('/pdf-tools/de/merge/')
    expect(localizedPath('/pdf-tools/privacy/', 'de')).toBe('/pdf-tools/de/privacy/')
    expect(localizedPath('/de/merge/', 'en')).toBe('/pdf-tools/merge/')
  })
  it('recognizes direct loads without a stored preference', () => {
    expect(parseLocalizedPath('/pdf-tools/merge/')).toEqual({ locale: 'en', path: '/merge' })
    expect(parseLocalizedPath('/pdf-tools/de/merge/')).toEqual({ locale: 'de', path: '/merge' })
    expect(parseLocalizedPath('/pdf-tools/de/')).toEqual({ locale: 'de', path: '/' })
    expect(parseLocalizedPath('/unrelated/merge/')).toBeNull()
  })
  it('creates correct alternatives only when explicitly requested by an approved caller', () => {
    expect(alternatesForApprovedPair('/merge')).toEqual([
      { hreflang: 'en', href: 'https://akshat4112.github.io/pdf-tools/merge/' },
      { hreflang: 'de', href: 'https://akshat4112.github.io/pdf-tools/de/merge/' },
    ])
  })
  it('rejects path traversal-like locale inputs', () => {
    expect(() => localizedPath('/../privacy', 'de')).toThrow()
    expect(() => localizedPath('/%2e%2e/privacy', 'de')).toThrow()
  })
})
