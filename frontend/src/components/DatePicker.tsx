import { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  value: string        // YYYY-MM-DD or ""
  placeholder: string
  onChange: (v: string) => void
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function DatePicker({ value, placeholder, onChange }: DatePickerProps) {
  const today = new Date()
  const parsed = value ? new Date(value + 'T00:00:00') : null

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Sync view to value when it changes externally
  useEffect(() => {
    if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()) }
  }, [value])

  function select(day: number) {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth
    ? parsed.getDate() : null

  const displayValue = parsed
    ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="datepicker" ref={ref}>
      <button
        className={`datepicker-btn${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={displayValue ? '' : 'datepicker-placeholder'}>
          {displayValue || placeholder}
        </span>
        {value && (
          <span
            className="datepicker-clear"
            onMouseDown={e => { e.stopPropagation(); onChange(''); setOpen(false) }}
          >✕</span>
        )}
      </button>

      {open && (
        <div className="datepicker-popover">
          <div className="datepicker-header">
            <button onClick={prevMonth}>‹</button>
            <span>{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth}>›</button>
          </div>
          <div className="datepicker-grid">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <span key={d} className="datepicker-dow">{d}</span>
            ))}
            {cells.map((day, i) =>
              day === null
                ? <span key={i} />
                : <button
                    key={i}
                    className={`datepicker-day${day === selectedDay ? ' selected' : ''}`}
                    onClick={() => select(day)}
                  >
                    {day}
                  </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
