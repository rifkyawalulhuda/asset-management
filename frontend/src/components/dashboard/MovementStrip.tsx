import { Link } from 'react-router-dom'
import type { MovementSummary } from './dashUtils'
import { idrCompact, idrFull } from '../../utils/currency'

function Figure({
  label,
  count,
  value,
  tone,
}: {
  label: string
  count: number
  value: number
  tone: 'in' | 'out'
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className={`tabular text-[15px] font-semibold leading-none ${tone === 'in' ? 'text-emerald-700' : 'text-rose-600'}`}>
          {tone === 'in' ? '+' : '−'}{count}
        </span>
        <span className="tabular truncate text-[10.5px] text-slate-500" title={idrFull(value)}>{idrCompact(value)}</span>
      </p>
    </div>
  )
}

export default function MovementStrip({
  movement,
  year,
  loading,
}: {
  movement: MovementSummary | undefined
  year: number
  loading: boolean
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Movement · {year}</h2>
          <p className="text-[10.5px] text-slate-500">Acquisitions and disposals booked this year</p>
        </div>
        <Link
          to="/acquisitions"
          className="shrink-0 text-[10.5px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Open
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2 px-3 py-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2 px-3 py-2.5">
          <div className="grid grid-cols-3 gap-2">
            <Figure label="Acquired" count={movement?.acquired ?? 0} value={movement?.acquiredValue ?? 0} tone="in" />
            <Figure label="Disposed" count={movement?.disposed ?? 0} value={movement?.disposedValue ?? 0} tone="out" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Net</p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className={`tabular text-[15px] font-semibold leading-none ${(movement?.net ?? 0) >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                  {(movement?.net ?? 0) >= 0 ? '+' : '−'}{Math.abs(movement?.net ?? 0)}
                </span>
                <span className="text-[10.5px] text-slate-500">assets</span>
              </p>
            </div>
          </div>

          <p className="border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
            {[
              movement && movement.transfers > 0
                ? `${movement.transfers} transfer${movement.transfers === 1 ? '' : 's'} excluded from the net`
                : 'Transfers are excluded from the net figure',
              movement && movement.incomplete > 0
                ? `${movement.incomplete} record${movement.incomplete === 1 ? '' : 's'} missing a date or price`
                : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
    </section>
  )
}
