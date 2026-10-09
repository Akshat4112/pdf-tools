import { useMemo, useState } from 'react'
import { groupByCategory, isImplemented, searchTools } from './lib/catalog'
import { TOOLS } from './registry'

function StatusChip({ implemented }: { implemented: boolean }) {
  return (
    <span className={`status-chip ${implemented ? 'is-ready' : 'is-dev'}`}>
      {implemented ? 'Ready' : 'In development'}
    </span>
  )
}

function App() {
  const [query, setQuery] = useState('')

  const results = useMemo(() => searchTools(query), [query])
  const grouped = useMemo(() => groupByCategory(results), [results])
  const implementedCount = useMemo(() => TOOLS.filter((t) => isImplemented(t)).length, [])

  return (
    <>
      <header className="site-header">
        <div className="shell site-header-inner">
          <a className="brand" href="#catalog">
            <span className="brand-name">PDF Tools</span>
            <span className="brand-tag">local & free</span>
          </a>
          <span className="privacy-note" title="Your documents are processed by your browser and never uploaded to a server.">
            <span aria-hidden="true">🔒</span> Files stay on this device
          </span>
        </div>
      </header>

      <main className="shell" id="catalog">
        <section className="hero">
          <h1>Everyday document tools, right in your browser.</h1>
          <p>Merge, split, convert, number and read PDFs — quickly and privately.</p>
          <p className="hero-sub">
            Everything runs locally on this device. Your documents are never
            uploaded, stored on a server, or shared.
          </p>
        </section>

        <div className="search-row">
          <label htmlFor="tool-search" className="sr-only">Search tools</label>
          <input
            id="tool-search"
            className="search-input"
            type="search"
            placeholder={`Search ${TOOLS.length} tools — try "merge" or "jpg"`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {grouped.length === 0 ? (
          <div className="empty-state">
            <p>No tools match “{query}”. Try another word, like “split” or “image”.</p>
          </div>
        ) : (
          grouped.map(({ category, tools }) => (
            <section className="category-section" key={category.id} aria-labelledby={`cat-${category.id}`}>
              <div className="category-head">
                <h2 className="category-title" id={`cat-${category.id}`}>{category.label}</h2>
                <span className="category-desc">{category.description}</span>
              </div>
              <ul className="tool-grid">
                {tools.map((tool) => {
                  const implemented = isImplemented(tool)
                  // Only working tools get active entry points (PT-PD-001 §4);
                  // in-development tools render as non-links with honest status.
                  return (
                    <li key={tool.id}>
                      {implemented ? (
                        <a className="tool-card" href={tool.route}>
                          <h3>{tool.title}</h3>
                          <p>{tool.description}</p>
                          <span className="tool-foot">
                            <StatusChip implemented />
                            <span>Open tool →</span>
                          </span>
                        </a>
                      ) : (
                        <div className="tool-card is-dev" aria-disabled="true">
                          <h3>{tool.title}</h3>
                          <p>{tool.description}</p>
                          <span className="tool-foot">
                            <StatusChip implemented />
                            <span>Coming with R1 releases</span>
                          </span>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}

        {implementedCount === 0 && (
          <div className="empty-state">
            <p>
              The engines are built and verified; the interactive tools are being
              connected one by one. Nothing here will pretend to work before it does.
            </p>
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="shell site-footer" style={{ padding: 0, margin: 0, borderTop: 'none', width: '100%', justifyContent: 'space-between' }}>
          <span>PDF Tools — free, local-first document utilities.</span>
          <span>
            {implementedCount} of {TOOLS.length} tools live · processed on your device
          </span>
        </div>
      </footer>
    </>
  )
}

export default App
