import type { ImportSummary as ImportSummaryType } from '../types'

interface ImportSummaryProps {
  summary: ImportSummaryType
}

export default function ImportSummary({ summary }: ImportSummaryProps) {
  return (
    <div className="summary">
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
