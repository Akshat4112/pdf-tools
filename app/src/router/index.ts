/**
 * Path-based router — PT-UX-004 (replaces the PT-CORE-002 interim hash router).
 *
 * Serves real URLs under /pdf-tools/:
 *   /pdf-tools/          -> catalog
 *   /pdf-tools/merge     -> tool entry page (any registry route)
 *   anything else        -> NotFound (client 404)
 *
 * Because GitHub Pages project sites have no SPA rewrite, the build emits a
 * prerendered static HTML entry page per route (vite-plugin-prerender in
 * vite.config.ts) plus 404.html — deep links and refreshes hit real files.
 * Client-side navigation intercepts same-origin <a> clicks so moving between
 * pages doesn't reload the app; applyMeta keeps <title>/canonical in sync.
 */

import { useEffect, useState } from 'react'
import { toolByRoute } from '../registry'
import { applyMeta, CATALOG_META, NOT_FOUND_META, SITE_BASE, toolPageMeta } from '../lib/seo'

export interface Route {
  /** 'catalog', a tool id, or 'not-found' */
  name: 'catalog' | 'not-found' | string
  /** the pathname this route was parsed from (for diagnostics/tests) */
  path: string
}

/** Site base path with trailing slash stripped for matching: '/pdf-tools'. */
const BASE = SITE_BASE.replace(/\/$/, '')

/** Strip <base>/prefix and leading slash: '/pdf-tools/merge' -> '/merge'. */
export function routePathOf(pathname: string): string {
  let p = pathname
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length)
  if (!p.startsWith('/')) p = `/${p}`
  // ignore trailing slashes except for the bare base
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

/** Parse a pathname into a Route (pure — unit tested). */
export function parsePath(pathname: string): Route {
  const p = routePathOf(pathname)
  if (p === '/' || p === '') return { name: 'catalog', path: p }
  const tool = toolByRoute(p)
  if (tool) return { name: tool.id, path: p }
  return { name: 'not-found', path: p }
}

/** Absolute href for a route path, e.g. '/merge' -> '/pdf-tools/merge'. */
export function href(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${BASE}${clean === '/' ? '/' : clean}`
}

/** Metadata for a route (pure — used by router + prerender plugin + tests). */
export function metaForRoute(route: Route): typeof CATALOG_META {
  if (route.name === 'catalog') return CATALOG_META
  if (route.name === 'not-found') return NOT_FOUND_META
  const tool = toolByRoute(route.path)
  return tool ? toolPageMeta(tool) : NOT_FOUND_META
}

/**
 * Router hook: path-based, history API. Intercepts same-origin link clicks
 * so in-app navigation doesn't trigger a full page load; popstate handles
 * back/forward and initial deep links load via prerendered pages.
 */
export function usePathRoute(): [Route, (path: string) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { name: 'catalog', path: '/' } : parsePath(window.location.pathname),
  )

  useEffect(() => {
    const sync = () => setRoute(parsePath(window.location.pathname))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  // keep document metadata in sync with the active route (PT-UX-004)
  useEffect(() => {
    applyMeta(metaForRoute(route))
  }, [route])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      const path = routePathOf(url.pathname)
      // only intercept registry routes + the catalog; let real files
      // (assets, sitemap.xml, robots.txt) and unknown paths behave normally
      const isCatalog = path === '/' || path === ''
      const isTool = Boolean(toolByRoute(path))
      if (!isCatalog && !isTool) return
      e.preventDefault()
      const next = `${SITE_BASE}${path === '/' ? '' : path.replace(/^\//, '')}`
      if (next !== window.location.pathname) window.history.pushState({}, '', next)
      setRoute(parsePath(url.pathname))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const navigate = (path: string) => {
    const next = href(path)
    window.history.pushState({}, '', next)
    setRoute(parsePath(next))
  }

  return [route, navigate]
}
