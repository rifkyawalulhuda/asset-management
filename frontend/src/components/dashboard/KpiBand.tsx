import type { DashTotals, MovementSummary } from './dashUtils'
import { deltaPct, idrCompact, idrFull, pct } from '../../utils/currency'

function Delta({ value, title }: { value: number | null; title?: string }) {
  if (value == null) return null
  const positive = value >= 0
  return (
    <span
      className="tabular inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-[1px] text-[9.5px] font-medium text-slate-600"
      title={title}
    >
      <span aria-hidden="true">{positive ? '↑' : '↓'}</span>
      {Math.abs(value).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
    </span>
  )
}

function Tile({
  label,
  value,
  hint,
  delta,
  deltaTitle,
  title,
  accent,
}: {
  label: string
  value: string
  hint?: string
  delta?: number | null
  deltaTitle?: string
  title?: string
  accent?: 'emerald'
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p
          className={`mt-1 tabular text-[18px] font-semibold leading-none ${accent === 'emerald' ? 'text-emerald-700' : 'text-slate-900'}`}
          title={title}
        >
          {value}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {hint && <span className="truncate text-[10.5px] text-slate-500">{hint}</span>}
        <Delta value={delta ?? null} title={deltaTitle} />
      </div>
    </div>
  )
}

export default function KpiBand({
  totals,
  previous,
  previousYear,
  movement,
  site,
  loading,
}: {
  totals: DashTotals | undefined
  previous: DashTotals | undefined
  previousYear: number
  movement: MovementSummary | undefined
  site: string
  loading: boolean
}) {
  if (loading || !totals) {
    return (
      <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-[76px] animate-pulse rounded-md border border-slate-200 bg-white" />
        ))}
      </div>
    )
  }

  const rate = pct(totals.total_acc_depreciation, totals.total_purchase_price)
  const movementHint = movement && (movement.acquired > 0 || movement.disposed > 0)
    ? `+${movement.acquired} acquired · −${movement.disposed} disposed`
    : site || 'All sites'

  // The two fiscal years can hold very different populations, so the comparison
  // states the previous figure and its asset count instead of implying a like-for-like change.
  const since = (value: number, count: number) =>
    `${previousYear}: ${idrFull(value)} · ${count.toLocaleString('id-ID')} assets`

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-5">
      <Tile
        label="Assets"
        value={totals.total_assets.toLocaleString('id-ID')}
        hint={movementHint}
        title={movement ? `Net ${movement.net >= 0 ? '+' : ''}${movement.net} this year` : undefined}
      />
      <Tile
        label="Purchase price"
        value={idrCompact(totals.total_purchase_price)}
        hint={site || 'All sites'}
        title={idrFull(totals.total_purchase_price)}
      />
      <Tile
        label="Acc. depreciation"
        value={idrCompact(totals.total_acc_depreciation)}
        hint={`${rate.toFixed(1)}% of cost`}
        title={idrFull(totals.total_acc_depreciation)}
      />
      <Tile
        label="Net book value"
        value={idrCompact(totals.total_net_book_value)}
        hint="At year end"
        delta={previous ? deltaPct(totals.total_net_book_value, previous.total_net_book_value) : null}
        deltaTitle={previous ? since(previous.total_net_book_value, previous.total_assets) : undefined}
        title={idrFull(totals.total_net_book_value)}
      />
      <Tile
        label="Yearly depreciation"
        value={idrCompact(totals.total_yearly_depreciation)}
        hint="Fiscal year"
        delta={previous ? deltaPct(totals.total_yearly_depreciation, previous.total_yearly_depreciation) : null}
        deltaTitle={previous ? since(previous.total_yearly_depreciation, previous.total_assets) : undefined}
        title={idrFull(totals.total_yearly_depreciation)}
        accent="emerald"
      />
    </div>
  )
}
