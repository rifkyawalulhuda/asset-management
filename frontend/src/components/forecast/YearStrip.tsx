import type { ForecastTotals } from './forecastUtils'
import { idrCompact, idrFull } from './forecastUtils'

export default function YearStrip({
  years,
  totals,
  selected,
  onSelect,
}: {
  years: number[]
  totals: (ForecastTotals | undefined)[]
  selected: number
  onSelect: (year: number) => void
}) {
  const max = Math.max(1, ...totals.map(item => item?.combined_yearly_depreciation ?? 0))

  return (
    <section className="shrink-0 rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-1.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[12px] font-semibold text-slate-800">Multi-year trajectory</h2>
          <p className="text-[10px] text-slate-400">Yearly depreciation · net book value</p>
        </div>
        <p className="text-[10px] text-slate-400">Click a year to forecast it</p>
      </div>

      <div
        className="grid gap-1 px-2 py-2"
        style={{ gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }}
      >
        {years.map((year, index) => {
          const item = totals[index]
          const value = item?.combined_yearly_depreciation ?? 0
          const nbv = item?.combined_net_book_value ?? 0
          const isSelected = year === selected

          return (
            <button
              key={year}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(year)}
              title={idrFull(value)}
              className={`flex flex-col rounded border px-2 py-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-slate-800 bg-slate-50 ring-1 ring-slate-800/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className={`tabular text-[10px] font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                {year}
              </span>
              <span className="tabular mt-0.5 text-[12px] font-semibold leading-tight text-slate-800">
                {item ? idrCompact(value) : '…'}
              </span>
              <span className="tabular text-[9.5px] text-slate-400">
                NBV {item ? idrCompact(nbv) : '…'}
              </span>
              <span className="mt-1 block h-1 overflow-hidden rounded bg-slate-100">
                <span
                  className={`block h-1 rounded transition-[width] duration-200 motion-reduce:transition-none ${
                    isSelected ? 'bg-slate-800' : 'bg-slate-400'
                  }`}
                  style={{ width: `${Math.max(3, (value / max) * 100)}%` }}
                />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}