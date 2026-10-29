import { useMemo, useState } from 'react'
import type { SiteMap } from './dashUtils'
import { bucketLabel } from './dashUtils'
import { idrCompactCell, idrCompact, idrFull, pct } from '../../utils/currency'

type SortKey = 'count' | 'purchase' | 'acc' | 'nbv' | 'yearly' | 'share'

const headClass = 'whitespace-nowrap bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500'

function SortGlyph({ state }: { state: 'none' | 'asc' | 'desc' }) {
  return (
    <svg viewBox="0 0 8 12" aria-hidden="true" className="h-[9px] w-[6px] shrink-0">
      <path d="M4 .6 7.4 5H.6L4 .6Z" fill="currentColor" opacity={state === 'asc' ? 1 : 0.25} />
      <path d="M4 11.4.6 7h6.8L4 11.4Z" fill="currentColor" opacity={state === 'desc' ? 1 : 0.25} />
    </svg>
  )
}

export default function SitesTable({
  data,
  loading,
  year,
  onDrill,
}: {
  data: SiteMap | undefined
  loading: boolean
  year: number
  onDrill: (site: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'yearly', dir: 'desc' })

  const items = useMemo(() => {
    const list = Object.entries(data ?? {}).map(([site, bucket]) => ({
      site,
      count: bucket.count,
      purchase: bucket.purchase_price,
      acc: bucket.acc_depreciation,
      nbv: bucket.net_book_value,
      yearly: bucket.yearly_depreciation,
    }))
    const totalYearly = list.reduce((sum, item) => sum + item.yearly, 0)
    return list
      .map(item => ({ ...item, share: pct(item.yearly, totalYearly) }))
      .sort((a, b) => (sort.dir === 'asc' ? a[sort.key] - b[sort.key] : b[sort.key] - a[sort.key]))
  }, [data, sort])

  const total = items.reduce((acc, item) => ({
    count: acc.count + item.count,
    purchase: acc.purchase + item.purchase,
    acc: acc.acc + item.acc,
    nbv: acc.nbv + item.nbv,
    yearly: acc.yearly + item.yearly,
  }), { count: 0, purchase: 0, acc: 0, nbv: 0, yearly: 0 })

  const changeSort = (key: SortKey) => {
    setSort(current => (current.key === key
      ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: 'desc' }))
  }

  const SortButton = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <button
      type="button"
      onClick={() => changeSort(sortKey)}
      className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.08em] hover:text-slate-800"
    >
      {label}
      <SortGlyph state={sort.key === sortKey ? sort.dir : 'none'} />
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div>
          <h2 className="text-[12px] font-semibold text-slate-800">Sites · {year}</h2>
          <p className="text-[10.5px] text-slate-500">Click a row to open its assets</p>
        </div>
        <p className="tabular text-[10.5px] text-slate-500">{items.length} locations</p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto fx-scroll">
        {loading && (
          <div className="space-y-1 p-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        )}

        {!loading && (
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
                <th className={`${headClass} text-left`} scope="col">Site / location</th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Assets" sortKey="count" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Purchase" sortKey="purchase" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Acc. dep." sortKey="acc" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="NBV" sortKey="nbv" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Yearly dep." sortKey="yearly" /></th>
                <th className={`${headClass} text-right`} scope="col"><SortButton label="Share" sortKey="share" /></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr
                  key={item.site}
                  onClick={() => onDrill(item.site)}
                  className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-amber-50/70"
                >
                  <td className="truncate px-2 py-[6px] font-medium text-slate-800" title={item.site}>{bucketLabel(item.site)}</td>
                  <td className="px-2 py-[6px] text-right tabular text-slate-600">{item.count.toLocaleString('id-ID')}</td>
                  <td className="px-2 py-[6px] text-right tabular text-slate-600" title={idrFull(item.purchase)}>{idrCompactCell(item.purchase)}</td>
                  <td className="px-2 py-[6px] text-right tabular text-slate-600" title={idrFull(item.acc)}>{idrCompactCell(item.acc)}</td>
                  <td className="px-2 py-[6px] text-right tabular text-slate-600" title={idrFull(item.nbv)}>{idrCompactCell(item.nbv)}</td>
                  <td className="px-2 py-[6px] text-right tabular font-semibold text-slate-900" title={idrFull(item.yearly)}>
                    {idrCompact(item.yearly)}
                  </td>
                  <td className="px-2 py-[6px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-1.5 rounded-full bg-slate-700" style={{ width: `${Math.min(100, item.share)}%` }} />
                      </span>
                      <span className="w-9 text-right text-[10px] tabular text-slate-500">{item.share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[11.5px] text-slate-400">No data for this selection</td></tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="border-t border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-800">
                <td className="px-2 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right tabular">{total.count.toLocaleString('id-ID')}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(total.purchase)}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(total.acc)}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(total.nbv)}</td>
                <td className="px-2 py-1.5 text-right tabular">{idrCompactCell(total.yearly)}</td>
                <td className="px-2 py-1.5 text-right tabular">100%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
