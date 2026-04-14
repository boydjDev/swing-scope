import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import '../styles/DatePicker.css'

interface DatePickerProps {
  value: string        // YYYY-MM-DD or ""
  placeholder: string
  onChange: (v: string) => void
}

export default function DatePicker({ value, placeholder, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = value ? new Date(value + 'T00:00:00') : undefined

  const displayValue = selected
    ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleSelect(date: Date | undefined) {
    if (!date) { onChange(''); return }
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    onChange(`${date.getFullYear()}-${mm}-${dd}`)
    setOpen(false)
  }

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
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={new Date(2030, 11)}
          />
        </div>
      )}
    </div>
  )
}
