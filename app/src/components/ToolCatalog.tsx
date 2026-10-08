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

import { useMemo, useState } from 'react'
import { CATEGORIES, TOOLS, type ToolCategory, type ToolDefinition } from '../registry'

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

function ToolCard({ tool, base }: { tool: ToolDefinition; base: string }) {
  const classes = ['tool-card']
  if (!tool.implemented) classes.push('is-disabled')
  if (tool.implemented) {
    return (
      <a className={classes.join(' ')} href={`${base}#${tool.route.slice(1)}`}>
        <span className="tool-icon">
          <ToolIcon tool={tool} />
        </span>
        <p className="tool-title">{tool.title}</p>
        <p className="tool-desc">{tool.description}</p>
        <span className="tool-meta">
          <span className="badge badge-live">Open tool</span>
          <span>{tool.acceptedInputs.join(', ').toUpperCase()}</span>
        </span>
      </a>
    )
  }
  return (
    <div className={classes.join(' ')} aria-disabled="true">
      <span className="tool-icon">
        <ToolIcon tool={tool} />
      </span>
      <p className="tool-title">{tool.title}</p>
      <p className="tool-desc">{tool.description}</p>
      <span className="tool-meta">
        <span className="badge badge-soon">In progress</span>
        <span>{tool.acceptedInputs.join(', ').toUpperCase()}</span>
      </span>
    </div>
  )
}

export function ToolCatalog({ base = '/pdf-tools/' }: { base?: string }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ToolCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.featureId.toLowerCase().includes(q)
      )
    })
  }, [query, category])

  const liveCount = TOOLS.filter((t) => t.implemented).length

  return (
    <section aria-label="Tool catalog" className="catalog">
      <div className="search-row">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${TOOLS.length} tools…`}
            aria-label="Search tools"
          />
          <kbd aria-hidden="true">/</kbd>
        </div>
      </div>

      <div className="category-row" role="group" aria-label="Filter by category">
        <button
          type="button"
          className="cat-chip"
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="cat-chip"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
            title={c.description}
          >
            {c.title}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state" role="status">
          No tools match “{query}”. Try another search or pick a category.
        </p>
      ) : (
        <ul className="tool-grid">
          {filtered.map((t) => (
            <li key={t.id}>
              <ToolCard tool={t} base={base} />
            </li>
          ))}
        </ul>
      )}

      <p className="visually-hidden" role="status">
        {liveCount} of {TOOLS.length} tools are currently available.
      </p>
    </section>
  )
}
