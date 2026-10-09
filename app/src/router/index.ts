/**
 * Hash-based router — PT-CORE-002 (interim; full static routes land in PT-UX-004).
 *
 * Serves tool pages under /pdf-tools/#<route> today so deep links work without
 * server-side rewrites; PT-UX-004 migrates to path routes + sitemap + 404.
 */

import { useEffect, useState } from 'react'
import { toolByRoute } from '../registry'

export interface Route {
  /** 'catalog' or a tool id */
  name: 'catalog' | string
}

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  if (!clean) return { name: 'catalog' }
  const tool = toolByRoute(`/${clean}`)
  return { name: tool ? tool.id : 'catalog' }
}

export function useHashRoute(): [Route, (hash: string) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { name: 'catalog' } : parseHash(window.location.hash),
  )
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = (hash: string) => {
    window.location.hash = hash
  }
  return [route, navigate]
}
