/**
 * 404 screen — PT-UX-004.
 *
 * Rendered client-side for unknown in-app paths and shipped statically as
 * 404.html (GitHub Pages serves 404.html for unknown paths). Content is
 * static copy only — never reflects any document data.
 */

import { SITE_BASE } from '../lib/seo'

export function NotFound() {
  return (
    <section className="not-found" aria-label="Page not found">
      <p className="nf-code">404</p>
      <h1 className="nf-title">This page doesn't exist.</h1>
      <p className="nf-text">
        The address may be mistyped, or the page moved. Everything PDF Tools
        offers is one click away in the catalog.
      </p>
      <p>
        <a className="btn-primary" href={SITE_BASE}>
          Back to all tools
        </a>
      </p>
    </section>
  )
}
