import { useEffect } from 'react'
import { ToolCatalog } from './components/ToolCatalog'
import { ToolEntry } from './components/ToolEntry'
import { NotFound } from './components/NotFound'
import { usePathRoute, href } from './router'
import { TOOLS, toolByRoute } from './registry'
import { SiteHeader } from './components/SiteHeader'

const featured = ['merge', 'split', 'organize', 'images-to-pdf'] as const

function App() {
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

  if (route.name === 'not-found') {
    return (
      <div className="shell">
        <SiteHeader key={route.path} />
        <NotFound />
      </div>
    )
  }

  const quickTools = featured.map((id) => TOOLS.find((tool) => tool.id === id)).filter(
    (tool): tool is (typeof TOOLS)[number] => Boolean(tool?.implemented),
  )

  return (
    <div className="shell fl-home">
      <SiteHeader key={route.path} />
      <main id="main-content">
        <section className="fl-hero" aria-labelledby="home-heading">
          <div className="fl-hero-copy">
            <p className="fl-eyebrow">FREE FOREVER · OPEN SOURCE</p>
            <h1 id="home-heading">PDF tools that work in your browser.</h1>
            <p className="fl-lead">Merge, split, organize, read and convert PDFs with FolioLocal. Free forever, open source, and processed on your device — no account required.</p>
            <div className="fl-hero-actions">
              <a className="fl-cta" href="#tool-catalog">Explore all PDF tools <span aria-hidden="true">→</span></a>
              <a className="fl-secondary-link" href="https://github.com/Akshat4112/pdf-tools">View source code <span aria-hidden="true">↗</span></a>
            </div>
            <p className="fl-fine-print">This browser-based release does not upload document contents for processing. Loading the site and its assets still connects to GitHub Pages.</p>
          </div>
          <div className="fl-hero-art" aria-hidden="true">
            <div className="fl-document fl-doc-back"><span /><span /><span /><span /></div>
            <div className="fl-document fl-doc-front"><div className="fl-doc-symbol">PDF</div><span /><span /><span /></div>
            <div className="fl-art-label">Your files stay in this browser</div>
          </div>
        </section>

        <section className="fl-trust-strip" aria-label="Product commitments">
          <span>Free forever for local tools</span>
          <span>Open source · MIT</span>
          <span>Files processed in your browser</span>
          <span>No account required</span>
        </section>

        <section className="fl-featured" aria-labelledby="quick-heading">
          <div className="fl-section-head">
            <div><p className="fl-eyebrow">GET STARTED</p><h2 id="quick-heading">Popular PDF tasks</h2></div>
            <a href="#tool-catalog">View all tools <span aria-hidden="true">→</span></a>
          </div>
          <div className="fl-quick-grid">
            {quickTools.map((tool) => (
              <a className="fl-quick-card" href={href(tool.route)} key={tool.id}>
                <span className="fl-quick-icon" aria-hidden="true">↗</span>
                <strong>{tool.title}</strong>
                <span>{tool.description}</span>
                <span className="fl-quick-action">Open tool <span aria-hidden="true">→</span></span>
              </a>
            ))}
          </div>
        </section>

        <div id="tool-catalog" className="fl-catalog-head">
          <p className="fl-eyebrow">YOUR TOOLBOX</p>
          <h2>Find the right PDF tool</h2>
          <p>Search and browse the available tools. Every option below links to a working browser-based workflow.</p>
        </div>
        <ToolCatalog />

        <section className="fl-how" aria-labelledby="how-heading">
          <div><p className="fl-eyebrow">HOW IT WORKS</p><h2 id="how-heading">Simple by design.</h2>
          <p>Your documents are processed in this browser, not sent to a conversion server in the current release.</p></div>
          <ol><li><strong>Choose a tool</strong><span>Pick the PDF task you need.</span></li>
            <li><strong>Select your files</strong><span>Work with documents on your device.</span></li>
            <li><strong>Save your result</strong><span>Download the finished file, or read it here.</span></li></ol>
        </section>
      </main>
      <footer className="site-footer fl-home-footer">
        <span>FolioLocal · Free and open-source PDF tools. <a href="https://github.com/Akshat4112/pdf-tools/blob/main/LICENSE">MIT license</a>.</span>
        <span><a href="https://github.com/Akshat4112/pdf-tools/blob/main/docs/security/PT-SEC-002-local-processing-audit.md">How local processing works</a> · <a href="https://github.com/Akshat4112/pdf-tools">Source on GitHub</a></span>
      </footer>
    </div>
  )
}

export default App
