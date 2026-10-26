import { useLocale } from './i18n'
import { infoPageMeta } from './lib/pageMetadata'
import { categoryHubHtml, hubByPath, hubDirectoryHtml } from './lib/categoryHubs'
import { lazy, Suspense, useEffect } from 'react'
import { guideByPath, guideDirectoryHtml, isGuidePath } from './lib/guideCatalog'
import { ToolLoadBoundary, ToolLoading } from './components/ToolLoadBoundary'
const GuidePage = lazy(() => import('./components/GuidePage').then(module => ({ default: module.GuidePage })))
import { ToolCatalog } from './components/ToolCatalog'
import { ToolEntry } from './components/ToolEntry'
import { NotFound } from './components/NotFound'
import { usePathRoute, href } from './router'
import { TOOLS, toolByRoute } from './registry'
import { SiteHeader } from './components/SiteHeader'

const featured = ['merge', 'split', 'organize', 'images-to-pdf'] as const

function App() {
  const { t } = useLocale()
  const [route, navigate] = usePathRoute()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey &&
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? '') &&
          !(document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable)) {
        const input = document.querySelector<HTMLInputElement>('input[type="search"]')
        if (input) {
          e.preventDefault()
          input.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeTool = route.name !== 'catalog' && route.name !== 'not-found' ? toolByRoute(route.path) : undefined

  if (activeTool) {
    return (
      <div className="shell">
        <SiteHeader key={route.path} />
        <ToolEntry tool={activeTool} onExit={() => navigate('/')} />
      </div>
    )
  }


  if (isGuidePath(route.path) || infoPageMeta(route.path)) {
    const title = guideByPath(route.path)?.title ?? infoPageMeta(route.path)?.title ?? 'Practical PDF guides'
    return <div className="shell"><SiteHeader key={route.path} /><main tabIndex={-1} id="main-content" className="tool-workspace guide-page">
      <ToolLoadBoundary key={route.path} title={title} subject="guide" onExit={() => navigate('/')}>
        <Suspense fallback={<ToolLoading title={title} subject="guide" onExit={() => navigate('/')} />}><GuidePage path={route.path} /></Suspense>
      </ToolLoadBoundary>
    </main></div>
  }

  const hub = hubByPath(route.path)
  if (hub) return <div className="shell"><SiteHeader key={route.path} /><main tabIndex={-1} id="main-content" className="tool-workspace category-hub" dangerouslySetInnerHTML={{ __html: categoryHubHtml(hub) }} /></div>

  if (route.name === 'not-found') {
    return (
      <div className="shell">
        <SiteHeader key={route.path} />
        <main tabIndex={-1} id="main-content"><NotFound /></main>
      </div>
    )
  }

  const quickTools = featured.map((id) => TOOLS.find((tool) => tool.id === id)).filter(
    (tool): tool is (typeof TOOLS)[number] => Boolean(tool?.implemented),
  )

  return (
    <div className="shell fl-home">
      <SiteHeader key={route.path} />
      <main tabIndex={-1} id="main-content">
        <section className="fl-hero" aria-labelledby="home-heading">
          <div className="fl-hero-copy">
            <p className="fl-eyebrow">{t("FREE FOREVER · OPEN SOURCE")}</p>
            <h1 id="home-heading">{t("PDF tools that work in your browser.")}</h1>
            <p className="fl-lead">{t("Merge, split, organize, read and convert PDFs with PDF Tools. Free forever, open source, and processed on your device — no account required.")}</p>
            <div className="fl-hero-actions">
              <a className="fl-cta" href="#tool-catalog">{t("Explore all PDF tools")} <span aria-hidden="true">→</span></a>
              <a className="fl-secondary-link" href="https://github.com/Akshat4112/pdf-tools">{t("View source code")} <span aria-hidden="true">↗</span></a>
            </div>
            <p className="fl-fine-print">{t("This browser-based release does not upload document contents for processing. Loading the site and its assets still connects to GitHub Pages.")}</p>
          </div>
          <div className="fl-hero-art" aria-hidden="true">
            <div className="fl-document fl-doc-back"><span /><span /><span /><span /></div>
            <div className="fl-document fl-doc-front"><div className="fl-doc-symbol">PDF</div><span /><span /><span /></div>
            <div className="fl-art-label">{t("Your files stay in this browser")}</div>
          </div>
        </section>

        <section className="fl-trust-strip" aria-label={t("Product commitments")}>
          <span>{t("Free forever for local tools")}</span>
          <span>{t("Open source · MIT")}</span>
          <span>{t("Files processed in your browser")}</span>
          <span>{t("No account required")}</span>
          <a className="fl-trust-evidence-link" href="/pdf-tools/trust/">{t("View trust evidence")}</a>
        </section>

        <section className="fl-featured" aria-labelledby="quick-heading">
          <div className="fl-section-head">
            <div><p className="fl-eyebrow">{t("GET STARTED")}</p><h2 id="quick-heading">{t("Popular PDF tasks")}</h2></div>
            <a href="#tool-catalog">{t("View all tools")} <span aria-hidden="true">→</span></a>
          </div>
          <div className="fl-quick-grid">
            {quickTools.map((tool) => (
              <a className="fl-quick-card" href={href(tool.route)} key={tool.id}>
                <span className="fl-quick-icon" aria-hidden="true">↗</span>
                <strong>{t(tool.title)}</strong>
                <span>{t(tool.description)}</span>
                <span className="fl-quick-action">{t("Open tool")} <span aria-hidden="true">→</span></span>
              </a>
            ))}
          </div>
        </section>

        <div id="tool-catalog" className="fl-catalog-head">
          <p className="fl-eyebrow">{t("YOUR TOOLBOX")}</p>
          <h2>{t("Find the right PDF tool")}</h2>
          <p>{t("Search and browse the available tools. Every option below links to a working browser-based workflow.")}</p>
        </div>
        <ToolCatalog />
        <div dangerouslySetInnerHTML={{ __html: hubDirectoryHtml() + guideDirectoryHtml() }} />

        <section className="fl-how" aria-labelledby="how-heading">
          <div><p className="fl-eyebrow">{t("HOW IT WORKS")}</p><h2 id="how-heading">{t("Simple by design.")}</h2>
          <p>{t("Your documents are processed in this browser, not sent to a conversion server in the current release.")}</p></div>
          <ol><li><strong>{t("Choose a tool")}</strong><span>{t("Pick the PDF task you need.")}</span></li>
            <li><strong>{t("Select your files")}</strong><span>{t("Work with documents on your device.")}</span></li>
            <li><strong>{t("Save your result")}</strong><span>{t("Download the finished file, or read it here.")}</span></li></ol>
        </section>
      </main>
    </div>
  )
}

export default App
