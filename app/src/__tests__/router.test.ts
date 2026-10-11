import { describe, expect, it } from 'vitest'
import { href, metaForRoute, parsePath, routePathOf } from '../router'
import { TOOLS } from '../registry'

describe('path router (PT-UX-004)', () => {
  it('parses the catalog from the bare base path', () => {
    expect(parsePath('/pdf-tools/').name).toBe('catalog')
    expect(parsePath('/pdf-tools').name).toBe('catalog')
    expect(parsePath('/').name).toBe('catalog')
    expect(parsePath('').name).toBe('catalog')
  })

  it('parses every registry route to its tool id', () => {
    for (const tool of TOOLS) {
      const r = parsePath(`/pdf-tools${tool.route}`)
      expect(r.name).toBe(tool.id)
      expect(r.path).toBe(tool.route)
    }
  })

  it('tolerates trailing slashes on tool routes', () => {
    expect(parsePath('/pdf-tools/merge/').name).toBe('merge')
  })

  it('unknown paths yield the not-found route', () => {
    expect(parsePath('/pdf-tools/nope').name).toBe('not-found')
    expect(parsePath('/pdf-tools/nope/deeper').name).toBe('not-found')
    expect(parsePath('/pdf-tools/merge/extra').name).toBe('not-found')
  })

  it('href() prefixes the site base for navigation', () => {
    expect(href('/')).toBe('/pdf-tools/')
    expect(href('/merge')).toBe('/pdf-tools/merge')
  })

  it('routePathOf strips the base regardless of trailing slash', () => {
    expect(routePathOf('/pdf-tools/merge')).toBe('/merge')
    expect(routePathOf('/pdf-tools/merge/')).toBe('/merge')
    expect(routePathOf('/pdf-tools/')).toBe('/')
    expect(routePathOf('/')).toBe('/')
  })

  it('metaForRoute returns per-route metadata', () => {
    expect(metaForRoute(parsePath('/pdf-tools/merge')).title).toBe('Merge PDF — PDF Tools')
    expect(metaForRoute(parsePath('/pdf-tools/')).title).toContain('PDF Tools')
    expect(metaForRoute(parsePath('/pdf-tools/xyz')).title).toContain('not found')
  })
})
