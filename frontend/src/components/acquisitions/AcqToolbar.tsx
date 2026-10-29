import type { AcquisitionType } from '../../types'
import type { AcqFilters } from './acqUtils'
import { TYPES } from './acqUtils'
import TypeChip from './TypeChip'

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
      <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.6 10.6 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function AcqToolbar({
  filters,
  onChange,
  year,
  years,
  onYear,
  sites,
  jobs,
  typeCounts,
  incompleteCount,
  grouped,
  onGrouped,
  onClear,
  onClearAsset,
  hasFilters,
}: {
  filters: AcqFilters
  onChange: (patch: Partial<AcqFilters>) => void
  year: number
  years: number[]
  onYear: (year: number) => void
  sites: string[]
  jobs: string[]
  typeCounts: Record<AcquisitionType, number>
  incompleteCount: number
  grouped: boolean
  onGrouped: (value: boolean) => void
  onClear: () => void
  onClearAsset: () => void
  hasFilters: boolean
}) {
  const toggleType = (type: AcquisitionType) => {
    const next = filters.types.includes(type)
      ? filters.types.filter(item => item !== type)
      : [...filters.types, type]
    onChange({ types: next })
  }

  return (
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
          <SearchIcon />
        </span>
        <input
          type="text"
          aria-label="Search asset, AX number, bookslip or vendor"
          placeholder="Search asset / AX / bookslip…"
          value={filters.search}
          onChange={event => onChange({ search: event.target.value })}
          className="h-7 w-56 rounded border border-slate-300 pl-7 pr-2 text-[11.5px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {filters.asset && (
        <span className="inline-flex items-center gap-1 rounded border border-slate-400 bg-slate-100 px-1.5 py-[2px] text-[10.5px] text-slate-800">
          <span className="text-slate-500">Asset</span>
          <span className="font-mono text-[10.5px] font-medium">{filters.asset}</span>
          <button
            type="button"
            onClick={onClearAsset}
            aria-label={`Remove asset filter ${filters.asset}`}
            className="ml-0.5 text-slate-400 hover:text-slate-700"
          >
            ×
          </button>
        </span>
      )}

      <span className="mx-1 h-5 w-px bg-slate-200" />

      <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
        Year
        <select
          value={year}
          onChange={event => onYear(Number(event.target.value))}
          className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {years.map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by type">
        {TYPES.map(type => {
          const active = filters.types.includes(type)
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(type)}
              className={`rounded border px-1 py-[1px] transition-opacity ${active ? 'opacity-100 ring-1 ring-slate-400' : 'opacity-55 hover:opacity-100'}`}
              title={`${typeCounts[type]} record(s) — click to ${active ? 'remove' : 'add'} filter`}
            >
              <TypeChip type={type} count={typeCounts[type]} />
            </button>
          )
        })}
      </div>

      <span className="mx-1 h-5 w-px bg-slate-200" />

      <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
        From
        <input
          type="date"
          value={filters.from}
          onChange={event => onChange({ from: event.target.value })}
          className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>
      <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
        To
        <input
          type="date"
          value={filters.to}
          onChange={event => onChange({ to: event.target.value })}
          className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </label>

      <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
        Site
        <select
          value={filters.site}
          onChange={event => onChange({ site: event.target.value })}
          className="h-7 max-w-[92px] rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All</option>
          {sites.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
        Job
        <select
          value={filters.job}
          onChange={event => onChange({ job: event.target.value })}
          className="h-7 max-w-[92px] rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All</option>
          {jobs.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <button
        type="button"
        aria-pressed={filters.showIncomplete}
        onClick={() => onChange({ showIncomplete: !filters.showIncomplete })}
        className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-[10.5px] font-medium transition-colors ${
          filters.showIncomplete
            ? 'border-amber-300 bg-amber-50 text-amber-800'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
        }`}
        title="Rows missing a date or price"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Incomplete {incompleteCount > 0 && <span className="tabular">{incompleteCount}</span>}
      </button>

      <button
        type="button"
        aria-pressed={grouped}
        onClick={() => onGrouped(!grouped)}
        className={`inline-flex h-7 items-center gap-1.5 rounded border px-2 text-[10.5px] font-medium transition-colors ${
          grouped ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        Group bookslip
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="h-7 rounded px-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          Clear all
        </button>
      )}
    </div>
  )
}