import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FIELD } from './fieldStyles'

/**
 * Text input with a real dropdown.
 *
 * A native `<datalist>` cannot be used here: the browser filters its options by
 * whatever the input already contains, so a field holding a value offered only
 * that one value and the user had to clear it to see the rest. This control
 * always opens the full list, filters only while the user types, and still
 * accepts a value that is not in the list (sites and jobs can be new).
 */
export default function Combobox({
  id,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  invalid,
  describedBy,
  emptyLabel = 'No match',
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  options: string[]
  placeholder?: string
  invalid?: boolean
  describedBy?: string
  emptyLabel?: string
}) {
  const listId = useId()
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // The form resets this field when the record loads, so the draft follows it.
  useEffect(() => {
    setDraft(value)
  }, [value])

  const filtered = useMemo(() => {
    if (showAll || draft.trim() === '') return options
    const query = draft.trim().toLowerCase()
    return options.filter(option => option.toLowerCase().includes(query))
  }, [options, draft, showAll])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
      setShowAll(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (active < 0) return
    const node = document.getElementById(`${listId}-option-${active}`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  const commit = (option: string) => {
    setDraft(option)
    onChange(option)
    setOpen(false)
    setShowAll(false)
    setActive(-1)
  }

  const openAll = () => {
    setShowAll(true)
    setOpen(true)
    setActive(-1)
    inputRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setShowAll(false)
        return
      }
      setActive(current => Math.min(current + 1, filtered.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(current => Math.max(current - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      if (open && active >= 0 && filtered[active] != null) {
        event.preventDefault()
        commit(filtered[active])
      }
      return
    }
    if (event.key === 'Escape') {
      if (!open) return
      event.preventDefault()
      setOpen(false)
      setShowAll(false)
      setActive(-1)
    }
  }

  const showList = open && filtered.length > 0

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        value={draft}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        aria-activedescendant={active >= 0 ? `${listId}-option-${active}` : undefined}
        placeholder={placeholder}
        autoComplete="off"
        onChange={event => {
          setDraft(event.target.value)
          onChange(event.target.value)
          setShowAll(false)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => {
          setShowAll(true)
          setOpen(true)
        }}
        onBlur={() => {
          // A click on an option fires mousedown before blur, so the option wins.
          setOpen(false)
          setShowAll(false)
          onBlur?.()
        }}
        onKeyDown={onKeyDown}
        className={`${FIELD} pr-7`}
      />

      <button
        type="button"
        tabIndex={-1}
        aria-label="Show options"
        onClick={() => (open ? (setOpen(false), setShowAll(false)) : openAll())}
        className="absolute right-0 top-0 flex h-8 w-7 items-center justify-center rounded-r text-slate-400 hover:text-slate-700"
      >
        <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2.5 w-2.5">
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Options"
          className="fx-scroll absolute left-0 right-0 top-full z-30 mt-1 max-h-[224px] overflow-auto rounded border border-slate-300 bg-white py-0.5 text-[11.5px] shadow-[0_14px_32px_-12px_rgba(15,23,42,0.4)]"
        >
          {filtered.map((option, index) => {
            const selected = option === value
            return (
              <li
                key={option}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={selected}
                onMouseDown={event => {
                  event.preventDefault()
                  commit(option)
                }}
                onMouseEnter={() => setActive(index)}
                className={`cursor-pointer px-2 py-[5px] ${
                  active === index ? 'bg-slate-100' : ''
                } ${selected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
              >
                {option}
              </li>
            )
          })}
        </ul>
      )}

      {open && filtered.length === 0 && (
        <p className="absolute left-0 right-0 top-full z-30 mt-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-[10.5px] text-slate-500 shadow-sm">
          {emptyLabel} — the typed value is kept as is.
        </p>
      )}
    </div>
  )
}
