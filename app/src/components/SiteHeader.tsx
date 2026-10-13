import { SITE_BASE } from '../lib/seo'

/** The same identity and privacy message on catalog and tool entry pages. */
export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href={SITE_BASE}>
        <span className="brand-mark" aria-hidden="true">PD</span>
        <span className="brand-name">PDF Tools</span>
      </a>
      <span className="privacy-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span><strong>Local processing</strong> — files never leave your browser</span>
      </span>
    </header>
  )
}
