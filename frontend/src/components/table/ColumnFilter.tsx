import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { defaultFilter, isFilterActive } from './filterUtils'
import type { FilterKind, FilterValue } from './filterUtils'

const PANEL_WIDTH = 288
const PANEL_MAX_HEIGHT = 380
const LIST_LIMIT = 300

type Props = {
  label: string
  kind: FilterKind
  options: string[]
  value: FilterValue | undefined
  onChange: (next: FilterValue | undefined) => void
  /** When true the search box only narrows the value list (server-side filters). */
  searchOnly?: boolean
}

function FunnelIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-[11px] w-[11px]">
      <path
        d="M1.6 2.4h8.8M3.4 6h5.2M4.8 9.6h2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function ChequeIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <path
        d="M2 6.2 4.6 8.8 10 3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function ColumnFilter({ label, kind, options, value, onChange, searchOnly = false }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [query, setQuery] = useState('')

  const active = isFilterActive(value)
  const current = value ?? defaultFilter(kind)
  const selected = current.kind === 'values' ? current.values : []
  const text = current.kind === 'values' ? current.text : ''
  const searchTerm = searchOnly ? query : text
  const min = current.kind === 'range' ? current.min : ''
  const max = current.kind === 'range' ? current.max : ''
  const from = current.kind === 'date' ? current.from : ''
  const to = current.kind === 'date' ? current.to : ''

  const place = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left - 6, window.innerWidth - PANEL_WIDTH - 8))
    const below = rect.bottom + 6
    const top = below + PANEL_MAX_HEIGHT > window.innerHeight
      ? Math.max(8, rect.top - PANEL_MAX_HEIGHT - 6)
      : below
    setPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  const emit = (next: FilterValue) => onChange(isFilterActive(next) ? next : undefined)

  const patch = (partial: Record<string, string | string[]>) => {
    if (kind === 'text') {
      const base = current.kind === 'values' ? current : defaultFilter('text')
      emit({ ...(base as Extract<FilterValue, { kind: 'values' }>), ...partial } as FilterValue)
      return
    }
    if (kind === 'number') {
      const base = current.kind === 'range' ? current : defaultFilter('number')
      emit({ ...(base as Extract<FilterValue, { kind: 'range' }>), ...partial } as FilterValue)
      return
    }
    const base = current.kind === 'date' ? current : defaultFilter('date')
    emit({ ...(base as Extract<FilterValue, { kind: 'date' }>), ...partial } as FilterValue)
  }

  const toggleValue = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter(v => v !== option)
      : [...selected, option]
    patch({ values: next })
  }

  const visibleOptions = searchTerm.trim()
    ? options.filter(option => option.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    : options

  const shownOptions = visibleOptions.slice(0, LIST_LIMIT)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-label={`Filter ${label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={`Filter ${label}`}
        className={`absolute right-0 top-0 flex h-[18px] w-[18px] items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
          active
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-white/55 hover:bg-white/20 hover:text-white'
        }`}
      >
        <FunnelIcon />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Filter ${label}`}
          style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT }}
          className="fixed z-[80] flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white text-[11.5px] text-slate-800 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="truncate font-semibold text-slate-700">Filter · {label}</span>
            <button
              type="button"
              onClick={() => {
                onChange(undefined)
                setOpen(false)
              }}
              disabled={!active}
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Clear
            </button>
          </div>

          {kind === 'text' && (
            <>
              <div className="border-b border-slate-200 p-2">
                <input
                  autoFocus
                  type="search"
                  value={searchTerm}
                  onChange={event => {
                    if (searchOnly) setQuery(event.target.value)
                    else patch({ text: event.target.value })
                  }}
                  placeholder="Search values…"
                  aria-label={`Search ${label} values`}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-[11.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <p className="mt-1 text-[10px] leading-tight text-slate-400">
                  {searchOnly
                    ? 'Nilai terpilih disaring di server (seluruh data). Kotak ini hanya mempersempit daftar.'
                    : 'Ketik untuk menyaring langsung, atau centang nilai tertentu.'}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {shownOptions.length === 0 && (
                  <p className="px-3 py-4 text-center text-[11px] text-slate-400">Tidak ada nilai yang cocok.</p>
                )}
                {shownOptions.map(option => (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1 hover:bg-blue-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(option)}
                      onChange={() => toggleValue(option)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-blue-700"
                    />
                    <span className="truncate" title={option}>{option}</span>
                  </label>
                ))}
                {visibleOptions.length > shownOptions.length && (
                  <p className="px-3 py-1 text-[10px] text-slate-400">
                    Menampilkan {shownOptions.length} dari {visibleOptions.length} nilai — persempit pencarian.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => patch({ values: visibleOptions })}
                  className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-blue-700 hover:bg-blue-100"
                >
                  Select all{searchTerm.trim() ? ' (filtered)' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => patch({ values: [] })}
                  className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500 hover:bg-slate-200"
                >
                  Clear selection
                </button>
              </div>
            </>
          )}

          {kind === 'number' && (
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Min</span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={min}
                    onChange={event => patch({ min: event.target.value.replace(/[^\d.-]/g, '') })}
                    placeholder="—"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11.5px] tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Max</span>
                  <input
                    inputMode="decimal"
                    value={max}
                    onChange={event => patch({ max: event.target.value.replace(/[^\d.-]/g, '') })}
                    placeholder="—"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11.5px] tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
              </div>
              <p className="text-[10px] leading-tight text-slate-400">
                Kosongkan salah satu batas untuk filter terbuka (≥ min atau ≤ max).
              </p>
            </div>
          )}

          {kind === 'date' && (
            <div className="space-y-3 p-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={event => patch({ from: event.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-[11.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={event => patch({ to: event.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-[11.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1.5">
            <span className="inline-flex items-center gap-1 px-1 text-[10px] text-slate-400">
              {active && <><ChequeIcon /> aktif</>}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-900"
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}