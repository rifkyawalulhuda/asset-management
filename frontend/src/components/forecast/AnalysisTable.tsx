import { useMemo, useState } from 'react'
import type { ChartRow, Dim, SummaryItem, SummaryMap } from './forecastUtils'
import { DIMS, DIM_LABEL, MONTHS, buildSummaryItems, idrCompactCell, idrCompact, idrFull, labelOf, pct } from './forecastUtils'

type View = 'summary' | 'monthly'

type Sort = { key: string; dir: 'asc' | 'desc' }

function SortGlyph({ state }: { state: 'none' | 'asc' | 'desc' }) {
  return (
    <svg viewBox="0 0 8 12" aria-hidden="true" className="h-[9px] w-[6px] shrink-0">
      <path d="M4 .6 7.4 5H.6L4 .6Z" fill="currentColor" opacity={state === 'asc' ? 1 : 0.25} />
      <path d="M4 11.4.6 7h6.8L4 11.4Z" fill="currentColor" opacity={state === 'desc' ? 1 : 0.25} />
    </svg>
  )
}

export default function AnalysisTable({
  dim,
  onDim,
  view,
  onView,
  summary,
  monthly,
  loading,
  year,
  onDrill,
}: {
  dim: Dim
  onDim: (dim: Dim) => void
  view: View
  onView: (view: View) => void
  summary: SummaryMap | undefined
  monthly: ChartRow[] | undefined
  loading: boolean
  year: number
  onDrill: (dim: Dim, key: string) => void
}) {
  const [sort, setSort] = useState<Sort>(() => (
    view === 'summary' ? { key: 'yearly', dir: 'desc' } : { key: 'total', dir: 'desc' }
  ))

  const items = useMemo<SummaryItem[]>(() => buildSummaryItems(summary), [summary])

  const totalYearly = items.reduce((sum, item) => sum + item.yearly, 0)
  const totalCount = items.reduce((sum, item) => sum + item.count, 0)
  const totalPurchase = items.reduce((sum, item) => sum + item.purchase, 0)
  const totalAcc = items.reduce((sum, item) => sum + item.acc, 0)
  const totalNbv = items.reduce((sum, item) => sum + item.nbv, 0)

  const sorted = useMemo(() => {
    const copy = [...items]
    copy.sort((a, b) => {
      const left = sort.key === 'share' ? pct(a.yearly, totalYearly) : (a[sort.key as keyof SummaryItem] as number)
      const right = sort.key === 'share' ? pct(b.yearly, totalYearly) : (b[sort.key as keyof SummaryItem] as number)
      return sort.dir === 'asc' ? left - right : right - left
    })
    return copy
  }, [items, sort, totalYearly])

  const monthlySorted = useMemo(() => {
    const copy = [...(monthly ?? [])]
    copy.sort((a, b) => {
      const key = sort.key
      const left = key === 'total' ? a.total : (a.months[Number(key)] ?? 0)
      const right = key === 'total' ? b.total : (b.months[Number(key)] ?? 0)
      return sort.dir === 'asc' ? left - right : right - left
    })
    return copy
  }, [monthly, sort])

  const changeSort = (key: string) => {
    setSort(current => (
      current.key === key
        ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    ))
  }

  const toggleView = (next: View) => {
    onView(next)
    setSort(next === 'summary' ? { key: 'yearly', dir: 'desc' } : { key: 'total', dir: 'desc' })
  }

  const monthlyGrand = useMemo(() => {
    const months = MONTHS.map((_, index) => (monthly ?? []).reduce((sum, row) => sum + (row.months[index] ?? 0), 0))
    return { months, total: months.reduce((sum, value) => sum + value, 0) }
  }, [monthly])

  const headClass = 'whitespace-nowrap bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500'

  const SortButton = ({ label, sortKey, align = 'right' }: { label: string; sortKey: string; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => changeSort(sortKey)}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.08em] hover:text-slate-800 ${align === 'right' ? 'justify-end' : ''}`}
    >
      {label}
      <SortGlyph state={sort.key === sortKey ? sort.dir : 'none'} />
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-semibold text-slate-800">Analysis · {year}</h2>
          <p className="text-[10.5px] text-slate-500">Click a row to open its assets</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded border border-slate-300 p-[1px]" role="tablist" aria-label="Dimension">
            {DIMS.map(item => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={dim === item}
                onClick={() => onDim(item)}
                className={`rounded px-2 py-[3px] text-[10px] font-semibold transition-colors ${
                  dim === item ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {DIM_LABEL[item]}
              </button>
            ))}
          </div>
          <div className="flex rounded border border-slate-300 p-[1px]" role="group" aria-label="Table view">
            {(['summary', 'monthly'] as View[]).map(item => (
              <button
                key={item}
                type="button"
                aria-pressed={view === item}
                onClick={() => toggleView(item)}
                className={`rounded px-2 py-[3px] text-[10px] font-semibold capitalize transition-colors ${
                  view === item ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto fx-scroll">
        {loading && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        )}

        {!loading && view === 'summary' && (
          <table className="w-full table-fixed text-[11.5px]">
            <colgroup>
              <col />
              <col style={{ width: 74 }} />
              <col style={{ width: 138 }} />
              <col style={{ width: 138 }} />
              <col style={{ width: 138 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <th className={`${headClass} text-left`} scope="col">{DIM_LABEL[dim]}</th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Assets" sortKey="count" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Purchase" sortKey="purchase" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Acc. dep." sortKey="acc" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="NBV" sortKey="nbv" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Yearly dep." sortKey="yearly" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Share" sortKey="share" /></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(item => {
                const share = pct(item.yearly, totalYearly)
                return (
                  <tr
                    key={item.key}
                    onClick={() => onDrill(dim, item.key)}
                    className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-amber-50/70"
                  >
                    <td className="truncate px-2 py-[6px] font-medium text-slate-800" title={item.key}>{labelOf(item.key)}</td>
                    <td className="px-2 py-[6px] text-right tabular text-slate-600">
                      {item.count.toLocaleString('id-ID')}
                      {item.plannedCount > 0 && <span className="ml-1 text-[9.5px] font-medium text-emerald-600">+{item.plannedCount}</span>}
                    </td>
                    <td className="px-2 py-[6px] text-right tabular text-slate-600" title={idrFull(item.purchase)}>{idrCompactCell(item.purchase)}</td>
                    <td className="px-2 py-[6px] text-right tabular text-slate-600" title={idrFull(item.acc)}>{idrCompactCell(item.acc)}</td>
                    <td className="px-2 py-[6px] text-right tabular text-slate-600" title={idrFull(item.nbv)}>{idrCompactCell(item.nbv)}</td>
                    <td className="px-2 py-[6px] text-right tabular font-semibold text-slate-900">
                      {idrCompactCell(item.yearly)}
                      {item.plannedYearly > 0 && (
                        <span className="ml-1 text-[9.5px] font-normal text-emerald-600">+{idrCompact(item.plannedYearly)}</span>
                      )}
                    </td>
                    <td className="px-2 py-[6px]">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-1.5 rounded-full bg-slate-700" style={{ width: `${Math.min(100, share)}%` }} />
                        </span>
                        <span className="w-9 text-right text-[10px] tabular text-slate-500">{share.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!sorted.length && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[11.5px] text-slate-400">No data for this selection</td></tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="border-t border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-800">
                <td className="px-2 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right tabular">{totalCount.toLocaleString('id-ID')}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(totalPurchase)}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(totalAcc)}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(totalNbv)}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(totalYearly)}</td>
                <td className="px-2 py-1.5 text-right tabular">100%</td>
              </tr>
            </tfoot>
          </table>
        )}

        {!loading && view === 'monthly' && (
          <table className="w-full table-fixed text-[11.5px]">
            <colgroup>
              <col style={{ width: 190 }} />
              {MONTHS.map(month => <col key={month} />)}
              <col style={{ width: 120 }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200">
                <th className={`${headClass} text-left`} scope="col">{DIM_LABEL[dim]}</th>
                {MONTHS.map((month, index) => (
                  <th key={month} className={`${headClass} text-right`} scope="col">
                    <SortButton label={month} sortKey={String(index)} />
                  </th>
                ))}
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Total" sortKey="total" /></th>
              </tr>
            </thead>
            <tbody>
              {monthlySorted.map(row => (
                <tr
                  key={row.key}
                  onClick={() => onDrill(dim, row.key)}
                  className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-amber-50/70"
                >
                  <td className="truncate px-2 py-[6px] font-medium text-slate-800" title={row.key}>{labelOf(row.key)}</td>
                  {row.months.map((value, index) => (
                    <td key={MONTHS[index]} className="px-1.5 py-[6px] text-right tabular text-slate-600">
                      {value > 0 ? idrCompact(value) : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-2 py-[6px] text-right tabular font-semibold text-slate-900">{idrCompactCell(row.total)}</td>
                </tr>
              ))}
              {!monthlySorted.length && (
                <tr><td colSpan={14} className="px-3 py-10 text-center text-[11.5px] text-slate-400">No data for this selection</td></tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="border-t border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-800">
                <td className="px-2 py-1.5">TOTAL</td>
                {monthlyGrand.months.map((value, index) => (
                  <td key={MONTHS[index]} className="px-1.5 py-1.5 text-right tabular">{value > 0 ? idrCompact(value) : '—'}</td>
                ))}
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(monthlyGrand.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}