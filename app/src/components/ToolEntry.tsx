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
import { PdfToImagesTool } from './PdfToImagesTool'
import { PdfReaderTool } from './PdfReaderTool'
import { PdfToTextTool } from './PdfToTextTool'
import { DocumentInfoTool } from './DocumentInfoTool'
import { OverlayTool } from './OverlayTool'

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

function ToolContent({ tool, onExit }: { tool: ToolDefinition; onExit: () => void }) {
  if (tool.implemented) {
    // mounted workspaces per tool id — one case per shipped PT-CORE interface
    switch (tool.id) {
      case 'doc-info':
        return <DocumentInfoTool onExit={onExit} />
      case 'page-numbers':
      case 'watermark':
        return <OverlayTool key={tool.id} mode={tool.id} onExit={onExit} />
      case 'pdf-to-text':
        return <PdfToTextTool onExit={onExit} />
      case 'reader':
        return <PdfReaderTool onExit={onExit} />
      case 'merge':
        return <MergeTool onExit={onExit} />
      case 'split':
        return <SplitTool onExit={onExit} />
      case 'extract-pages':
      case 'delete-pages':
        return <PageSelectionTool key={tool.id} mode={tool.id} onExit={onExit} />
      case 'pdf-to-jpg':
      case 'pdf-to-png':
        return <PdfToImagesTool key={tool.id} mode={tool.id} onExit={onExit} />
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


const TOOL_HELP: Record<ToolDefinition['id'], string> = {
  merge: 'Choose at least two PDFs, put them in the required order and select Merge PDFs. Download the verified new copy; your originals are unchanged.',
  split: 'Choose a PDF and split it by ranges, every N pages or one file per page. Review the parts before splitting, then download the ZIP.',
  rotate: 'Choose a PDF, select pages and rotate them in 90-degree steps. Review the preview and create a new copy.',
  'delete-pages': 'Choose a PDF and mark the pages to remove. Confirm the deletion review before creating a new copy. Keep at least one page.',
  'extract-pages': 'Choose a PDF and select pages using thumbnails or page ranges. Review the output order before creating a new PDF.',
  organize: 'Choose a PDF, then reorder, rotate, duplicate or remove pages. Use undo if needed and review the output order before saving a new copy.',
  'images-to-pdf': 'Choose JPG or PNG images, arrange their order and set page size, fit and margins. Review the layout, then create one PDF with one image per page.',
  'pdf-to-jpg': 'Choose a PDF and the pages to render. Set resolution and JPG quality, then create images. Download them individually or together as a ZIP.',
  'pdf-to-png': 'Choose a PDF and pages to render. Set resolution and a white or transparent background. Download the generated images or a ZIP.',
  reader: 'Choose a PDF to read, zoom, search its existing text, copy or print. Image-only pages cannot be searched without OCR.',
  'page-numbers': 'Choose a PDF and pages to number, then set the starting number, position and style. Wait for the modified preview before applying it.',
  watermark: 'Choose a PDF and watermark text, position, opacity and pages. Wait for the modified preview before applying it. A watermark does not remove underlying content.',
  'pdf-to-text': 'Choose a PDF to export its existing text layer as UTF-8 TXT. Scanned pages need OCR, which is not available in this tool.',
  'doc-info': 'Choose a PDF and select Inspect PDF to view metadata and page dimensions. Password-protected files show a limited report. Signature indicators do not validate authenticity.',
}

/** The same lightweight chrome wraps every shipped workspace without owning its state. */
export function ToolEntry({ tool, onExit }: { tool: ToolDefinition; onExit: () => void }) {
  return <main id="main-content" className="tool-workspace">
    <div className="workspace-context">
      <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
        <a href={SITE_BASE}>All PDF tools</a><span aria-hidden="true">/</span><span aria-current="page">{tool.title}</span>
      </nav>
      {tool.implemented ? <details className="workspace-help">
        <summary>How to use this tool</summary>
        <p>{TOOL_HELP[tool.id]}</p>
        <p>Selected files are processed in this browser, not uploaded for conversion. Follow the file and page limits shown below.</p>
      </details> : null}
    </div>
    <ToolContent tool={tool} onExit={onExit} />
  </main>
}
