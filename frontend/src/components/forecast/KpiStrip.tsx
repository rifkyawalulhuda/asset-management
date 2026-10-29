import type { ForecastTotals } from './forecastUtils'
import { deltaPct, idrCompact, idrFull } from './forecastUtils'

function Delta({ value, since }: { value: number | null; since?: number }) {
  if (value == null) return null
  const positive = value >= 0
  return (
    <span
      className="tabular inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-[1px] text-[9.5px] font-medium text-slate-600"
      title={since ? `Change vs ${since}` : undefined}
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
  deltaSince,
  title,
  accent,
}: {
  label: string
  value: string
  hint?: string
  delta?: number | null
  deltaSince?: number
  title?: string
  accent?: 'emerald' | 'slate'
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
        <Delta value={delta ?? null} since={deltaSince} />
      </div>
    </div>
  )
}

export default function KpiStrip({
  totals,
  previous,
  site,
  loading,
}: {
  totals: ForecastTotals | undefined
  previous: ForecastTotals | undefined
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

  const excluded = totals.excluded_assets
  const yearly = totals.combined_yearly_depreciation
  const nbv = totals.combined_net_book_value
  const plannedYearly = totals.planned_yearly_depreciation
  const plannedNbv = totals.planned_net_book_value

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-5">
      <Tile
        label="Forecasted assets"
        value={totals.forecasted_assets.toLocaleString('id-ID')}
        hint={excluded > 0 ? `${excluded} not depreciated` : site || 'All sites'}
        title={`${totals.excluded_non_depreciable} non-depreciable (land, CIP) · ${totals.excluded_missing_data} missing price or period`}
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
        hint={`Through ${totals.forecast_year}`}
        title={idrFull(totals.total_acc_depreciation)}
      />
      <Tile
        label="Net book value"
        value={idrCompact(nbv)}
        hint={plannedNbv > 0 ? `+${idrCompact(plannedNbv)} planned` : 'Projected year end'}
        delta={previous ? deltaPct(nbv, previous.combined_net_book_value) : null}
        deltaSince={previous?.forecast_year}
        title={idrFull(nbv)}
      />
      <Tile
        label="Yearly depreciation"
        value={idrCompact(yearly)}
        hint={plannedYearly > 0 ? `+${idrCompact(plannedYearly)} planned` : `Fiscal ${totals.forecast_year}`}
        delta={previous ? deltaPct(yearly, previous.combined_yearly_depreciation) : null}
        deltaSince={previous?.forecast_year}
        title={idrFull(yearly)}
        accent="emerald"
      />
    </div>
  )
}