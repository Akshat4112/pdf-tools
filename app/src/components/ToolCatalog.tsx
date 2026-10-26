import { useLocale } from '../i18n'
/**
 * Tool catalog — PT-UX-001.
 *
 * Renders the registry (single source of truth) as a searchable, category-
 * filterable catalog. Acceptance rules:
 * - only implemented tools get active (link) entry points; the rest render
 *   as clearly-marked "in progress" cards (PT-PD-001 §2: never an enabled
 *   entry to a placeholder)
 * - the local-processing message is explicit and prominent
 * - search + category nav are keyboard-first
 */

import { useMemo, useRef, useState } from 'react'
import { CATEGORIES, TOOLS, QUOTAS, type ToolCategory, type ToolDefinition } from '../registry'
import { href } from '../router'
import { matchesTool, formatCue } from '../catalog/search'
import './ToolCatalog.css'

/** Original inline icons — stroke style, no icon-font dependency (self-hosted rule). */
function ToolIcon({ tool }: { tool: ToolDefinition }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (tool.id) {
    case 'merge':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="10" height="14" rx="2" />
          <path d="M14 7h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5" />
        </svg>
      )
    case 'split':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M12 4v16M12 8h-4M12 14h4" />
        </svg>
      )
    case 'rotate':
      return (
        <svg {...common}>
          <path d="M4 9a8 8 0 1 1 2 8" />
          <path d="M4 4v5h5" />
        </svg>
      )
    case 'delete-pages':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 10l6 6M15 10l-6 6" />
        </svg>
      )
    case 'extract-pages':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="12" height="14" rx="2" />
          <path d="M9 6V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5" />
        </svg>
      )
    case 'organize':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'images-to-pdf':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M4 16l4-4 3 3 3-4 6 6" />
          <circle cx="9.5" cy="8" r="1.5" />
        </svg>
      )
    case 'pdf-to-jpg':
    case 'pdf-to-png':
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v5h5" />
          <path d="M9 13v5M12 11v7M15 14v4" />
        </svg>
      )
    case 'reader':
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2z" />
          <path d="M13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
        </svg>
      )
    case 'doc-info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7.5v.5" />
        </svg>
      )
    case 'page-numbers':
      return (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M9.5 17c.8-1.6 2.9-2.4 2.9-4a1.5 1.5 0 0 0-3 0" transform="translate(0)" />
          <path d="M9 20h6" />
        </svg>
      )
    case 'watermark':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 15l8-7" strokeDasharray="0" />
          <path d="M7 11l3 3M14 17l3-3" opacity="0.5" />
        </svg>
      )
    case 'pdf-to-text':
      return (
        <svg {...common}>
          <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <path d="M14 3v5h5" />
          <path d="M8.5 12h7M8.5 15.5h7" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      )
  }
}

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const { t } = useLocale()
  const classes = ['tool-card']
  if (!tool.implemented) classes.push('is-disabled')
  if (tool.implemented) {
    return (
      <a className={classes.join(' ')} href={href(tool.route)} aria-label={`${t('Open tool')}: ${t(tool.title)}`}>
        <span className="tool-icon">
          <ToolIcon tool={tool} />
        </span>
        <h3 className="tool-title">{t(tool.title)}</h3>
        <p className="tool-desc">{t(tool.description)}</p>
        <span className="tool-meta">
          <span className="badge badge-live">{t("Open tool")}</span>
          <span>{formatCue(tool)}</span>
        </span>
      </a>
    )
  }
  return (
    <div className={classes.join(' ')} aria-disabled="true">
      <span className="tool-icon">
        <ToolIcon tool={tool} />
      </span>
      <h3 className="tool-title">{t(tool.title)}</h3>
      <p className="tool-desc">{t(tool.description)}</p>
      <span className="tool-meta">
        <span className="badge badge-soon">{t("Not available yet")}</span>
        <span>{formatCue(tool)}</span>
      </span>
    </div>
  )
}

export function ToolCatalog() {
  const { t, locale } = useLocale()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ToolCategory | 'all'>('all')

  const searchInput = useRef<HTMLInputElement>(null)
  const filtered = useMemo(() => TOOLS.filter(tool =>
    (category === 'all' || tool.category === category) && matchesTool(tool, query),
  ), [query, category])
  const availableCount = filtered.filter(tool => tool.implemented).length
  const selectedCategory = CATEGORIES.find(item => item.id === category)
  const isFiltered = Boolean(query || category !== 'all')
  const clearSearch = () => { setQuery(''); searchInput.current?.focus() }
  const reset = () => { setQuery(''); setCategory('all'); searchInput.current?.focus() }

  return (
    <section aria-label={t("Tool catalog")} className="catalog">
      <div className="search-row">
        <label className="catalog-search-label" htmlFor="catalog-search">{t("Search tools")}</label>
        <div className="search-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input ref={searchInput} id="catalog-search" type="search" value={query} maxLength={100}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape') clearSearch() }}
            placeholder={t("Try merge, rotate or JPG…")} aria-label={t("Search tools")}
            aria-describedby="catalog-search-help" aria-controls="catalog-results" />
          <button type="button" className="catalog-clear" onClick={clearSearch} disabled={!query} aria-label={t("Clear search")}>{t("Clear")}</button>
          <kbd aria-hidden="true">/</kbd>
        </div>
        <p id="catalog-search-help" className="catalog-search-help">{t("Search by task or format. Press / to search, or Escape to clear your search.")}</p>
      </div>
      <div className="category-row" role="group" aria-label={t("Filter by category")}>
        <button type="button" className="cat-chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
          {t("All tools")} <span className="catalog-chip-count" aria-hidden="true">{TOOLS.length}</span>
        </button>
        {CATEGORIES.map(item => (
          <button type="button" className="cat-chip" key={item.id} aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)} title={t(item.description)}>
            {t(item.title)} <span className="catalog-chip-count" aria-hidden="true">{TOOLS.filter(tool => tool.category === item.id).length}</span>
          </button>
        ))}
      </div>
      <div className="catalog-results-heading">
        <p role="status" aria-live="polite" aria-atomic="true">{filtered.length} {t(filtered.length === 1 ? 'tool' : 'tools')} {t(isFiltered ? 'found' : 'in your toolbox')} · {availableCount} {t('ready to use')}</p>
        <button type="button" className="catalog-reset" disabled={!isFiltered} onClick={reset}>{t("Reset filters")}</button>
      </div>
      {selectedCategory ? <p className="catalog-category-help">{t(selectedCategory.description)}</p> : null}
      <div id="catalog-results">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{t("No matching tools")}</h3>
            <p>{query.trim() ? (locale === 'de' ? `Keine Tools für „${query.trim()}“${selectedCategory ? ` in ${t(selectedCategory.title)}` : ''} gefunden.` : `No tools match “${query.trim()}”${selectedCategory ? ` in ${selectedCategory.title}` : ''}.`) : t('There are no tools in this category yet.')}</p>
            <p>{t("Try a shorter task name, choose another category, or reset the filters to see the full toolbox.")}</p>
          </div>
        ) : (
          <ul className="tool-grid">{filtered.map(tool => <li key={tool.id}><ToolCard tool={tool} /></li>)}</ul>
        )}
      </div>
      <p className="catalog-limits">{locale === 'de' ? 'Dateien bis zu' : 'Files up to'} {QUOTAS.maxInputBytes / (1024 * 1024)} MiB {locale === 'de' ? 'je Datei. Seiten-, Ausgabe- und Speicherlimits variieren je Tool; prüfe die Grenzen vor der Verarbeitung.' : 'each. Page, output and device-memory limits vary by tool; check the limits before processing.'}</p>
    </section>
  )
}
