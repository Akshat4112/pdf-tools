import { Component, type ReactNode } from 'react'

export function ToolLoading({ title, onExit }: { title: string; onExit: () => void }) {
  return <section className="tool-screen workspace-loading" aria-busy="true">
    <header className="tool-header"><h1 className="tool-heading">{title}</h1></header>
    <p role="status">Opening this tool…</p>
    <button className="btn-ghost" onClick={onExit}>Back to all tools</button>
  </section>
}

/** Keep navigation available if an on-demand module cannot be loaded. */
export class ToolLoadBoundary extends Component<{ title: string; onExit: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <section className="tool-screen workspace-loading">
      <header className="tool-header"><h1 className="tool-heading">{this.props.title}</h1></header>
      <p role="alert">This tool could not open. Check your connection and try again. Reloading clears this tool’s working files.</p>
      <div className="panel-actions"><button className="btn-primary" onClick={() => window.location.reload()}>Reload tool</button>
        <button className="btn-ghost" onClick={this.props.onExit}>Back to all tools</button></div>
    </section>
  }
}
