import type { AcqRow } from './acqUtils'
import { compactIDR, countByType, fullIDR, sumPrice } from './acqUtils'

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  title,
}: {
  label: string
  value: string
  hint: string
  tone?: 'neutral' | 'in' | 'out' | 'up' | 'down'
  title?: string
}) {
  const toneClass =
    tone === 'in' || tone === 'up'
      ? 'text-emerald-700'
      : tone === 'out' || tone === 'down'
        ? 'text-rose-700'
        : 'text-slate-900'

  return (
    <div className="flex h-full flex-col justify-between rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className={`mt-1 tabular text-[19px] font-semibold leading-none ${toneClass}`} title={title}>
          {value}
        </p>
      </div>
      <p className="mt-1.5 truncate text-[10.5px] text-slate-500">{hint}</p>
    </div>
  )
}

export default function KpiStrip({ rows, filtered }: { rows: AcqRow[]; filtered: boolean }) {
  const counts = countByType(rows)
  const acquisition = sumPrice(rows, 'Acquisition')
  const disposal = sumPrice(rows, 'Disposal')
  const net = disposal - acquisition

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2">
      <Stat
        label="Transactions"
        value={rows.length.toLocaleString('id-ID')}
        hint={`${counts.Acquisition} acq · ${counts.Disposal} disp · ${counts.Transfer} transfer${filtered ? ' · filtered' : ''}`}
      />
      <Stat
        label="Acquisition value"
        value={compactIDR(acquisition)}
        hint={`${counts.Acquisition} purchase${counts.Acquisition === 1 ? '' : 's'} this period`}
        tone="out"
        title={fullIDR(acquisition)}
      />
      <Stat
        label="Disposal proceeds"
        value={compactIDR(disposal)}
        hint={`${counts.Disposal} disposal${counts.Disposal === 1 ? '' : 's'} this period`}
        tone="in"
        title={fullIDR(disposal)}
      />
      <Stat
        label="Net cash movement"
        value={`${net >= 0 ? '+' : ''}${compactIDR(net)}`}
        hint="Proceeds minus purchases"
        tone={net > 0 ? 'up' : net < 0 ? 'down' : 'neutral'}
        title={fullIDR(net)}
      />
    </div>
  )
}