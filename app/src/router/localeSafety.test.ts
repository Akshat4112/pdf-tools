import { describe, expect, it } from 'vitest'
import { parsePath, routePathOf } from './index'

describe('PT-SEO-010 locale routing safety', () => {
  it('retains current English public routing', () => {
    expect(parsePath('/pdf-tools/').name).toBe('catalog')
    expect(parsePath('/pdf-tools/merge/').name).toBe('merge')
    expect(routePathOf('/pdf-tools/merge/')).toBe('/merge')
  })
  it('does not treat unshipped German pages as indexable English routes', () => {
    expect(parsePath('/pdf-tools/de/').name).toBe('not-found')
    expect(parsePath('/pdf-tools/de/merge/').name).toBe('not-found')
  })
  it('does not confuse unrelated shared-origin prefixes with the project base', () => {
    expect(routePathOf('/pdf-tools-extra/merge')).toBe('/pdf-tools-extra/merge')
    expect(parsePath('/pdf-tools-extra/merge').name).toBe('not-found')
  })
})
