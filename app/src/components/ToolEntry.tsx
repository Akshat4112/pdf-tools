import { useLocale } from '../i18n'
import { lazy, Suspense } from 'react'
import { ToolLoadBoundary, ToolLoading } from './ToolLoadBoundary'
import { breadcrumbHtml, hubForTool } from '../lib/categoryHubs'
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
import { hasGermanPage } from '../lib/localizedRoutes'
const MergeTool = lazy(() => import('./MergeTool').then(module => ({ default: module.MergeTool })))
const GermanMergeGuide = lazy(() => import('./GermanMergeGuide'))
const GermanSplitGuide = lazy(() => import('./GermanSplitGuide'))
const GermanRotateGuide = lazy(() => import('./GermanRotateGuide'))
const GermanDeleteGuide = lazy(() => import('./GermanDeleteGuide'))
const GermanExtractGuide = lazy(() => import('./GermanExtractGuide'))
const GermanOrganizeGuide = lazy(() => import('./GermanOrganizeGuide'))
const GermanImagesToPdfGuide = lazy(() => import('./GermanImagesToPdfGuide'))
const EnglishToolGuide = lazy(() => import('./EnglishToolGuide'))
const SplitTool = lazy(() => import('./SplitTool').then(module => ({ default: module.SplitTool })))
const PageSelectionTool = lazy(() => import('./PageSelectionTool').then(module => ({ default: module.PageSelectionTool })))
const OrganizeTool = lazy(() => import('./OrganizeTool').then(module => ({ default: module.OrganizeTool })))
const ImagesToPdfTool = lazy(() => import('./ImagesToPdfTool').then(module => ({ default: module.ImagesToPdfTool })))
const PdfToImagesTool = lazy(() => import('./PdfToImagesTool').then(module => ({ default: module.PdfToImagesTool })))
const PdfReaderTool = lazy(() => import('./PdfReaderTool').then(module => ({ default: module.PdfReaderTool })))
const PdfToTextTool = lazy(() => import('./PdfToTextTool').then(module => ({ default: module.PdfToTextTool })))
const DocumentInfoTool = lazy(() => import('./DocumentInfoTool').then(module => ({ default: module.DocumentInfoTool })))
const OverlayTool = lazy(() => import('./OverlayTool').then(module => ({ default: module.OverlayTool })))

function ToolWorkInProgress({ tool }: { tool: ToolDefinition }) {
  const { t } = useLocale()
  return (
    <section className="tool-screen" aria-label={`${t(tool.title)} preview`}>
      <header className="tool-header">
        <h1 className="tool-heading">{t(tool.title)}</h1>
        <p className="tool-subtitle">{t(tool.description)}</p>
      </header>
      <div className="panel" role="note">
        <h2 className="panel-title">{t("In progress — not available yet")}</h2>
        <p className="panel-summary">
          This tool is listed in the catalog so you can see where the project
          is going. It opens as soon as its engine and interface pass
          verification. Nothing to try here yet — check back soon.
        </p>
        <div className="panel-actions">
          <a className="btn-ghost" href={SITE_BASE}>
            {t("Back to all tools")}
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


/** The same lightweight chrome wraps every shipped workspace without owning its state. */
export function ToolEntry({ tool, onExit }: { tool: ToolDefinition; onExit: () => void }) {
  const { t, locale } = useLocale()
  const germanTool = locale === 'de' && hasGermanPage(tool.route)
  return <main tabIndex={-1} id="main-content" className="tool-workspace">
    <div className="workspace-context">
      {germanTool ? <nav className="workspace-breadcrumb" aria-label="Brotkrumennavigation"><a href="/pdf-tools/de/">Alle PDF-Werkzeuge</a><span aria-hidden="true">/</span><span aria-current="page">{t(tool.title)}</span></nav>
        : <div dangerouslySetInnerHTML={{ __html: breadcrumbHtml(hubForTool(tool), tool) }} />}
      {tool.implemented ? <details className="workspace-help">
        <summary>{t("How to use this tool")}</summary>
        <p>{t(tool.description)}</p>
        <p>{t("Selected files are processed in this browser, not uploaded for conversion. Follow the file and page limits shown below.")}</p>
      </details> : null}
    </div>
    <ToolLoadBoundary key={tool.id} title={t(tool.title)} onExit={onExit}>
      <Suspense fallback={<ToolLoading title={t(tool.title)} onExit={onExit} />}>
        <ToolContent tool={tool} onExit={onExit} />
      </Suspense>
    </ToolLoadBoundary>
    {tool.implemented ? <ToolLoadBoundary key={`${tool.id}:${germanTool ? 'de' : 'en'}`} title={t('Usage guidance')} onExit={onExit} subject="guide" headingLevel={2}>
      <Suspense fallback={null}>{germanTool ? tool.id === 'merge' ? <GermanMergeGuide /> : tool.id === 'split' ? <GermanSplitGuide /> : tool.id === 'rotate' ? <GermanRotateGuide /> : tool.id === 'delete-pages' ? <GermanDeleteGuide /> : tool.id === 'extract-pages' ? <GermanExtractGuide /> : tool.id === 'organize' ? <GermanOrganizeGuide /> : <GermanImagesToPdfGuide /> : <EnglishToolGuide tool={tool} />}</Suspense>
    </ToolLoadBoundary> : null}
  </main>
}
