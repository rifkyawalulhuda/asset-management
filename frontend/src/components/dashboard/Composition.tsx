import { idrCompact, idrFull, pct } from '../../utils/currency'
import { bucketLabel } from './dashUtils'

export default function Composition({
  rows,
  label,
  onDrill,
}: {
  rows: { key: string; total: number }[]
  label: string
  onDrill: (key: string) => void
}) {
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const top = sorted.slice(0, 5)
  const rest = sorted.slice(5)
  const otherTotal = rest.reduce((sum, row) => sum + row.total, 0)

  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Composition by {label.toLowerCase()}</h2>
          <p className="text-[10.5px] text-slate-500">Share of yearly depreciation</p>
        </div>
        <p className="tabular shrink-0 text-[10.5px] text-slate-500">{idrCompact(total)}</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2 px-3 py-2">
        {sorted.length === 0 && <p className="text-center text-[10.5px] text-slate-400">No data for this selection</p>}

        {top.map((row, index) => {
          const share = pct(row.total, total)
          return (
            <button key={row.key} type="button" onClick={() => onDrill(row.key)} title={idrFull(row.total)} className="group text-left">
              <div className="flex items-baseline gap-1.5">
                <span className="w-3 text-[9.5px] tabular text-slate-400">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700 group-hover:text-slate-900">
                  {bucketLabel(row.key)}
                </span>
                <span className="tabular text-[10.5px] font-semibold text-slate-800">{idrCompact(row.total)}</span>
                <span className="w-8 text-right text-[9.5px] tabular text-slate-400">{share.toFixed(0)}%</span>
              </div>
              <div className="ml-[18px] mt-1 h-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-1 rounded bg-slate-700 transition-[width] duration-200 group-hover:bg-slate-900 motion-reduce:transition-none"
                  style={{ width: `${Math.max(2, share)}%` }}
                />
              </div>
            </button>
          )
        })}

        {rest.length > 0 && (
          <div className="flex items-baseline gap-1.5 border-t border-slate-100 pt-1.5">
            <span className="w-3 text-[9.5px] tabular text-slate-300">···</span>
            <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-500">
              {rest.length} more {label.toLowerCase()}{rest.length === 1 ? '' : 's'}
            </span>
            <span className="tabular text-[10.5px] font-medium text-slate-600" title={idrFull(otherTotal)}>
              {idrCompact(otherTotal)}
            </span>
            <span className="w-8 text-right text-[9.5px] tabular text-slate-400">{pct(otherTotal, total).toFixed(0)}%</span>
          </div>
        )}
      </div>
    </section>
  )
}
