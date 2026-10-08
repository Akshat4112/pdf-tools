import { useEffect } from 'react'
import { ToolCatalog } from './components/ToolCatalog'
import { TOOLS } from './registry'

const SITE = '/pdf-tools/'

function App() {

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

  const live = TOOLS.filter((t) => t.implemented).length

  return (
    <div className="shell">
      <header className="site-header">
        <a className="brand" href={SITE}>
          <span className="brand-mark" aria-hidden="true">PD</span>
          <span className="brand-name">PDF Tools</span>
        </a>
        <span className="privacy-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <strong>Local processing</strong> — files never leave your browser
        </span>
      </header>

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

      <ToolCatalog base={SITE} />

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
