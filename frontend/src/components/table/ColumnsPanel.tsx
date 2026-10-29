import { useMemo, useState } from 'react'
import Popover from './Popover'
import { COLUMNS, GROUP_LABEL, GROUP_ORDER } from './columns'

type Props = {
  hidden: Set<string>
  frozen: Set<string>
  onToggleHidden: (key: string) => void
  onToggleFrozen: (key: string) => void
  onShowAll: () => void
  onReset: () => void
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <path
        d="M7.2 1.2 10.8 4.8 9.3 5.1 6.9 7.5 6.6 9.9 2.1 5.4 4.5 5.1 6.9 2.7 7.2 1.2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M2.4 9.6 0.9 11.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

export default function ColumnsPanel({
  hidden,
  frozen,
  onToggleHidden,
  onToggleFrozen,
  onShowAll,
  onReset,
}: Props) {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return GROUP_ORDER.map(group => ({
      group,
      label: GROUP_LABEL[group] ?? group,
      columns: COLUMNS.filter(
        col => col.group === group && (!needle || col.label.toLowerCase().includes(needle)),
      ),
    })).filter(section => section.columns.length > 0)
  }, [query])

  const visibleCount = COLUMNS.length - hidden.size
  const canHideMore = visibleCount > 1

  return (
    <Popover
      width={300}
      trigger={({ ref, toggle, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`inline-flex h-7 items-center gap-1.5 rounded border px-2 text-[11px] font-medium transition-colors ${
            open
              ? 'border-slate-400 bg-slate-100 text-slate-900'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
            <rect x="1" y="1.6" width="3" height="8.8" rx="0.6" fill="currentColor" opacity="0.85" />
            <rect x="4.9" y="1.6" width="3" height="8.8" rx="0.6" fill="currentColor" opacity="0.55" />
            <rect x="8.8" y="1.6" width="2.2" height="8.8" rx="0.6" fill="currentColor" opacity="0.3" />
          </svg>
          Columns
          <span className="tabular rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
            {visibleCount}/{COLUMNS.length}
          </span>
        </button>
      )}
    >
      {() => (
        <>
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Columns</span>
              <span className="text-[10px] text-slate-500">
                {frozen.size} frozen
              </span>
            </div>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search columns…"
              aria-label="Search columns"
              className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-[11.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {grouped.map(section => (
              <div key={section.group} className="pb-1">
                <p className="sticky top-0 z-10 bg-white px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {section.label}
                </p>
                {section.columns.map(col => {
                  const isHidden = hidden.has(col.key)
                  const isFrozen = frozen.has(col.key)
                  const lockHide = !isHidden && !canHideMore
                  return (
                    <div
                      key={col.key}
                      className="group flex items-center gap-2 px-3 py-[3px] hover:bg-slate-50"
                    >
                      <input
                        id={`col-${col.key}`}
                        type="checkbox"
                        checked={!isHidden}
                        disabled={lockHide}
                        onChange={() => onToggleHidden(col.key)}
                        title={lockHide ? 'Minimal satu kolom harus tetap tampil' : undefined}
                        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-blue-700 disabled:opacity-40"
                      />
                      <label
                        htmlFor={`col-${col.key}`}
                        className={`flex-1 truncate text-[11.5px] ${isHidden ? 'text-slate-400' : 'text-slate-700'}`}
                        title={col.label}
                      >
                        {col.label}
                      </label>
                      <button
                        type="button"
                        disabled={isHidden}
                        onClick={() => onToggleFrozen(col.key)}
                        aria-pressed={isFrozen}
                        aria-label={`${isFrozen ? 'Unfreeze' : 'Freeze'} ${col.label}`}
                        title={isFrozen ? 'Lepas freeze' : 'Freeze kolom'}
                        className={`shrink-0 rounded p-1 transition-colors disabled:opacity-25 ${
                          isFrozen
                            ? 'bg-blue-100 text-blue-800'
                            : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                        }`}
                      >
                        <PinIcon filled={isFrozen} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="px-3 py-6 text-center text-[11px] text-slate-400">Tidak ada kolom yang cocok.</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1.5">
            <button
              type="button"
              onClick={onShowAll}
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-blue-700 hover:bg-blue-100"
            >
              Show all
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-slate-500 hover:bg-slate-200"
            >
              Reset layout
            </button>
          </div>
        </>
      )}
    </Popover>
  )
}