import { useMemo, useState } from 'react'
import type { Dim } from './forecastUtils'
import { DIMS, DIM_LABEL, MONTHS, OTHER_COLOR, OTHER_KEY, PALETTE, idrCompact, idrFull, labelOf } from './forecastUtils'

export type ChartRow = { key: string; months: number[]; total: number }

const CHART_H = 148
const TOP_N = 7

export default function MonthChart({
  rows,
  dim,
  year,
  onDrill,
  onDim,
}: {
  rows: ChartRow[]
  dim: Dim
  year: number
  onDrill: (dim: Dim, key: string) => void
  onDim: (dim: Dim) => void
}) {
  const [hover, setHover] = useState<number | null>(null)

  const series = useMemo(() => {
    const sorted = [...rows].filter(row => row.total > 0).sort((a, b) => b.total - a.total)
    const top = sorted.slice(0, TOP_N)
    const rest = sorted.slice(TOP_N)

    const result = top.map((row, index) => ({
      key: row.key,
      months: row.months,
      total: row.total,
      color: PALETTE[index % PALETTE.length],
      drillable: true,
    }))

    if (rest.length) {
      const months = MONTHS.map((_, index) => rest.reduce((sum, row) => sum + (row.months[index] ?? 0), 0))
      result.push({
        key: OTHER_KEY,
        months,
        total: rest.reduce((sum, row) => sum + row.total, 0),
        color: OTHER_COLOR,
        drillable: false,
      })
    }

    return result
  }, [rows])

  const max = Math.max(1, ...MONTHS.map((_, index) => series.reduce((sum, item) => sum + (item.months[index] ?? 0), 0)))
  const hasData = series.some(item => item.total > 0)

  const hovered = hover == null ? null : {
    month: MONTHS[hover],
    total: series.reduce((sum, item) => sum + (item.months[hover] ?? 0), 0),
    parts: series
      .map(item => ({ key: item.key, color: item.color, value: item.months[hover] ?? 0 }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value),
  }

  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Monthly depreciation · {year}</h2>
          <p className="text-[10.5px] text-slate-500">
            Stacked by {dim} · click a segment to open its assets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-slate-300 p-[1px]" role="tablist" aria-label="Stack by">
            {DIMS.map(item => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={dim === item}
                onClick={() => onDim(item)}
                className={`rounded px-1.5 py-[3px] text-[9.5px] font-semibold uppercase tracking-[0.06em] transition-colors ${
                  dim === item ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {DIM_LABEL[item]}
              </button>
            ))}
          </div>
          <p className="tabular hidden text-[10.5px] text-slate-500 sm:block">
            Total <span className="font-semibold text-slate-800">{idrCompact(series.reduce((sum, item) => sum + item.total, 0))}</span>
          </p>
        </div>
      </div>

      <div className="relative px-3 pb-2 pt-3">
        <div className="pointer-events-none absolute inset-x-3 bottom-6 top-3">
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
            <div
              key={ratio}
              className="absolute inset-x-0 border-t border-dashed border-slate-100"
              style={{ bottom: `${ratio * 100}%` }}
            />
          ))}
          <span className="absolute right-0 top-0 -translate-y-1/2 text-[9.5px] tabular text-slate-400">{idrCompact(max)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2 text-[9.5px] tabular text-slate-400">0</span>
        </div>

        <div className="relative flex h-[148px] items-end gap-1 pr-8">
          {MONTHS.map((month, index) => {
            const total = series.reduce((sum, item) => sum + (item.months[index] ?? 0), 0)
            return (
              <div
                key={month}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                aria-label={`${month} ${year}: ${idrFull(total)}`}
              >
                <div className={`flex w-full max-w-[30px] flex-col-reverse overflow-hidden rounded-t-[2px] ${hover === index ? 'ring-1 ring-slate-300' : ''}`}>
                  {series.map(item => {
                    const value = item.months[index] ?? 0
                    if (!value) return null
                    return (
                      <button
                        key={item.key}
                        type="button"
                        tabIndex={-1}
                        title={`${item.key} · ${month}: ${idrFull(value)}`}
                        onClick={() => item.drillable && onDrill(dim, item.key)}
                        disabled={!item.drillable}
                        className="w-full transition-[height] duration-200 motion-reduce:transition-none disabled:cursor-default"
                        style={{
                          height: (value / max) * CHART_H,
                          backgroundColor: item.color,
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}

          {hovered && (
            <div
              className="pointer-events-none absolute bottom-full z-10 mb-1 w-[190px] rounded border border-slate-200 bg-white px-2.5 py-2 text-[10.5px] shadow-[0_12px_28px_-10px_rgba(15,23,42,0.35)]"
              style={{ left: `calc(${((hover ?? 0) + 0.5) * (100 / 12)}% - 95px)` }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {hovered.month} {year}
                </span>
                <span className="tabular font-semibold text-slate-800">{idrCompact(hovered.total)}</span>
              </div>
              {hovered.parts.map(part => (
                <div key={part.key} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: part.color }} />
                    <span className="truncate">{labelOf(part.key)}</span>
                  </span>
                  <span className="tabular shrink-0 text-slate-700">{idrCompact(part.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-1 flex gap-1 pr-8">
          {MONTHS.map((month, index) => (
            <span
              key={month}
              className={`flex-1 text-center text-[9.5px] ${hover === index ? 'font-semibold text-slate-700' : 'text-slate-400'}`}
            >
              {month}
            </span>
          ))}
        </div>

        {!hasData && <p className="mt-1 text-center text-[10.5px] text-slate-400">No depreciation in this period</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-1.5">
        {series.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => item.drillable && onDrill(dim, item.key)}
            disabled={!item.drillable}
            className="inline-flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-900 disabled:cursor-default disabled:hover:text-slate-600"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="max-w-[130px] truncate">{labelOf(item.key)}</span>
            <span className="tabular text-[9.5px] text-slate-400">{idrCompact(item.total)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}