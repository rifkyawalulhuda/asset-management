import { useEffect, useRef, useState } from 'react'
import type { ForecastAssetsResponse } from './forecastUtils'
import { MONTH_KEYS, MONTHS, idrCell, idrCompact, idrFull } from './forecastUtils'

export default function AssetsGrid({
  data,
  loading,
  page,
  size,
  onPage,
  onSize,
  search,
  onSearch,
  includeExcluded,
  onIncludeExcluded,
  excludedCount,
}: {
  data: ForecastAssetsResponse | undefined
  loading: boolean
  page: number
  size: number
  onPage: (page: number) => void
  onSize: (size: number) => void
  search: string
  onSearch: (search: string) => void
  includeExcluded: boolean
  onIncludeExcluded: (value: boolean) => void
  excludedCount: number
}) {
  const [draft, setDraft] = useState(search)
  const firstSearch = useRef(true)

  useEffect(() => setDraft(search), [search])

  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false
      return
    }
    const timer = window.setTimeout(() => {
      if (draft !== search) onSearch(draft)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft, search, onSearch])

  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)

  const headClass = 'whitespace-nowrap px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-slate-500'
  const cell = 'px-2 py-[5px] text-[10.5px]'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Asset detail</h2>
          <p className="text-[10.5px] text-slate-500">
            {total.toLocaleString('id-ID')} asset{total === 1 ? '' : 's'} · {includeExcluded ? 'including' : 'excluding'} not forecasted
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
              <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
                <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="m10.6 10.6 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && onSearch(draft)}
              placeholder="Search name / AX…"
              aria-label="Search assets"
              className="h-7 w-52 rounded border border-slate-300 pl-7 pr-2 text-[11.5px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={includeExcluded}
            onClick={() => onIncludeExcluded(!includeExcluded)}
            className={`inline-flex h-7 items-center gap-1.5 rounded border px-2 text-[10.5px] font-medium transition-colors ${
              includeExcluded
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            Not forecasted {excludedCount > 0 && <span className="tabular">{excludedCount}</span>}
          </button>

          <select
            value={size}
            onChange={event => onSize(Number(event.target.value))}
            aria-label="Rows per page"
            className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {[50, 100, 200, 350].map(value => <option key={value} value={value}>{value} rows</option>)}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto fx-scroll">
        <table className="border-separate border-spacing-0 text-left" style={{ minWidth: 1800 }}>
          <colgroup>
            <col style={{ width: 34 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 74 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 76 }} />
            <col style={{ width: 118 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 60 }} />
            {MONTHS.map(month => <col key={month} style={{ width: 76 }} />)}
            <col style={{ width: 112 }} />
            <col style={{ width: 108 }} />
          </colgroup>

          <thead className="sticky top-0 z-20">
            <tr>
              <th rowSpan={2} scope="col" className={`${headClass} sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 text-center`}>No</th>
              <th colSpan={2} scope="colgroup" className={`${headClass} border-b border-r border-slate-200 bg-slate-100 text-left`}>Identity</th>
              <th colSpan={3} scope="colgroup" className={`${headClass} border-b border-r border-slate-200 bg-slate-50 text-left`}>Classification</th>
              <th colSpan={4} scope="colgroup" className={`${headClass} border-b border-r border-slate-200 bg-slate-100 text-left`}>Depreciation</th>
              <th colSpan={12} scope="colgroup" className={`${headClass} border-b border-r border-slate-200 bg-slate-50 text-center`}>Monthly depreciation</th>
              <th rowSpan={2} scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-100 text-right`}>Total / year</th>
              <th rowSpan={2} scope="col" className={`${headClass} border-b border-slate-200 bg-slate-100 text-right`}>NBV</th>
            </tr>
            <tr>
              <th scope="col" className={`${headClass} sticky left-[34px] z-30 border-b border-r border-slate-200 bg-slate-50`}>AX no.</th>
              <th scope="col" className={`${headClass} sticky left-[134px] z-30 border-b border-r border-slate-200 bg-slate-50`}>Name</th>
              <th scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-50`}>Group</th>
              <th scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-50`}>Category</th>
              <th scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-50`}>Site</th>
              <th scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-50`}>Job</th>
              <th scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-50 text-right`}>Purchase</th>
              <th scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-50 text-center`}>Period</th>
              <th scope="col" className={`${headClass} border-b border-slate-200 bg-slate-50 text-center`}>Remain</th>
              {MONTHS.map(month => (
                <th key={month} scope="col" className={`${headClass} border-b border-r border-slate-200 bg-slate-50 text-right`}>{month}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && (
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td colSpan={23} className="px-2 py-1.5">
                    <div className="h-4 animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            )}

            {!loading && data?.items.map((asset, index) => {
              const excluded = Boolean(asset.excluded)
              const nonDepreciable = asset.excluded_reason === 'non_depreciable'
              const pinnedTone = excluded ? (nonDepreciable ? 'bg-slate-50' : 'bg-amber-50') : 'bg-white'
              return (
                <tr
                  key={`${asset.is_planned ? 'p' : 'a'}-${asset.id}`}
                  className={`border-b border-slate-100 transition-colors hover:bg-amber-50/60 ${
                    excluded ? (nonDepreciable ? 'bg-slate-50/60' : 'bg-amber-50/40') : ''
                  }`}
                >
                  <td className={`${cell} sticky left-0 z-10 border-r border-slate-100 ${pinnedTone} text-center tabular text-slate-400`}>
                    {asset.is_planned ? 'P' : (page - 1) * size + index + 1}
                  </td>
                  <td className={`${cell} sticky left-[34px] z-10 border-r border-slate-100 ${pinnedTone} font-mono text-[10px] text-slate-500`}>
                    {asset.fixed_asset_number_ax ?? '—'}
                  </td>
                  <td className={`${cell} sticky left-[134px] z-10 border-r border-slate-100 ${pinnedTone}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-800" title={asset.name}>{asset.name}</span>
                      {excluded && (nonDepreciable ? (
                        <span
                          className="shrink-0 rounded bg-slate-200 px-1 text-[9px] font-semibold uppercase text-slate-600"
                          title="Land and construction in process do not depreciate"
                        >
                          non-depr.
                        </span>
                      ) : (
                        <span
                          className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-semibold uppercase text-amber-700"
                          title="Missing purchase price or depreciation period"
                        >
                          no data
                        </span>
                      ))}
                      {asset.is_planned && (
                        <span className="shrink-0 rounded bg-emerald-100 px-1 text-[9px] font-semibold uppercase text-emerald-700">planned</span>
                      )}
                    </div>
                  </td>
                  <td className={`${cell} truncate text-slate-600`} title={asset.group_name ?? ''}>{asset.group_name ?? '—'}</td>
                  <td className={`${cell} text-center`}>
                    {asset.category
                      ? <span className="rounded bg-slate-100 px-1 py-[1px] text-[9.5px] font-medium text-slate-600">{asset.category}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`${cell} text-center text-slate-600`}>{asset.site_location ?? '—'}</td>
                  <td className={`${cell} truncate text-slate-600`} title={asset.job ?? ''}>{asset.job ?? '—'}</td>
                  <td className={`${cell} border-r border-slate-100 text-right tabular text-slate-700`} title={idrFull(asset.purchase_price)}>
                    {idrCell(asset.purchase_price)}
                  </td>
                  <td className={`${cell} border-r border-slate-100 text-center tabular text-slate-600`}>
                    {asset.depreciation_period_total ? `${asset.depreciation_period_total}` : '—'}
                  </td>
                  <td className={`${cell} border-r border-slate-100 text-center`}>
                    {excluded
                      ? <span className="text-slate-300">—</span>
                      : asset.dep_period_remain <= 0
                        ? <span className="rounded bg-slate-100 px-1 text-[9px] font-semibold uppercase text-slate-500">done</span>
                        : <span className="tabular text-slate-600">{asset.dep_period_remain}</span>}
                  </td>
                  {MONTH_KEYS.map(key => (
                    <td key={key} className={`${cell} border-r border-slate-50 text-right tabular text-slate-600`} title={idrFull(asset.months[key])}>
                      {asset.months[key] > 0 ? idrCompact(asset.months[key]) : <span className="text-slate-200">—</span>}
                    </td>
                  ))}
                  <td className={`${cell} border-r border-slate-100 text-right tabular font-semibold text-slate-900`} title={idrFull(asset.dep_expense_current)}>
                    {idrCell(asset.dep_expense_current)}
                  </td>
                  <td className={`${cell} text-right tabular text-slate-700`} title={idrFull(asset.nbv_curr)}>
                    {idrCell(asset.nbv_curr)}
                  </td>
                </tr>
              )
            })}

            {!loading && data && data.items.length === 0 && (
              <tr>
                <td colSpan={23} className="px-3 py-12 text-center">
                  <p className="text-[12px] font-medium text-slate-600">No assets match these filters</p>
                  <p className="mt-1 text-[11px] text-slate-400">Try a different search or clear the drill-down chips.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[10.5px] text-slate-500">
        <span>
          Showing <span className="tabular font-medium text-slate-700">{from.toLocaleString('id-ID')}–{to.toLocaleString('id-ID')}</span> of{' '}
          <span className="tabular font-medium text-slate-700">{total.toLocaleString('id-ID')}</span>
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onPage(1)} className="h-6 rounded border border-slate-300 bg-white px-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50">«</button>
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-6 rounded border border-slate-300 bg-white px-2 text-slate-600 disabled:opacity-40 hover:bg-slate-50">Prev</button>
          <span className="px-2 tabular text-[10.5px] text-slate-600">Page {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="h-6 rounded border border-slate-300 bg-white px-2 text-slate-600 disabled:opacity-40 hover:bg-slate-50">Next</button>
          <button type="button" disabled={page >= pages} onClick={() => onPage(pages)} className="h-6 rounded border border-slate-300 bg-white px-1.5 text-slate-600 disabled:opacity-40 hover:bg-slate-50">»</button>
        </div>
      </div>
    </div>
  )
}