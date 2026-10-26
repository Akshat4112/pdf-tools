import { useLocale } from '../i18n'
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

import { useId } from 'react'
import { usePanelHeading } from './usePanelHeading'
import type { JobProgress } from '../jobs/orchestrator'
import type { ToolError } from '../registry'
import type { VerifiedOutput } from '../outputs/verify'
import { formatBytes } from './format'

export function WorkspaceCleanupNote() {
  const { t } = useLocale()
  return <p className="panel-hint cleanup-note">{t("Start over removes selected files and results from this workspace. Original files and downloads already saved to your device are unaffected.")}</p>
}

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
  const { t } = useLocale()
  const hintId = useId()
  return (
    <section className="panel state-panel is-preview" aria-label={t("Preview")}>
      <h2 className="panel-title">{t(title)}</h2>
      <p className="panel-summary">{t(summary)}</p>
      {details && details.length > 0 ? (
        <ul className="panel-details">
          {details.map((d) => (
            <li key={d}>{t(d)}</li>
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
          aria-describedby={disabled && disabledReason ? hintId : undefined}
        >
          {t(actionLabel)}
        </button>
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {t("Back")}
          </button>
        ) : null}
      </div>
      {disabled && disabledReason ? (
        <p id={hintId} className="panel-hint" role="note">
          {disabledReason && t(disabledReason)}
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
  const { t } = useLocale()
  const heading = usePanelHeading()
  const pct = Math.max(0, Math.min(100, Math.round((Number.isFinite(progress.fraction) ? progress.fraction : 0) * 100)))
  // Unknown startup work and final checks are indeterminate; do not invent progress.
  const determinate = pct > 0 && pct < 100
  const detail = pct === 100 ? 'Finishing checks…' : progress.detail || 'Preparing and checking your files…'
  return (
    <section className="panel state-panel is-processing" aria-label={t("Processing")}>
      <h2 ref={heading} tabIndex={-1} className="panel-title">{t(label)}</h2>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={t(label)}
        aria-valuetext={determinate ? `${pct}% — ${t(detail)}` : t(detail)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? pct : undefined}
      >
        <div className={`progress-fill${determinate ? '' : ' is-indeterminate'}`} style={{ width: determinate ? `${pct}%` : '35%' }} />
      </div>
      <p className="panel-summary">
        {t(detail)}{determinate ? ` · ${pct}%` : ''}
      </p>
      <p className="panel-hint">{t("Processing on your device. Downloads appear after the result passes verification.")}</p>
      <div className="panel-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
      <WorkspaceCleanupNote />
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
  const { t } = useLocale()
  const heading = usePanelHeading()
  const recovery: Record<ToolError['recovery'], string> = {
    'show-formats': 'Choose a supported file format.',
    'explain-encryption': 'Password unlocking is not supported. Choose an unlocked copy you are permitted to use.',
    'retry-file': 'Choose a different file or try a fresh copy.',
    'show-limits': 'Use fewer pages or smaller files within the displayed limits.',
    'focus-picker': 'Review your file selection before running again.',
    'fix-field': 'Review the settings and correct any highlighted fields.',
    'retry-job': 'Review your settings, then try processing again.',
    'reduce-scope': 'Try fewer pages or a lower resolution.',
    'retry-download': 'Try the download again, or regenerate the result.',
    'suggest-browser': 'Try a current browser with the required features.',
  }
  return (
    <section className="panel state-panel is-error" aria-label={t("Something went wrong")} role="alert">
      <h2 ref={heading} tabIndex={-1} className="panel-title">{t("That didn't work")}</h2>
      <p className="panel-summary">{t(error.message)}</p>
      <p className="panel-hint">{t(recovery[error.recovery])} No download is available from this attempt.</p>
      <details className="error-details"><summary>{t("Error details")}</summary><p>{t("Error")} <code>{error.code}</code></p></details>
      <div className="panel-actions">
        <button type="button" className="btn-primary" onClick={onRetry}>
          {t("Review settings")}
        </button>
        <button type="button" className="btn-ghost" onClick={onReset}>
          {t("Start over")}
        </button>
      </div>
      <WorkspaceCleanupNote />
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
  retryLabel = 'Run again with other files',
}: {
  outputs: VerifiedOutput[]
  onDownload(output: VerifiedOutput): void
  onRetry(): void
  onReset(): void
  onContinue?(): void
  retryLabel?: string
}) {
  const { t } = useLocale()
  const heading = usePanelHeading()
  const ready = outputs.length > 0 && outputs.every(output => output.verified && output.actualBytes > 0 && output.actualBytes === output.bytes.byteLength)
  if (!ready) return <section className="panel state-panel" aria-label={t("Results")}><h2 ref={heading} tabIndex={-1} className="panel-title">{t("No verified result available")}</h2><p>{t("Start over and create a new result before downloading.")}</p><button type="button" className="btn-ghost" onClick={onReset}>{t("Start over")}</button></section>
  return (
    <section className="panel state-panel is-result" aria-label={t("Results")}>
      <h2 ref={heading} tabIndex={-1} className="panel-title">{t("Done — your files are ready")}</h2>
      <p className="panel-summary">
        {outputs.length === 1
          ? t('One file was generated and verified.')
          : t(`${outputs.length} files were generated and verified.`)}
      </p>
      <p className="panel-hint" role="status">Ready to download · {formatBytes(outputs.reduce((sum, output) => sum + output.actualBytes, 0))} total. Sizes are the actual generated files, not estimates.</p>
      <ul className="result-list">
        {outputs.map((o) => (
          <li key={o.name} className="result-row">
            <span className="file-name" title={o.name}>
              {o.name}
            </span>
            <span className="file-size" title={`${o.actualBytes.toLocaleString('en-US')} bytes`}>{formatBytes(o.actualBytes)}</span>
            <button
              type="button"
              className="btn-primary btn-download"
              onClick={() => onDownload(o)}
              aria-label={`${t('Download')} ${o.name} (${formatBytes(o.actualBytes)})`}
            >
              {t("Download")}
            </button>
          </li>
        ))}
      </ul>
      <div className="panel-actions">
        <button type="button" className="btn-ghost" onClick={onRetry}>
          {t(retryLabel)}
        </button>
        <button type="button" className="btn-ghost" onClick={onReset}>
          {t("Start over")}
        </button>
        {onContinue ? (
          <button type="button" className="btn-ghost" onClick={onContinue}>
            {t("Back to all tools")}
          </button>
        ) : null}
      </div>
      <WorkspaceCleanupNote />
    </section>
  )
}

/** Cancelled state — S5 exit without partial results (PT-PD-003 §5). */
export function CancelledPanel({ onReset, onAdjust }: { onReset(): void; onAdjust?(): void }) {
  const { t } = useLocale()
  const heading = usePanelHeading()
  return (
    <section className="panel state-panel is-cancelled" aria-label={t("Cancelled")} role="status">
      <h2 ref={heading} tabIndex={-1} className="panel-title">{t("Cancelled")}</h2>
      <p className="panel-summary">
        This attempt was cancelled. No partial result is available to download. You can adjust the settings and try again.
      </p>
      <div className="panel-actions">
        {onAdjust ? <button type="button" className="btn-primary" onClick={onAdjust}>{t("Adjust settings")}</button> : null}
        <button type="button" className={onAdjust ? "btn-ghost" : "btn-primary"} onClick={onReset}>
          {t("Start over")}
        </button>
      </div>
      <WorkspaceCleanupNote />
    </section>
  )
}
