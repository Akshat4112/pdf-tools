import type { ToolDefinition } from '../registry'

/**
 * PT-SEO-010 staged DE tool-page renderer.
 *
 * This function never creates a public route, canonical or hreflang on its
 * own. It may only be used for a published German tool page once the entire
 * interactive workflow and all no-JS content have passed translation review.
 * Inputs must be trusted authored copy; never document/user-derived data.
 */
export interface GermanToolLandingCopy {
  title: string
  heading: string
  description: string
  steps: readonly [string, string, string]
  limitation: string
}

const htmlEscape = (s: string) =>
  s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]!)

/**
 * Static, readable landing copy for one fully localized tool.
 * It neither mounts nor claims that an interactive German tool is ready.
 */
export function germanToolLandingHtml(
  tool: Pick<ToolDefinition, 'id' | 'route'>,
  copy: GermanToolLandingCopy,
): string {
  if (!/^\/[a-z0-9-]+$/.test(tool.route)) throw new Error('Unsafe tool route')
  if (
    !copy.heading.trim() || !copy.description.trim() ||
    copy.steps.length !== 3 || copy.steps.some(s => !s.trim()) ||
    !copy.limitation.trim()
  ) throw new Error('Incomplete German tool content')
  const toolPath = tool.route.slice(1)
  const englishHref = `/pdf-tools/${toolPath}/`
  return `<nav class="workspace-breadcrumb" aria-label="Brotkrumennavigation">
    <a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span>
    <span aria-current="page">${htmlEscape(copy.heading)}</span>
  </nav>
  <header class="tool-header">
    <h1 class="tool-heading">${htmlEscape(copy.heading)}</h1>
    <p class="tool-subtitle">${htmlEscape(copy.description)}</p>
  </header>
  <section aria-labelledby="de-steps-${toolPath}">
    <h2 id="de-steps-${toolPath}">So funktioniert es</h2>
    <ol>${copy.steps.map(s => `<li>${htmlEscape(s)}</li>`).join('')}</ol>
  </section>
  <section aria-labelledby="de-limit-${toolPath}">
    <h2 id="de-limit-${toolPath}">Wichtige Hinweise und Grenzen</h2>
    <p>${htmlEscape(copy.limitation)}</p>
    <p>Die Verarbeitung erfolgt in deinem Browser. Beim Laden der Website
       werden Ressourcen von GitHub Pages angefordert. Prüfe das Ergebnis und
       bewahre das Original auf.</p>
    <p>Weitere Informationen: <a href="/pdf-tools/privacy/" lang="en">Datenschutz (Englisch)</a>
       und <a href="/pdf-tools/limitations/" lang="en">Funktionsgrenzen (Englisch)</a>.</p>
  </section>
  <p><a href="${englishHref}" lang="en">English version</a></p>`
}
