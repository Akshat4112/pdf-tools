import { useEffect } from 'react'
import { ToolCatalog } from './components/ToolCatalog'
import { ToolEntry } from './components/ToolEntry'
import { NotFound } from './components/NotFound'
import { usePathRoute } from './router'
import { TOOLS, toolByRoute } from './registry'
import { SiteHeader } from './components/SiteHeader'

function App() {
  const [route, navigate] = usePathRoute()

  // "/" focuses search (keyboard-first catalog, PT-PD-002 §6 target)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
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
  const live = TOOLS.filter((t) => t.implemented).length

  // Tool screen: path route -> generated entry page (PT-UX-004; merge mounts
  // its workspace via ToolEntry, others show the honest in-progress entry)
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

  return (
    <div className="shell">
      <SiteHeader key={route.path} />

      <section className="hero">
        <h1>Everyday document tools, running entirely in your browser.</h1>
        <p>
          Merge, split, convert and inspect PDFs — free, with no accounts and no
          uploads. Your documents are processed on your own device and are never
          sent to a server.
        </p>
        <p className="local-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.5v.5" />
          </svg>
          <span>
            This is an early preview: {live} of {TOOLS.length} tools are built.
            The rest are listed so you can see where the project is going — they
            open as soon as they pass verification.
          </span>
        </p>
      </section>

      <ToolCatalog />

      <footer className="site-footer">
        <span>Free and open source, MIT license.</span>
        <span>
          <a href="https://github.com/Akshat4112/pdf-tools">Source on GitHub</a>
        </span>
      </footer>
    </div>
  )
}

export default App
