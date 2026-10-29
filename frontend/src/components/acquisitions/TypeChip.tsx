import type { AcquisitionType } from '../../types'

const STYLES: Record<AcquisitionType, { chip: string; dot: string }> = {
  Acquisition: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Disposal: { chip: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  Transfer: { chip: 'border-sky-200 bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  Adjustment: { chip: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
}

export default function TypeChip({ type, count }: { type: AcquisitionType; count?: number }) {
  const style = STYLES[type]
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.06em] ${style.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {type}
      {count != null && <span className="tabular opacity-70">{count}</span>}
    </span>
  )
}