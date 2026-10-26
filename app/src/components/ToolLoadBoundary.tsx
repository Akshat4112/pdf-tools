import { useLocale, translate } from '../i18n'
import { Component, type ReactNode } from 'react'

export function ToolLoading({ title, onExit, subject = 'tool' }: { title: string; onExit: () => void; subject?: 'tool' | 'guide' }) {
  const { t } = useLocale()
  return <section className="tool-screen workspace-loading" aria-busy="true">
    <header className="tool-header"><h1 className="tool-heading">{t(title)}</h1></header>
    <p role="status">{t(subject === 'guide' ? 'Opening this guide…' : 'Opening this tool…')}</p>
    <button className="btn-ghost" onClick={onExit}>{t("Back to all tools")}</button>
  </section>
}

/** Keep navigation available if an on-demand module cannot be loaded. */
export class ToolLoadBoundary extends Component<{ title: string; onExit: () => void; children: ReactNode; subject?: 'tool' | 'guide' }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="tool-screen workspace-loading">
      <header className="tool-header"><h1 className="tool-heading">{translate(this.props.title)}</h1></header>
      <p role="alert">{translate(this.props.subject === 'guide' ? 'This guide could not open. Check your connection and try again.' : 'This tool could not open. Check your connection and try again. Reloading clears this tool’s working files.')}</p>
      <div className="panel-actions"><button className="btn-primary" onClick={() => window.location.reload()}>{translate(this.props.subject === 'guide' ? 'Reload guide' : 'Reload tool')}</button>
        <button className="btn-ghost" onClick={this.props.onExit}>{t("Back to all tools")}</button></div>
    </section>
  }
}
