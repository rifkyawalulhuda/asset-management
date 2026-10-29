import { useMemo, useState } from 'react'
import type { AcqRow } from './acqUtils'
import { MONTHS, compactIDR, fullIDR, monthOf } from './acqUtils'

type Mode = 'count' | 'value'
type View = 'trend' | 'sites' | 'top'

const SERIES = [
  { key: 'Acquisition', color: '#10b981' },
  { key: 'Disposal', color: '#f43f5e' },
  { key: 'Transfer', color: '#94a3b8' },
] as const

const VIEWS: { key: View; label: string }[] = [
  { key: 'trend', label: 'Trend' },
  { key: 'sites', label: 'Sites' },
  { key: 'top', label: 'Top 5' },
]

const CHART_H = 112

const compact = (value: number) => {
  if (value >= 1e9) return `${(value / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
  if (value >= 1e6) return `${(value / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 0 })} jt`
  if (value >= 1e3) return `${(value / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
  return String(Math.round(value))
}

export default function TrendChart({
  rows,
  mode,
  onMode,
}: {
  rows: AcqRow[]
  mode: Mode
  onMode: (mode: Mode) => void
}) {
  const [active, setActive] = useState<number | null>(null)
  const [view, setView] = useState<View>('trend')

  const data = useMemo(() => {
    const months = MONTHS.map(month => ({ month, Acquisition: 0, Disposal: 0, Transfer: 0 }))
    for (const row of rows) {
      const index = monthOf(row.transaction_date)
      if (index == null) continue
      const value = mode === 'count' ? 1 : Number(row.price ?? 0)
      if (row.type === 'Acquisition') months[index].Acquisition += value
      else if (row.type === 'Disposal') months[index].Disposal += value
      else if (row.type === 'Transfer' && mode === 'count') months[index].Transfer += value
    }
    return months
  }, [rows, mode])

  const max = Math.max(
    1,
    ...data.map(item => item.Acquisition + item.Disposal + (mode === 'count' ? item.Transfer : 0)),
  )

  const sites = useMemo(() => {
    const map = new Map<string, { site: string; value: number; count: number }>()
    for (const row of rows) {
      if (row.type === 'Transfer') continue
      const key = row.site || 'Unassigned'
      const entry = map.get(key) ?? { site: key, value: 0, count: 0 }
      entry.value += Number(row.price ?? 0)
      entry.count += 1
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 6)
  }, [rows])
  const siteMax = Math.max(1, ...sites.map(item => item.value))

  const top = useMemo(
    () => [...rows]
      .filter(row => row.type !== 'Transfer' && Number(row.price ?? 0) > 0)
      .sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0))
      .slice(0, 5),
    [rows],
  )

  const activeItem = active == null ? null : data[active]
  const activeTotal = activeItem
    ? activeItem.Acquisition + activeItem.Disposal + (mode === 'count' ? activeItem.Transfer : 0)
    : 0
  const hasData = data.some(item => item.Acquisition + item.Disposal + item.Transfer > 0)

  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Movement analytics</h2>
          <p className="text-[10.5px] text-slate-500">
            {view === 'trend' && (mode === 'count' ? 'Transactions per month' : 'Value per month · transfers excluded')}
            {view === 'sites' && 'Value by site · top 6'}
            {view === 'top' && 'Largest transactions in view'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {view === 'trend' && (
            <div className="hidden items-center gap-2 xl:flex">
              {SERIES.map(series => (
                <span key={series.key} className="inline-flex items-center gap-1 text-[9.5px] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: series.color }} />
                  {series.key}
                </span>
              ))}
            </div>
          )}

          <div className="flex rounded border border-slate-300 p-[1px]" role="tablist" aria-label="Analytics view">
            {VIEWS.map(item => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={view === item.key}
                onClick={() => setView(item.key)}
                className={`rounded px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  view === item.key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {view === 'trend' && (
            <div className="flex rounded border border-slate-300 p-[1px]" role="group" aria-label="Chart metric">
              {(['count', 'value'] as Mode[]).map(option => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => onMode(option)}
                  className={`rounded px-1.5 py-[3px] text-[9.5px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    mode === option ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1 px-3 pb-2 pt-3">
        {view === 'trend' && (
          <>
            <div className="pointer-events-none absolute inset-x-3 bottom-7 top-3">
              {[0, 0.5, 1].map(ratio => (
                <div
                  key={ratio}
                  className="absolute inset-x-0 border-t border-dashed border-slate-100"
                  style={{ bottom: `${ratio * 100}%` }}
                />
              ))}
              <span className="absolute right-0 top-0 -translate-y-1/2 text-[9.5px] tabular text-slate-400">
                {mode === 'count' ? max : compact(max)}
              </span>
              <span className="absolute bottom-0 right-0 translate-y-1/2 text-[9.5px] tabular text-slate-400">0</span>
            </div>

            <div className="relative flex h-28 items-end gap-1 pr-6 pt-1">
              {data.map((item, index) => {
                const total = mode === 'count'
                  ? item.Acquisition + item.Disposal + item.Transfer
                  : item.Acquisition + item.Disposal
                const isActive = active === index

                return (
                  <div
                    key={item.month}
                    className="relative flex h-full flex-1 items-end justify-center"
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                    aria-label={`${item.month}: ${total} ${mode === 'count' ? 'transactions' : 'rupiah'}`}
                    role="img"
                  >
                    <div
                      className={`flex w-full max-w-[26px] flex-col-reverse overflow-hidden rounded-t-[2px] transition-opacity duration-150 motion-reduce:transition-none ${
                        isActive ? 'opacity-100' : hasData ? 'opacity-90' : 'opacity-0'
                      }`}
                    >
                      {SERIES.map(series => {
                        const value = item[series.key]
                        if (!value) return null
                        return (
                          <div
                            key={series.key}
                            className="w-full transition-[height] duration-200 motion-reduce:transition-none"
                            style={{ height: (value / max) * CHART_H, backgroundColor: series.color }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {activeItem && (
                <div
                  className="pointer-events-none absolute bottom-full z-10 mb-1 w-[168px] rounded border border-slate-200 bg-white px-2.5 py-2 text-[10.5px] shadow-[0_12px_28px_-10px_rgba(15,23,42,0.35)]"
                  style={{ left: `calc(${((active ?? 0) + 0.5) * (100 / 12)}% - 84px)` }}
                >
                  <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    {activeItem.month} · {mode === 'count' ? `${activeTotal} total` : fullIDR(activeTotal)}
                  </p>
                  {SERIES.map(series => {
                    const value = activeItem[series.key]
                    if (!value) return null
                    return (
                      <div key={series.key} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: series.color }} />
                          {series.key}
                        </span>
                        <span className="tabular font-medium text-slate-800">
                          {mode === 'count' ? value : fullIDR(value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-1 flex gap-1 pr-6">
              {MONTHS.map((month, index) => (
                <span
                  key={month}
                  className={`flex-1 text-center text-[9.5px] ${active === index ? 'font-semibold text-slate-700' : 'text-slate-400'}`}
                >
                  {month}
                </span>
              ))}
            </div>

            {!hasData && (
              <p className="mt-1 text-center text-[10.5px] text-slate-400">No dated movements in this period</p>
            )}
          </>
        )}

        {view === 'sites' && (
          <div className="flex h-[148px] flex-col justify-center gap-1.5">
            {sites.length === 0 && <p className="text-center text-[10.5px] text-slate-400">No site data in this period</p>}
            {sites.map(item => (
              <div key={item.site} className="flex items-center gap-2">
                <span className="w-14 truncate text-[10px] font-medium text-slate-600" title={item.site}>{item.site}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-sm bg-slate-100">
                  <div
                    className="h-full rounded-sm bg-slate-700/80 transition-[width] duration-200 motion-reduce:transition-none"
                    style={{ width: `${Math.max(2, (item.value / siteMax) * 100)}%` }}
                  />
                </div>
                <span className="w-[62px] text-right text-[10px] tabular text-slate-700">{compactIDR(item.value)}</span>
                <span className="w-6 text-right text-[9.5px] tabular text-slate-400">{item.count}</span>
              </div>
            ))}
          </div>
        )}

        {view === 'top' && (
          <div className="flex h-[148px] flex-col justify-center gap-1">
            {top.length === 0 && <p className="text-center text-[10.5px] text-slate-400">No priced transactions in this period</p>}
            {top.map((row, index) => (
              <div key={row.id} className="flex items-center gap-2 border-b border-slate-50 pb-1 last:border-0">
                <span className="w-3 text-[9.5px] tabular text-slate-400">{index + 1}</span>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.type === 'Acquisition' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-700" title={row.asset_name ?? ''}>
                  {row.asset_name ?? row.fixed_asset_no ?? '—'}
                </span>
                <span className="shrink-0 text-[9.5px] tabular text-slate-400">{row.transaction_date ?? '—'}</span>
                <span className="w-[74px] shrink-0 text-right text-[10px] tabular font-medium text-slate-800">{compactIDR(row.price)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}