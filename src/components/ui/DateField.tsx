import { useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react'
import CalendarPopover from './CalendarPopover'
import { formatDate } from '../../lib/format'
import './date-field.css'

// A7: one consistent date picker across the app. Native <input type="date"> renders
// its value in the browser's locale (English month names) and gets visually scrambled
// inside an RTL container ("Jul 2026 5"). This trigger always shows the app's Hebrew
// d.M.yyyy via formatDate, a clear "בחרו תאריך" hint when empty, and opens the shared
// CalendarPopover — so every date field reads the same, RTL-correct.
export function DateField({
  value, onChange, min, max,
  placeholder = 'בחרו תאריך', ariaLabel, className = '',
}: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  placeholder?: string
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`datefield${value ? '' : ' is-empty'} ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel ?? placeholder}
      >
        <span className="datefield-text">{value ? formatDate(value) : placeholder}</span>
        <CalendarBlank size={17} weight="duotone" className="datefield-icon" />
      </button>
      <CalendarPopover
        open={open}
        value={value}
        min={min}
        max={max}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
