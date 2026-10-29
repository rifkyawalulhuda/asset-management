import { MONTHS, idrCompact, idrFull } from '../../utils/currency'

const BAR_H = 104

export default function MonthSchedule({
  year,
  values,
  monthly,
}: {
  year: number
  values: number[]
  monthly: number | null | undefined
}) {
  const total = values.reduce((sum, value) => sum + value, 0)
  const max = Math.max(1, ...values)
  const active = values.filter(value => value > 0).length

  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Depreciation schedule · {year}</h2>
          <p className="text-[10.5px] text-slate-500">
            {active === 0
              ? 'No depreciation booked in this year'
              : `${active} of 12 months depreciated`}
          </p>
        </div>
        <p className="tabular shrink-0 text-[13px] font-semibold text-slate-900" title={idrFull(total)}>
          {idrCompact(total)}
        </p>
      </div>

      <div className="px-3 pb-1 pt-3">
        <div className="relative" style={{ height: BAR_H }}>
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map(index => (
              <span key={index} className="block border-t border-dashed border-slate-100" />
            ))}
          </div>

          <div className="relative flex h-full items-end gap-1.5">
            {values.map((value, index) => {
              const height = value > 0 ? Math.max(4, (value / max) * (BAR_H - 18)) : 2
              return (
                <div
                  key={MONTHS[index]}
                  className="group relative flex h-full flex-1 items-end justify-center"
                  title={`${MONTHS[index]} ${year}: ${idrFull(value)}`}
                  aria-label={`${MONTHS[index]} ${year}: ${idrFull(value)}`}
                >
                  <div
                    className={`w-full max-w-[38px] rounded-t-[2px] transition-colors motion-reduce:transition-none ${
                      value > 0 ? 'bg-slate-700 group-hover:bg-slate-900' : 'bg-slate-200'
                    }`}
                    style={{ height }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-1 flex gap-1.5">
          {MONTHS.map((month, index) => (
            <span
              key={month}
              className={`flex-1 text-center text-[9.5px] ${values[index] > 0 ? 'font-medium text-slate-600' : 'text-slate-300'}`}
            >
              {month}
            </span>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 px-3 py-2">
        <div>
          <dt className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Months</dt>
          <dd className="tabular text-[11.5px] font-medium text-slate-800">{active} / 12</dd>
        </div>
        <div>
          <dt className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Monthly</dt>
          <dd className="tabular text-[11.5px] font-medium text-slate-800" title={idrFull(monthly ?? 0)}>
            {monthly ? idrCompact(monthly) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Year total</dt>
          <dd className="tabular text-[11.5px] font-semibold text-slate-900" title={idrFull(total)}>
            {idrCompact(total)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
