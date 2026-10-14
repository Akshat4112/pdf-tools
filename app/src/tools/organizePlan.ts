import { QUOTAS, toolError } from '../registry'
import type { OrganizePlanEntry } from '../engines/pdflib'

export interface EditorPage extends OrganizePlanEntry { id: number; rotation: number }
export interface OrganizeState { pages: EditorPage[]; history: EditorPage[][]; nextId: number }
export const EMPTY_ORGANIZE: OrganizeState = { pages: [], history: [], nextId: 1 }
export const UNDO_LIMIT = 50
export type OrganizeAction =
  | { type: 'load'; rotations: number[] }
  | { type: 'move'; id: number; to: number }
  | { type: 'rotate'; ids: number[]; delta: 90 | -90 }
  | { type: 'duplicate'; id: number }
  | { type: 'delete'; ids: number[] }
  | { type: 'restore'; rotations: number[] }
  | { type: 'undo' }

export function initialPages(rotations: readonly number[]): EditorPage[] {
  return rotations.map((rotation, i) => ({ id: i + 1, sourcePage: i + 1, rotation }))
}

/** Immutable page identities keep duplicates independent. History holds plans, never PDF bytes. */
export function organizeReducer(state: OrganizeState, action: OrganizeAction): OrganizeState {
  if (action.type === 'load') return { pages: initialPages(action.rotations), history: [], nextId: action.rotations.length + 1 }
  if (action.type === 'undo') {
    const pages = state.history.at(-1)
    return pages ? { ...state, pages, history: state.history.slice(0, -1) } : state
  }
  let pages = state.pages
  let nextId = state.nextId
  switch (action.type) {
    case 'move': {
      const from = pages.findIndex((p) => p.id === action.id)
      if (from < 0 || !Number.isInteger(action.to) || action.to < 0 || action.to >= pages.length || from === action.to) return state
      pages = [...pages]
      const [page] = pages.splice(from, 1)
      pages.splice(action.to, 0, page)
      break
    }
    case 'rotate': {
      const ids = new Set(action.ids)
      if (!pages.some((p) => ids.has(p.id))) return state
      pages = pages.map((p) => ids.has(p.id) ? { ...p, rotation: (p.rotation + action.delta + 360) % 360 } : p)
      break
    }
    case 'duplicate': {
      const i = pages.findIndex((p) => p.id === action.id)
      if (i < 0 || pages.length >= QUOTAS.maxPages) return state
      pages = [...pages.slice(0, i + 1), { ...pages[i], id: nextId++ }, ...pages.slice(i + 1)]
      break
    }
    case 'delete': {
      const ids = new Set(action.ids)
      const remaining = pages.filter((p) => !ids.has(p.id))
      if (!remaining.length || remaining.length === pages.length) return state
      pages = remaining
      break
    }
    case 'restore': pages = initialPages(action.rotations); break
  }
  if (planKey(pages) === planKey(state.pages)) return state
  return { pages, nextId, history: [...state.history, state.pages].slice(-UNDO_LIMIT) }
}

export function planKey(plan: readonly OrganizePlanEntry[]): string {
  return plan.map((p) => `${p.sourcePage}:${p.rotation}`).join(',')
}

export function validateOrganizePlan(plan: readonly OrganizePlanEntry[], sourcePages: number): void {
  if (!plan.length) throw toolError('E-CONFIG-01', 'Keep at least one page in the new copy.', 'fix-field')
  if (plan.length > QUOTAS.maxPages) throw toolError('E-INPUT-04', `The output is limited to ${QUOTAS.maxPages} pages.`, 'show-limits')
  for (const p of plan) {
    if (!Number.isInteger(p.sourcePage) || p.sourcePage < 1 || p.sourcePage > sourcePages) {
      throw toolError('E-CONFIG-01', 'The page plan references an invalid source page.', 'fix-field')
    }
    if (p.rotation !== undefined && ![0, 90, 180, 270].includes(p.rotation)) {
      throw toolError('E-CONFIG-01', 'Use rotations of 0, 90, 180 or 270 degrees.', 'fix-field')
    }
  }
}
