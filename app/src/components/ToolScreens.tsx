/**
 * Preview, progress and result screens — PT-UX-003.
 *
 * Reusable S4/S5/S6 components (PT-PD-002 §3):
 * - PreviewPanel: page-order/options confirmation before processing (S4)
 * - ProcessingPanel: deterministic progress + cancel affordance (S5)
 * - ResultPanel: verified outputs with names, real byte sizes, download
 *   buttons, retry, and Start over (S6) — consumes VerifiedOutput from
 *   PT-FND-007 (never unverified bytes)
 * - FailurePanel: taxonomy error + recovery affordance (S7)
 */

import type { JobProgress } from '../jobs/orchestrator'
import type { ToolError } from '../registry'
import type { VerifiedOutput } from '../outputs/verify'
import { formatBytes } from './format'

/** S4 — preview before processing. */
export function PreviewPanel({
  title,
  summary,
  details,
  actionLabel,
  onConfirm,
  disabled,
  disabledReason,
  onCancel,
}: {
  title: string
  summary: string
  details?: string[]
  actionLabel: string
  onConfirm(): void
  disabled?: boolean
  disabledReason?: string
  onCancel?(): void
}) {
  return (
    <section className="panel" aria-label="Preview">
      <h2 className="panel-title">{title}</h2>
      <p className="panel-summary">{summary}</p>
      {details && details.length > 0 ? (
        <ul className="panel-details">
          {details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      <div className="panel-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          disabled={disabled}
          aria-disabled={disabled}
        >
          {actionLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Back
          </button>
        ) : null}
      </div>
      {disabled && disabledReason ? (
        <p className="panel-hint" role="note">
          {disabledReason}
        </p>
      ) : null}
    </section>
  )
}

/** S5 — processing with deterministic progress and cancel. */
export function ProcessingPanel({
  label,
  progress,
  onCancel,
}: {
  label: string
  progress: JobProgress
  onCancel(): void
}) {
  const pct = Math.round(progress.fraction * 100)
  return (
    <section className="panel" aria-label="Processing" aria-live="polite">
      <h2 className="panel-title">{label}</h2>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="panel-summary">
        {progress.detail ? `${progress.detail} · ` : ''}
        {pct}%
      </p>
      <div className="panel-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}

/** S7 — failure with taxonomy code + recovery. */
export function FailurePanel({
  error,
  onRetry,
  onReset,
}: {
  error: ToolError
  onRetry(): void
  onReset(): void
}) {
  return (
    <section className="panel is-error" aria-label="Something went wrong" role="alert">
      <h2 className="panel-title">That didn't work</h2>
      <p className="panel-summary">{error.message}</p>
      <p className="panel-hint">
        Error <code>{error.code}</code> — you can retry or start over.
      </p>
      <div className="panel-actions">
        <button type="button" className="btn-primary" onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="btn-ghost" onClick={onReset}>
          Start over
        </button>
      </div>
    </section>
  )
}

/** S6 — verified results with honest sizes and downloads. */
export function ResultPanel({
  outputs,
  onDownload,
  onRetry,
  onReset,
  onContinue,
}: {
  outputs: VerifiedOutput[]
  onDownload(output: VerifiedOutput): void
  onRetry(): void
  onReset(): void
  onContinue?(): void
}) {
  return (
    <section className="panel" aria-label="Results">
      <h2 className="panel-title">Done — your files are ready</h2>
      <p className="panel-summary">
        {outputs.length === 1
          ? 'One file was generated and verified.'
          : `${outputs.length} files were generated and verified.`}
      </p>
      <ul className="result-list">
        {outputs.map((o) => (
          <li key={o.name} className="result-row">
            <span className="file-name" title={o.name}>
              {o.name}
            </span>
            <span className="file-size">{formatBytes(o.actualBytes)}</span>
            <button
              type="button"
              className="btn-primary btn-download"
              onClick={() => onDownload(o)}
              aria-label={`Download ${o.name} (${formatBytes(o.actualBytes)})`}
            >
              Download
            </button>
          </li>
        ))}
      </ul>
      <div className="panel-actions">
        <button type="button" className="btn-ghost" onClick={onRetry}>
          Run again with other files
        </button>
        <button type="button" className="btn-ghost" onClick={onReset}>
          Start over
        </button>
        {onContinue ? (
          <button type="button" className="btn-ghost" onClick={onContinue}>
            Continue to another tool
          </button>
        ) : null}
      </div>
    </section>
  )
}

/** Cancelled state — S5 exit without partial results (PT-PD-003 §5). */
export function CancelledPanel({ onReset }: { onReset(): void }) {
  return (
    <section className="panel" aria-label="Cancelled" role="status">
      <h2 className="panel-title">Cancelled</h2>
      <p className="panel-summary">
        The job was stopped and no partial files were kept.
      </p>
      <div className="panel-actions">
        <button type="button" className="btn-primary" onClick={onReset}>
          Start over
        </button>
      </div>
    </section>
  )
}
