import type { ImportSummary as ImportSummaryType } from '../types'
import '../styles/ImportSummary.css'

interface ImportSummaryProps {
  summary: ImportSummaryType
  onDismiss: () => void
}

export default function ImportSummary({ summary, onDismiss }: ImportSummaryProps) {
  return (
    <div className="summary">
      <button className="summary-dismiss" onClick={onDismiss} aria-label="Dismiss">✕</button>
      <p>
        {summary.imported > 0 && <span className="ok">{summary.imported} imported</span>}
        {summary.skipped > 0 && <span className="warn">{summary.skipped} skipped</span>}
        {summary.errors > 0 && <span className="err">{summary.errors} failed</span>}
      </p>
      <ul>
        {summary.results.map(r => (
          <li key={r.filename} className={r.status}>
            <span className="fname">{r.filename}</span>
            <span className="msg">{r.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
