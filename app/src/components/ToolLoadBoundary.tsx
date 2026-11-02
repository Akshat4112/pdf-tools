import { useLocale, translate } from '../i18n'
import { Component, type ReactNode } from 'react'

export function ToolLoading({ title, onExit, subject = 'tool', headingLevel = 1 }: { title: string; onExit: () => void; subject?: 'tool' | 'guide'; headingLevel?: 1 | 2 }) {
  const { t } = useLocale()
  const Heading = headingLevel === 2 ? 'h2' : 'h1'
  const inlineGuide = subject === 'guide' && headingLevel === 2
  return <section className="tool-screen workspace-loading" aria-busy="true">
    <header className="tool-header"><Heading className="tool-heading">{t(title)}</Heading></header>
    <p role="status">{t(subject === 'guide' ? 'Opening this guide…' : 'Opening this tool…')}</p>
    {inlineGuide ? null : <button className="btn-ghost" onClick={onExit}>{t("Back to all tools")}</button>}
  </section>
}

/** Keep navigation available if an on-demand module cannot be loaded. */
export class ToolLoadBoundary extends Component<{ title: string; onExit: () => void; children: ReactNode; subject?: 'tool' | 'guide'; headingLevel?: 1 | 2 }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    const Heading = this.props.headingLevel === 2 ? 'h2' : 'h1'
    const inlineGuide = this.props.subject === 'guide' && this.props.headingLevel === 2
    return <section className="tool-screen workspace-loading">
      <header className="tool-header"><Heading className="tool-heading">{translate(this.props.title)}</Heading></header>
      <p role="alert">{translate(inlineGuide ? 'Usage guidance could not load. The tool remains available.' : this.props.subject === 'guide' ? 'This guide could not open. Check your connection and try again.' : 'This tool could not open. Check your connection and try again. Reloading clears this tool’s working files.')}</p>
      {inlineGuide ? null : <div className="panel-actions"><button className="btn-primary" onClick={() => window.location.reload()}>{translate(this.props.subject === 'guide' ? 'Reload guide' : 'Reload tool')}</button>
        <button className="btn-ghost" onClick={this.props.onExit}>{translate('Back to all tools')}</button></div>}
    </section>
  }
}
