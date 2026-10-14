/**
 * Generated tool entry page — PT-UX-004.
 *
 * Every registry tool gets a real URL (/pdf-tools/<route>) with accurate
 * static metadata (prerendered at build time). The page shows the tool's
 * entry content:
 *  - implemented tools: the mounted tool workspace (currently MergeTool;
 *    each PT-CORE ship task adds its mount here)
 *  - not-yet tools: an honest "in progress" entry with what the tool will
 *    do (PT-PD-001 §4: never a fake enabled entry)
 * A generated entry page per tool also makes every route deep-linkable and
 * refresh-safe (static HTML exists for each path).
 */

import type { ToolDefinition } from '../registry'
import { SITE_BASE } from '../lib/seo'
import { MergeTool } from './MergeTool'
import { SplitTool } from './SplitTool'
import { PageSelectionTool } from './PageSelectionTool'
import { OrganizeTool } from './OrganizeTool'
import { ImagesToPdfTool } from './ImagesToPdfTool'

function ToolWorkInProgress({ tool }: { tool: ToolDefinition }) {
  return (
    <section className="tool-screen" aria-label={`${tool.title} preview`}>
      <header className="tool-header">
        <h1 className="tool-heading">{tool.title}</h1>
        <p className="tool-subtitle">{tool.description}</p>
      </header>
      <div className="panel" role="note">
        <h2 className="panel-title">In progress — not available yet</h2>
        <p className="panel-summary">
          This tool is listed in the catalog so you can see where the project
          is going. It opens as soon as its engine and interface pass
          verification. Nothing to try here yet — check back soon.
        </p>
        <div className="panel-actions">
          <a className="btn-ghost" href={SITE_BASE}>
            Back to all tools
          </a>
        </div>
      </div>
    </section>
  )
}

export function ToolEntry({ tool, onExit }: { tool: ToolDefinition; onExit: () => void }) {
  if (tool.implemented) {
    // mounted workspaces per tool id — one case per shipped PT-CORE interface
    switch (tool.id) {
      case 'merge':
        return <MergeTool onExit={onExit} />
      case 'split':
        return <SplitTool onExit={onExit} />
      case 'extract-pages':
      case 'delete-pages':
        return <PageSelectionTool key={tool.id} mode={tool.id} onExit={onExit} />
      case 'images-to-pdf':
        return <ImagesToPdfTool onExit={onExit} />
      case 'organize':
      case 'rotate':
        return <OrganizeTool key={tool.id} mode={tool.id} onExit={onExit} />
      default:
        return <ToolWorkInProgress tool={tool} />
    }
  }
  return <ToolWorkInProgress tool={tool} />
}
