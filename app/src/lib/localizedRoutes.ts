/** PT-SEO-010: canonical path mapping for the staged bilingual rollout.
 * Pure helpers only: creating a localized URL does NOT authorize indexing it.
 * Callers must gate alternate links on fully translated/prerendered pages.
 */
export type PageLocale = 'en' | 'de'
export const LOCALE_BASE = '/pdf-tools/'
const DE_PREFIX = '/pdf-tools/de/'
const PUBLIC_ORIGIN = 'https://akshat4112.github.io'

/** Explicit release gate: other translated UI does not create a public URL. */
export function hasGermanPage(path: string): boolean {
  return path === '/' || path === '/merge' || path === '/split' || path === '/rotate'
}

/** Document-free alternates for the approved language pairs. */
export function approvedLanguageAlternates(canonical: string): readonly { hreflang: string; href: string }[] {
  const url = new URL(canonical)
  const route = parseLocalizedPath(url.pathname)
  if (url.origin !== PUBLIC_ORIGIN || !route || !hasGermanPage(route.path)) return []
  const en = PUBLIC_ORIGIN + localizedPath(route.path, 'en')
  const de = PUBLIC_ORIGIN + localizedPath(route.path, 'de')
  return [{ hreflang: 'en', href: en }, { hreflang: 'de', href: de }, { hreflang: 'x-default', href: en }]
}

/** Public default English URLs remain stable and unprefixed. */
export function localizedPath(path: string, locale: PageLocale): string {
  const raw = path.split(/[?#]/, 1)[0] || '/'
  const trimmed = raw.replace(/^\/pdf-tools\//, '/').replace(/^\/de\//, '/')
  const segments = trimmed.split('/').filter(Boolean)
  if (segments.some(segment => segment === '.' || segment === '..' || /%2f|%5c|%2e/i.test(segment))) {
    throw new Error('Unsafe localized route')
  }
  return (locale === 'de' ? DE_PREFIX : LOCALE_BASE) + (segments.length ? segments.join('/') + '/' : '')
}

/** Get the path and language from a public route, without altering user files. */
export function parseLocalizedPath(pathname: string): { locale: PageLocale; path: string } | null {
  if (pathname !== '/pdf-tools' && !pathname.startsWith(LOCALE_BASE)) return null
  if (pathname === '/pdf-tools') return { locale: 'en', path: '/' }
  const german = pathname === '/pdf-tools/de' || pathname.startsWith(DE_PREFIX)
  const base = german ? '/pdf-tools/de' : '/pdf-tools'
  const stripped = pathname.slice(base.length).replace(/\/$/, '') || '/'
  if (stripped === '/404.html') return { locale: german ? 'de' : 'en', path: stripped }
  return { locale: german ? 'de' : 'en', path: stripped }
}

/** Only use after both localized pages have passed complete-content review. */
export function alternatesForApprovedPair(englishPath: string): readonly { hreflang: PageLocale; href: string }[] {
  const en = localizedPath(englishPath, 'en')
  const de = localizedPath(englishPath, 'de')
  return [
    { hreflang: 'en', href: 'https://akshat4112.github.io' + en },
    { hreflang: 'de', href: 'https://akshat4112.github.io' + de },
  ] as const
}
