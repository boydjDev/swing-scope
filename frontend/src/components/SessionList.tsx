import type { Session } from '../types'
import DatePicker from './DatePicker'
import { parseSessionDate } from '../utils/parseSessionDate'

interface SessionListProps {
  sessions: Session[]
  selected: Session | null
  allSelected: boolean
  fromDate: string
  toDate: string
  onFromDate: (v: string) => void
  onToDate: (v: string) => void
  onSelect: (session: Session) => void
  onSelectAll: () => void
}

export default function SessionList({
  sessions, selected, allSelected,
  fromDate, toDate, onFromDate, onToDate,
  onSelect, onSelectAll,
}: SessionListProps) {
  return (
    <nav className="session-list">
      <div className="date-filter">
        <label className="date-filter-label">From</label>
        <DatePicker value={fromDate} placeholder="Start date" onChange={onFromDate} />
        <label className="date-filter-label">To</label>
        <DatePicker value={toDate} placeholder="End date" onChange={onToDate} />
      </div>

      <div className="session-list-items">
        {sessions.length === 0 ? (
          <p className="empty-nav">No sessions</p>
        ) : (
          <>
            <button
              className={`session-item all-sessions-item${allSelected ? ' active' : ''}`}
              onClick={onSelectAll}
            >
              <span className="session-player">Total Overview</span>
            </button>
            <div className="session-list-divider" />
            {sessions.map(s => (
              <button
                key={s.id}
                className={`session-item${selected?.id === s.id ? ' active' : ''}`}
                onClick={() => onSelect(s)}
              >
                {(() => { const { date, time } = parseSessionDate(s.date); return (
                  <>
                    <span className="session-date">{date}</span>
                    <span className="session-time">{time}</span>
                    <span className="session-player">{s.player_name}</span>
                  </>
                )})()}
              </button>
            ))}
          </>
        )}
      </div>
    </nav>
  )
}
