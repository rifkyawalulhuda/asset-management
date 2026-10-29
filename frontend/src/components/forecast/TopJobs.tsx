import type { ChartRow } from './MonthChart'
import { idrCompact, idrFull, labelOf, pct } from './forecastUtils'

export default function TopJobs({
  rows,
  total,
  onDrill,
}: {
  rows: ChartRow[]
  total: number
  onDrill: (key: string) => void
}) {
  const top = [...rows].sort((a, b) => b.total - a.total).slice(0, 5)

  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <h2 className="text-[12px] font-semibold text-slate-800">Top jobs</h2>
        <p className="text-[10.5px] text-slate-500">Highest yearly depreciation</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2 px-3 py-2">
        {top.length === 0 && <p className="text-center text-[10.5px] text-slate-400">No jobs in this period</p>}
        {top.map((row, index) => {
          const share = pct(row.total, total)
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => onDrill(row.key)}
              title={idrFull(row.total)}
              className="group text-left"
            >
              <div className="flex items-baseline gap-1.5">
                <span className="w-3 text-[9.5px] tabular text-slate-400">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700 group-hover:text-slate-900">
{labelOf(row.key)}
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
      </div>
    </section>
  )
}