import type { ToolDefinition, ToolId } from '../registry'

// Search vocabulary describes shipped behavior; it does not add capabilities.
const aliases: Partial<Record<ToolId, string>> = {
  merge: 'combine join documents', split: 'separate divide ranges',
  organize: 'rearrange reorder duplicate pages', rotate: 'turn orientation',
  'delete-pages': 'remove discard pages', 'extract-pages': 'save selected pages',
  'images-to-pdf': 'photos pictures jpeg png', 'pdf-to-jpg': 'jpeg photos pictures',
  'pdf-to-png': 'transparent pictures', reader: 'view search print copy',
  'page-numbers': 'number pagination', watermark: 'stamp text label',
  'pdf-to-text': 'plain text txt extract text layer', 'doc-info': 'properties metadata dimensions',
}
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function matchesTool(tool: ToolDefinition, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const searchable = normalize(`${tool.title} ${tool.description} ${tool.featureId} ${tool.acceptedInputs.join(' ')} ${tool.outputKind} ${aliases[tool.id] ?? ''}`)
  return words.every(word => searchable.includes(word))
}
export function formatCue(tool: ToolDefinition): string {
  const inputs = tool.acceptedInputs.map(input => input === 'jpeg' ? 'JPG' : input.toUpperCase()).join(' / ')
  const output = tool.id === 'pdf-to-jpg' ? 'JPG / ZIP' : tool.id === 'pdf-to-png' ? 'PNG / ZIP' : tool.id === 'split' ? 'PDF / ZIP' : tool.outputKind === 'view' ? 'View' : tool.outputKind === 'jpeg' ? 'JPG' : tool.outputKind.toUpperCase()
  return `${inputs} → ${output}`
}
