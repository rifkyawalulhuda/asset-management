import { Link } from 'react-router-dom'
import type { ForecastTotals } from '../forecast/forecastUtils'
import { idrCompact, idrFull } from '../../utils/currency'

export default function Outlook({
  years,
  totals,
  loading,
}: {
  years: number[]
  totals: (ForecastTotals | undefined)[]
  loading: boolean
}) {
  const max = Math.max(1, ...totals.map(item => item?.combined_yearly_depreciation ?? 0))

  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Outlook</h2>
          <p className="text-[10.5px] text-slate-500">Projected yearly depreciation</p>
        </div>
        <Link
          to={`/forecast?year=${years[0] ?? ''}`}
          className="shrink-0 text-[10.5px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Open
        </Link>
      </div>

      <div className="grid flex-1 grid-cols-3 gap-1 px-2 py-2">
        {years.map((year, index) => {
          const item = totals[index]
          const value = item?.combined_yearly_depreciation ?? 0
          const nbv = item?.combined_net_book_value ?? 0
          return (
            <Link
              key={year}
              to={`/forecast?year=${year}`}
              title={item ? `${year}: ${idrFull(value)}` : undefined}
              className="flex flex-col justify-between rounded border border-slate-200 bg-white px-2 py-1.5 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
            >
              <span className="tabular text-[10px] font-semibold text-slate-500">{year}</span>
              <span className="tabular mt-0.5 text-[12px] font-semibold leading-tight text-slate-800">
                {loading || !item ? '…' : idrCompact(value)}
              </span>
              <span className="tabular text-[9.5px] text-slate-400">
                NBV {loading || !item ? '…' : idrCompact(nbv)}
              </span>
              <span className="mt-1 block h-1 overflow-hidden rounded bg-slate-100">
                <span
                  className="block h-1 rounded bg-slate-400 transition-[width] duration-200 motion-reduce:transition-none"
                  style={{ width: `${Math.max(3, (value / max) * 100)}%` }}
                />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
