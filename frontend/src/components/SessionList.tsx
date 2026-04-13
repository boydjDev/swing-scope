import type { Session } from '../types'

interface SessionListProps {
  sessions: Session[]
  selected: Session | null
  onSelect: (session: Session) => void
}

export default function SessionList({ sessions, selected, onSelect }: SessionListProps) {
  return (
    <nav className="session-list">
      {sessions.length === 0 ? (
        <p className="empty-nav">No sessions yet</p>
      ) : (
        sessions.map(s => (
          <button
            key={s.id}
            className={`session-item${selected?.id === s.id ? ' active' : ''}`}
            onClick={() => onSelect(s)}
          >
            <span className="session-player">{s.player_name}</span>
            <span className="session-date">{s.date}</span>
          </button>
        ))
      )}
    </nav>
  )
}
