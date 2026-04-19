import { useState } from 'react'
import type { Session } from '../types'
import '../styles/SessionList.css'
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
  onDeleteMultiple: (sessions: Session[]) => void
}

export default function SessionList({
  sessions, selected, allSelected,
  fromDate, toDate, onFromDate, onToDate,
  onSelect, onSelectAll, onDeleteMultiple,
}: SessionListProps) {
  const [editMode, setEditMode] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())

  function toggleCheck(id: number) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exitEditMode() {
    setEditMode(false)
    setChecked(new Set())
  }

  function handleDeleteSelected() {
    onDeleteMultiple(sessions.filter(s => checked.has(s.id)))
    exitEditMode()
  }

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
            {!editMode && (
              <>
                <button
                  className={`session-item all-sessions-item${allSelected ? ' active' : ''}`}
                  onClick={onSelectAll}
                >
                  <span className="session-player">Total Overview</span>
                </button>
                <div className="session-list-divider" />
              </>
            )}
            {sessions.map(s => {
              const { date } = parseSessionDate(s.date)
              return editMode ? (
                <label key={s.id} className={`session-item session-item-check${checked.has(s.id) ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    className="session-checkbox"
                    checked={checked.has(s.id)}
                    onChange={() => toggleCheck(s.id)}
                  />
                  <span className="session-date">{date}</span>
                  <span className="session-shot-count">{s.shot_count} shots</span>
                </label>
              ) : (
                <button
                  key={s.id}
                  className={`session-item${selected?.id === s.id ? ' active' : ''}`}
                  onClick={() => onSelect(s)}
                >
                  <span className="session-date">{date}</span>
                  <span className="session-shot-count">{s.shot_count} shots</span>
                </button>
              )
            })}
          </>
        )}
      </div>

      <div className="session-list-footer">
        {editMode ? (
          <>
            <button
              className="session-delete-btn"
              disabled={checked.size === 0}
              onClick={handleDeleteSelected}
            >
              Delete{checked.size > 0 ? ` (${checked.size})` : ''}
            </button>
            <button className="session-list-edit-btn" onClick={exitEditMode}>Done</button>
          </>
        ) : (
          <button className="session-list-edit-btn" onClick={() => setEditMode(true)} disabled={sessions.length === 0}>Edit</button>
        )}
      </div>
    </nav>
  )
}
