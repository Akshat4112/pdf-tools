import { describe, expect, it } from 'vitest'
import { metaForRoute, parsePath, routePathOf } from './index'

describe('PT-SEO-010 locale routing safety', () => {
  it('retains current English public routing', () => {
    expect(parsePath('/pdf-tools/').name).toBe('catalog')
    expect(parsePath('/pdf-tools/merge/').name).toBe('merge')
    expect(routePathOf('/pdf-tools/merge/')).toBe('/merge')
  })
  it('ships the German catalog but not untranslated German tool pages', () => {
    expect(parsePath('/pdf-tools/de/')).toEqual({ name: 'catalog', path: '/', locale: 'de' })
    expect(metaForRoute(parsePath('/pdf-tools/de/')).canonical).toBe('https://akshat4112.github.io/pdf-tools/de/')
    expect(parsePath('/pdf-tools/de/merge/').name).toBe('not-found')
    expect(parsePath('/pdf-tools/de/privacy/').name).toBe('not-found')
  })
  it('does not confuse unrelated shared-origin prefixes with the project base', () => {
    expect(routePathOf('/pdf-tools-extra/merge')).toBe('/pdf-tools-extra/merge')
    expect(parsePath('/pdf-tools-extra/merge').name).toBe('not-found')
  })
})
