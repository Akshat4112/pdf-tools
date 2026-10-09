/**
 * Catalog logic — PT-UX-001.
 *
 * Pure functions: category mapping, search, and availability. The catalog UI
 * renders from these; tests cover the acceptance criteria:
 * - every tool has a clear purpose (registry title/description)
 * - search finds tools by name, description and category
 * - ONLY implemented tools have active entry points (honest "coming soon" for
 *   the rest — PT-PD-001 §4: no enabled entries leading to placeholders)
 */

import { TOOLS, type ToolDefinition } from '../registry'

/** Hand-curated grouping for navigation (original, not Smallpdf's). */
export type CategoryId = 'organize' | 'to-pdf' | 'from-pdf' | 'view' | 'page-edits'

export interface Category {
  id: CategoryId
  label: string
  description: string
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'organize',
    label: 'Organize',
    description: 'Combine, split and reorder pages across documents.',
  },
  {
    id: 'to-pdf',
    label: 'Create PDFs',
    description: 'Turn images into PDF documents.',
  },
  {
    id: 'from-pdf',
    label: 'Export from PDF',
    description: 'Render pages as images or export text.',
  },
  {
    id: 'view',
    label: 'Read & inspect',
    description: 'Open documents and inspect their properties locally.',
  },
  {
    id: 'page-edits',
    label: 'Page edits',
    description: 'Rotate, number and watermark your pages.',
  },
] as const

const CATEGORY_BY_TOOL: Record<string, CategoryId> = {
  merge: 'organize',
  split: 'organize',
  'delete-pages': 'organize',
  'extract-pages': 'organize',
  organize: 'organize',
  'images-to-pdf': 'to-pdf',
  'pdf-to-jpg': 'from-pdf',
  'pdf-to-png': 'from-pdf',
  'pdf-to-text': 'from-pdf',
  reader: 'view',
  'doc-info': 'view',
  rotate: 'page-edits',
  'page-numbers': 'page-edits',
  watermark: 'page-edits',
}

export function categoryOf(tool: ToolDefinition): Category {
  const id = CATEGORY_BY_TOOL[tool.id]
  const cat = CATEGORIES.find((c) => c.id === id)
  if (!cat) throw new Error(`No category mapped for tool ${tool.id}`)
  return cat
}

/**
 * Tools whose full select->configure->preview->process->download flow works.
 * Grows ONLY when a PT-CORE "Ship <tool> interface" task merges. Until then
 * the catalog shows these tools as in development — never as fake entries.
 */
export const IMPLEMENTED_TOOLS: ReadonlySet<string> = new Set<string>()

export function isImplemented(tool: ToolDefinition): boolean {
  return IMPLEMENTED_TOOLS.has(tool.id)
}

/** Case-insensitive search across title, description, category and route. */
export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...TOOLS]
  const terms = q.split(/\s+/)
  return TOOLS.filter((tool) => {
    const haystack = [
      tool.title,
      tool.description,
      categoryOf(tool).label,
      tool.route,
    ]
      .join(' ')
      .toLowerCase()
    return terms.every((t) => haystack.includes(t))
  })
}

/** Group search results by category, preserving registry order within groups. */
export function groupByCategory(tools: ToolDefinition[]): Array<{ category: Category; tools: ToolDefinition[] }> {
  const buckets = new Map<CategoryId, ToolDefinition[]>()
  for (const tool of tools) {
    const cat = categoryOf(tool).id
    const list = buckets.get(cat) ?? []
    list.push(tool)
    buckets.set(cat, list)
  }
  return CATEGORIES.filter((c) => buckets.has(c.id)).map((category) => ({
    category,
    tools: buckets.get(category.id)!,
  }))
}
